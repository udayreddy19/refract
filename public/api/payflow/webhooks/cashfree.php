<?php
require_once __DIR__ . '/../_bootstrap.php';

$raw = file_get_contents('php://input') ?: '';
$headers = [];
foreach ($_SERVER as $k => $v) {
    if (strpos($k, 'HTTP_') === 0) {
        $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k, 5)))));
        $headers[strtolower($name)] = $v;
        $headers[$name] = $v;
    }
}
// Normalize common Cashfree header keys
$headers['x-webhook-signature'] = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? $_SERVER['HTTP_X_CF_SIGNATURE'] ?? '';
$headers['x-webhook-timestamp'] = $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? $_SERVER['HTTP_X_CF_TIMESTAMP'] ?? '';

if (cashfree_is_configured() && CASHFREE_WEBHOOK_SECRET !== '') {
    if (!cashfree_verify_webhook_signature($raw, $headers)) {
        json_response(['error' => 'Invalid Cashfree webhook signature'], 401);
    }
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    json_response(['error' => 'Invalid JSON'], 400);
}

$data = $payload['data'] ?? $payload;
$order = $data['order'] ?? [];
$payment = $data['payment'] ?? [];
$orderId = (string) ($order['order_id'] ?? $payload['orderId'] ?? '');
$paymentStatus = strtoupper((string) ($payment['payment_status'] ?? $order['order_status'] ?? ''));
$paymentId = (string) ($payment['cf_payment_id'] ?? '');
$utr = (string) ($payment['bank_reference'] ?? $paymentId);
$amount = (float) ($order['order_amount'] ?? $payment['payment_amount'] ?? 0);

if ($orderId === '' || !in_array($paymentStatus, ['SUCCESS', 'PAID'], true)) {
    json_response(['ok' => true, 'ignored' => true]);
}

$deposit = null;
mutate_store('payflow_deposits.json', function ($rows) use ($orderId, $paymentId, $utr, &$deposit) {
    if (!is_array($rows)) $rows = [];
    foreach ($rows as $i => $row) {
        if (($row['orderId'] ?? '') === $orderId || ($row['id'] ?? '') === $orderId) {
            if (($row['status'] ?? '') === 'PAID') {
                $deposit = $rows[$i];
                return $rows;
            }
            $rows[$i]['status'] = 'PAID';
            $rows[$i]['paymentId'] = $paymentId;
            $rows[$i]['utr'] = $utr;
            $rows[$i]['paidAt'] = gmdate('c');
            $rows[$i]['updatedAt'] = gmdate('c');
            $deposit = $rows[$i];
            break;
        }
    }
    return $rows;
}, []);

if ($deposit && ($deposit['status'] ?? '') === 'PAID') {
    $creditAmount = $amount > 0 ? $amount : (float) ($deposit['amount'] ?? 0);
    payflow_wallet_credit((string) $deposit['uid'], $creditAmount, [
        'provider' => 'CASHFREE',
        'depositId' => $deposit['id'],
        'paymentId' => $paymentId,
        'utr' => $utr,
        'source' => 'webhook',
    ]);
}

json_response(['ok' => true]);
