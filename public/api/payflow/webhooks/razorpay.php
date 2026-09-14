<?php
require_once __DIR__ . '/../_bootstrap.php';

$raw = file_get_contents('php://input') ?: '';
$signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

if (RAZORPAY_WEBHOOK_SECRET !== '') {
    $expected = hash_hmac('sha256', $raw, RAZORPAY_WEBHOOK_SECRET);
    if (!hash_equals($expected, $signature)) {
        json_response(['error' => 'Invalid webhook signature'], 401);
    }
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    json_response(['error' => 'Invalid JSON'], 400);
}

$event = (string) ($payload['event'] ?? '');
$paymentEntity = $payload['payload']['payment']['entity'] ?? null;
$orderEntity = $payload['payload']['order']['entity'] ?? null;

if (!in_array($event, ['payment.captured', 'order.paid'], true) || !is_array($paymentEntity)) {
    json_response(['ok' => true, 'ignored' => true]);
}

$orderId = (string) ($paymentEntity['order_id'] ?? ($orderEntity['id'] ?? ''));
$paymentId = (string) ($paymentEntity['id'] ?? '');
$amountPaise = (int) ($paymentEntity['amount'] ?? 0);
$utr = (string) (($paymentEntity['acquirer_data']['rrn'] ?? null)
    ?: ($paymentEntity['acquirer_data']['upi_transaction_id'] ?? $paymentId));

$deposit = null;
mutate_store('payflow_deposits.json', function ($rows) use ($orderId, $paymentId, $utr, $amountPaise, &$deposit) {
    if (!is_array($rows)) $rows = [];
    foreach ($rows as $i => $row) {
        if (($row['orderId'] ?? '') === $orderId || (($row['provider'] ?? '') === 'RAZORPAY' && ($row['id'] ?? '') === ($paymentEntity['notes']['depositId'] ?? ''))) {
            if (($row['status'] ?? '') === 'PAID') {
                $deposit = $rows[$i];
                return $rows;
            }
            if ((int) ($row['amountPaise'] ?? 0) !== $amountPaise && $amountPaise > 0) {
                $rows[$i]['status'] = 'AMOUNT_MISMATCH';
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

if ($deposit && ($deposit['status'] ?? '') === 'PAID' && empty($deposit['_credited'])) {
    payflow_wallet_credit((string) $deposit['uid'], (float) $deposit['amount'], [
        'provider' => 'RAZORPAY',
        'depositId' => $deposit['id'],
        'paymentId' => $paymentId,
        'utr' => $utr,
        'source' => 'webhook',
    ]);
}

json_response(['ok' => true]);
