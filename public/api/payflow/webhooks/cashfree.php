<?php
require_once __DIR__ . '/../_bootstrap.php';

$raw = file_get_contents('php://input') ?: '';
$headers = [
    'x-webhook-signature' => $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? $_SERVER['HTTP_X_CF_SIGNATURE'] ?? '',
    'x-webhook-timestamp' => $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'] ?? $_SERVER['HTTP_X_CF_TIMESTAMP'] ?? '',
];

if (CASHFREE_WEBHOOK_SECRET === '' && payflow_is_production()) {
    json_response(['error' => 'Webhook secret not configured'], 503);
}
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

$result = payflow_deposit_mark_paid_and_claim_credit($orderId, $paymentId, $utr, null, $orderId);
$deposit = $result['deposit'];

if ($result['shouldCredit'] && is_array($deposit)) {
    $creditAmount = $amount > 0 ? $amount : (float) ($deposit['amount'] ?? 0);
    payflow_wallet_credit((string) $deposit['uid'], $creditAmount, [
        'provider' => 'CASHFREE',
        'type' => 'wallet_add',
        'depositId' => $deposit['id'],
        'paymentId' => $paymentId,
        'utr' => $utr,
        'source' => 'webhook',
        'agentId' => $deposit['agentId'] ?? '',
    ]);
}

json_response(['ok' => true, 'credited' => !empty($result['shouldCredit'])]);
