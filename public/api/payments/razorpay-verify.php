<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

if (!razorpay_is_configured()) {
    json_response(['error' => 'Razorpay is not configured on the server.'], 503);
}

$sessionUser = require_user();
rate_limit_check('razorpay_verify', 20, 60);
$body = read_json_body();

$orderId = isset($body['razorpay_order_id']) ? trim((string) $body['razorpay_order_id']) : '';
$subscriptionId = isset($body['razorpay_subscription_id']) ? trim((string) $body['razorpay_subscription_id']) : '';
$paymentId = isset($body['razorpay_payment_id']) ? trim((string) $body['razorpay_payment_id']) : '';
$signature = isset($body['razorpay_signature']) ? trim((string) $body['razorpay_signature']) : '';

if ($paymentId === '' || $signature === '') {
    json_response(['error' => 'Missing Razorpay payment fields.'], 400);
}

if ($subscriptionId !== '') {
    $expected = hash_hmac('sha256', $paymentId . '|' . $subscriptionId, RAZORPAY_KEY_SECRET);
    if (!hash_equals($expected, $signature)) {
        json_response(['error' => 'Invalid subscription payment signature.'], 400);
    }
} else {
    if ($orderId === '') {
        json_response(['error' => 'Missing Razorpay order id.'], 400);
    }
    if (!razorpay_verify_payment_signature($orderId, $paymentId, $signature)) {
        json_response(['error' => 'Invalid payment signature.'], 400);
    }
}

$fetch = razorpay_api('GET', 'payments/' . rawurlencode($paymentId));
if (!$fetch['ok']) {
    json_response(['error' => $fetch['error'] ?: 'Could not verify payment with Razorpay.'], 502);
}
$rpPayment = $fetch['body'];
$status = (string) ($rpPayment['status'] ?? '');
if (!in_array($status, ['captured', 'authorized'], true)) {
    json_response(['error' => 'Payment is not completed yet (status: ' . $status . ').'], 400);
}

$bag = [
    'error' => null,
    'http' => 200,
    'payment' => null,
];

mutate_store('payments.json', function ($payments) use ($sessionUser, $orderId, $subscriptionId, $paymentId, $status, &$bag) {
    if (!is_array($payments)) {
        $payments = [];
    }

    $idx = -1;
    foreach ($payments as $i => $row) {
        if ($subscriptionId !== '' && ($row['razorpaySubscriptionId'] ?? '') === $subscriptionId) {
            $idx = $i;
            break;
        }
        if ($orderId !== '' && ($row['razorpayOrderId'] ?? '') === $orderId) {
            $idx = $i;
            break;
        }
    }

    if ($idx < 0) {
        $bag['error'] = 'Payment order not found.';
        $bag['http'] = 404;
        return $payments;
    }

    if (($payments[$idx]['userId'] ?? '') !== ($sessionUser['uid'] ?? '')) {
        $bag['error'] = 'This payment does not belong to your account.';
        $bag['http'] = 403;
        return $payments;
    }

    if (($payments[$idx]['status'] ?? '') === 'approved') {
        $bag['payment'] = $payments[$idx];
        return $payments;
    }

    $payments[$idx]['status'] = 'approved';
    $payments[$idx]['method'] = 'razorpay';
    $payments[$idx]['razorpayPaymentId'] = $paymentId;
    $payments[$idx]['utr'] = $paymentId;
    if ($subscriptionId !== '') {
        $payments[$idx]['razorpaySubscriptionId'] = $subscriptionId;
        $payments[$idx]['autoRenew'] = true;
    }
    $payments[$idx]['reviewedAt'] = gmdate('c');
    $payments[$idx]['note'] = 'Auto-approved via Razorpay (' . $status . ')';
    $bag['payment'] = $payments[$idx];
    return $payments;
}, []);

if ($bag['error'] !== null) {
    json_response(['error' => $bag['error']], (int) $bag['http']);
}

$payment = $bag['payment'];
if (!$payment) {
    json_response(['error' => 'Payment not found.'], 404);
}

activate_pro_from_payment($payment, 'client_verify');

json_response([
    'success' => true,
    'message' => 'Payment verified. ReconcileX Pro is now active.',
    'payment' => $payment,
    'user' => [
        'isPro' => true,
        'selectedPlan' => $payment['plan'] ?? null,
    ],
]);
