<?php
require_once __DIR__ . '/../_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$agent = payflow_require_agent();
$body = read_json_body();
$provider = strtoupper(trim((string) ($body['provider'] ?? '')));
$depositId = trim((string) ($body['depositId'] ?? ''));
$orderId = trim((string) ($body['orderId'] ?? ''));

if ($depositId === '' || $orderId === '' || !in_array($provider, ['RAZORPAY', 'CASHFREE'], true)) {
    json_response(['error' => 'Invalid verification payload'], 400);
}

$deposit = null;
$deposits = read_store('payflow_deposits.json', []);
foreach ($deposits as $row) {
    if (($row['id'] ?? '') === $depositId) {
        $deposit = $row;
        break;
    }
}
if (!$deposit || ($deposit['uid'] ?? '') !== $agent['uid']) {
    json_response(['error' => 'Deposit not found'], 404);
}
if (($deposit['status'] ?? '') === 'PAID') {
    json_response([
        'success' => true,
        'balance' => payflow_wallet_get($agent['uid']),
        'utr' => $deposit['utr'] ?? null,
        'alreadyProcessed' => true,
    ]);
}

$amount = (float) ($deposit['amount'] ?? 0);
$utr = null;
$paymentId = null;

if ($provider === 'RAZORPAY') {
    $rzpPaymentId = trim((string) ($body['razorpay_payment_id'] ?? ''));
    $rzpSignature = trim((string) ($body['razorpay_signature'] ?? ''));

    if (!empty($deposit['demoMode'])) {
        if (!payflow_demo_mode()) {
            json_response(['error' => 'Demo deposits are disabled in production.'], 403);
        }
        $paymentId = $rzpPaymentId !== '' ? $rzpPaymentId : ('pay_demo_' . time());
        $utr = 'DEMO' . time();
    } else {
        if (!razorpay_is_configured()) {
            json_response(['error' => 'Razorpay is not configured.'], 503);
        }
        if ($rzpPaymentId === '' || $rzpSignature === '') {
            json_response(['error' => 'Missing Razorpay payment signature'], 400);
        }
        if (!razorpay_verify_payment_signature($orderId, $rzpPaymentId, $rzpSignature)) {
            json_response(['error' => 'Invalid payment signature'], 400);
        }
        $api = razorpay_api('GET', 'payments/' . rawurlencode($rzpPaymentId));
        if (empty($api['ok'])) {
            json_response(['error' => $api['error'] ?: 'Could not fetch payment'], 502);
        }
        $status = (string) ($api['body']['status'] ?? '');
        if (!in_array($status, ['captured', 'authorized'], true)) {
            json_response(['error' => 'Payment not completed', 'status' => $status], 402);
        }
        $paidPaise = (int) ($api['body']['amount'] ?? 0);
        if ($paidPaise !== (int) ($deposit['amountPaise'] ?? 0)) {
            json_response(['error' => 'Amount mismatch'], 400);
        }
        $paymentId = $rzpPaymentId;
        $acquirer = $api['body']['acquirer_data'] ?? [];
        $utr = (string) ($acquirer['rrn'] ?? $acquirer['upi_transaction_id'] ?? $rzpPaymentId);
    }
}

if ($provider === 'CASHFREE') {
    if (!empty($deposit['demoMode'])) {
        if (!payflow_demo_mode()) {
            json_response(['error' => 'Demo deposits are disabled in production.'], 403);
        }
        $paymentId = 'cf_demo_' . time();
        $utr = 'DEMOCF' . time();
    } else {
        if (!cashfree_is_configured()) {
            json_response(['error' => 'Cashfree is not configured.'], 503);
        }
        $api = cashfree_api('GET', 'orders/' . rawurlencode($orderId) . '/payments');
        if (empty($api['ok'])) {
            json_response(['error' => $api['error'] ?: 'Could not fetch Cashfree payment'], 502);
        }
        $payments = $api['body'] ?? [];
        if (isset($payments['payments']) && is_array($payments['payments'])) {
            $payments = $payments['payments'];
        }
        if (!is_array($payments)) {
            $payments = [];
        }
        $success = null;
        foreach ($payments as $p) {
            $st = strtoupper((string) ($p['payment_status'] ?? $p['status'] ?? ''));
            if (in_array($st, ['SUCCESS', 'PAID'], true)) {
                $success = $p;
                break;
            }
        }
        if (!$success) {
            json_response(['error' => 'Payment not completed yet'], 402);
        }
        $paymentId = (string) ($success['cf_payment_id'] ?? $success['payment_id'] ?? '');
        $utr = (string) ($success['bank_reference'] ?? $paymentId);
    }
}

// Idempotent credit — claim once via _credited
$shouldCredit = false;
mutate_store('payflow_deposits.json', function ($rows) use ($depositId, $paymentId, $utr, &$shouldCredit) {
    if (!is_array($rows)) $rows = [];
    foreach ($rows as $i => $row) {
        if (($row['id'] ?? '') !== $depositId) {
            continue;
        }
        if (!empty($row['_credited']) || ($row['status'] ?? '') === 'PAID') {
            $shouldCredit = false;
            return $rows;
        }
        $rows[$i]['status'] = 'PAID';
        $rows[$i]['paymentId'] = $paymentId;
        $rows[$i]['utr'] = $utr;
        $rows[$i]['updatedAt'] = gmdate('c');
        $rows[$i]['paidAt'] = gmdate('c');
        $rows[$i]['_credited'] = true;
        $shouldCredit = true;
        break;
    }
    return $rows;
}, []);

$balance = $shouldCredit
    ? payflow_wallet_credit($agent['uid'], $amount, [
        'provider' => $provider,
        'type' => 'wallet_add',
        'depositId' => $depositId,
        'paymentId' => $paymentId,
        'utr' => $utr,
        'orderId' => $orderId,
        'agentId' => $agent['agentId'] ?? '',
    ])
    : payflow_wallet_get($agent['uid']);

json_response([
    'success' => true,
    'balance' => $balance,
    'utr' => $utr,
    'paymentId' => $paymentId,
    'demoMode' => !empty($deposit['demoMode']),
    'alreadyProcessed' => !$shouldCredit,
]);
