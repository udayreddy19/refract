<?php
require_once __DIR__ . '/../_bootstrap.php';

$raw = file_get_contents('php://input') ?: '';
$signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

if (RAZORPAY_WEBHOOK_SECRET === '') {
    if (payflow_is_production()) {
        json_response(['error' => 'Webhook secret not configured'], 503);
    }
} else {
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

$orderId = (string) ($paymentEntity['order_id'] ?? (is_array($orderEntity) ? ($orderEntity['id'] ?? '') : ''));
$paymentId = (string) ($paymentEntity['id'] ?? '');
$amountPaise = (int) ($paymentEntity['amount'] ?? 0);
$utr = (string) (($paymentEntity['acquirer_data']['rrn'] ?? null)
    ?: ($paymentEntity['acquirer_data']['upi_transaction_id'] ?? $paymentId));
$depositIdHint = (string) ($paymentEntity['notes']['depositId'] ?? '');

$result = payflow_deposit_mark_paid_and_claim_credit(
    $orderId,
    $paymentId,
    $utr,
    $amountPaise > 0 ? $amountPaise : null,
    $depositIdHint !== '' ? $depositIdHint : null
);

$deposit = $result['deposit'];
if ($result['shouldCredit'] && is_array($deposit)) {
    payflow_wallet_credit((string) $deposit['uid'], (float) $deposit['amount'], [
        'provider' => 'RAZORPAY',
        'type' => 'wallet_add',
        'depositId' => $deposit['id'],
        'paymentId' => $paymentId,
        'utr' => $utr,
        'source' => 'webhook',
        'agentId' => $deposit['agentId'] ?? '',
    ]);
}

json_response(['ok' => true, 'credited' => !empty($result['shouldCredit'])]);
