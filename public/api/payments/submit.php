<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$sessionUser = require_user();
rate_limit_check('payment_submit', 8, 60);
$body = read_json_body();

$plan = isset($body['plan']) ? trim((string) $body['plan']) : '';
$utr = isset($body['utr']) ? strtoupper(trim((string) $body['utr'])) : '';

if (!in_array($plan, ['monthly', 'quarterly', 'annual'], true)) {
    json_response(['error' => 'Invalid plan.'], 400);
}

if ($utr === '' || strlen($utr) < 6) {
    json_response(['error' => 'Enter a valid UTR / UPI reference.'], 400);
}

$amount = plan_amount($plan);
if ($amount <= 0) {
    json_response(['error' => 'Plan pricing is not configured.'], 500);
}

$bag = [
    'error' => null,
    'status' => 200,
    'payment' => null,
    'conflictPayment' => null,
];

mutate_store('payments.json', function ($payments) use ($sessionUser, $plan, $utr, $amount, &$bag) {
    if (!is_array($payments)) {
        $payments = [];
    }

    foreach ($payments as $payment) {
        if (
            ($payment['userId'] ?? '') === ($sessionUser['uid'] ?? '') &&
            ($payment['status'] ?? '') === 'pending' &&
            ($payment['method'] ?? 'upi_manual') !== 'razorpay'
        ) {
            $bag['error'] = 'You already have a pending payment under review.';
            $bag['status'] = 409;
            $bag['conflictPayment'] = $payment;
            return $payments;
        }
        if (
            strtoupper((string) ($payment['utr'] ?? '')) === $utr &&
            ($payment['status'] ?? '') !== 'rejected'
        ) {
            $bag['error'] = 'This UTR was already submitted.';
            $bag['status'] = 409;
            return $payments;
        }
    }

    $payment = [
        'id' => 'pay_' . bin2hex(random_bytes(8)),
        'userId' => $sessionUser['uid'],
        'email' => $sessionUser['email'] ?? '',
        'name' => $sessionUser['name'] ?? '',
        'plan' => $plan,
        'amount' => $amount,
        'utr' => $utr,
        'method' => 'upi_manual',
        'status' => 'pending',
        'createdAt' => gmdate('c'),
        'reviewedAt' => null,
        'note' => '',
    ];

    $payments[] = $payment;
    $bag['payment'] = $payment;
    return $payments;
}, []);

if ($bag['error'] !== null) {
    $payload = ['error' => $bag['error']];
    if ($bag['conflictPayment']) {
        $payload['payment'] = $bag['conflictPayment'];
    }
    json_response($payload, (int) $bag['status']);
}

$payment = $bag['payment'];
if (!$payment) {
    json_response(['error' => 'Failed to save payment.'], 500);
}

update_user($sessionUser['uid'], [
    'pendingPaymentId' => $payment['id'],
    'pendingPlan' => $plan,
]);

set_user_session(array_merge($sessionUser, [
    'paymentStatus' => 'pending',
    'selectedPlan' => $plan,
    'utrValue' => $utr,
]));

notify_payment_submitted($sessionUser, $payment);
track_analytics('payment_started', ['plan' => $plan, 'method' => 'upi_manual'], (string) $sessionUser['uid']);

json_response([
    'success' => true,
    'message' => 'UTR submitted. An admin will verify and activate Pro.',
    'payment' => $payment,
]);
