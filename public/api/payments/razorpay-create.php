<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

if (!razorpay_is_configured()) {
    json_response(['error' => 'Razorpay is not configured on the server.'], 503);
}

$sessionUser = require_user();
rate_limit_check('razorpay_create', 12, 60);

$body = read_json_body();
$plan = isset($body['plan']) ? trim((string) $body['plan']) : '';
$autoRenew = !empty($body['autoRenew']);

if (!in_array($plan, ['monthly', 'quarterly', 'annual'], true)) {
    json_response(['error' => 'Invalid plan.'], 400);
}

$amountInr = plan_amount($plan);
if ($amountInr <= 0) {
    json_response(['error' => 'Plan pricing is not configured.'], 500);
}

$amountPaise = $amountInr * 100;
track_analytics('payment_started', ['plan' => $plan, 'autoRenew' => $autoRenew], (string) ($sessionUser['uid'] ?? ''));

// Subscription (auto-renew) path
if ($autoRenew) {
    $planId = razorpay_ensure_plan_id($plan);
    if (!$planId) {
        json_response(['error' => 'Could not create Razorpay subscription plan. Try one-time payment.'], 502);
    }

    $subApi = razorpay_api('POST', 'subscriptions', [
        'plan_id' => $planId,
        'total_count' => $plan === 'annual' ? 10 : ($plan === 'quarterly' ? 20 : 36),
        'customer_notify' => 1,
        'notes' => [
            'uid' => $sessionUser['uid'] ?? '',
            'email' => $sessionUser['email'] ?? '',
            'plan' => $plan,
            'product' => 'ReconcileX Pro',
        ],
    ]);

    if (empty($subApi['ok']) || empty($subApi['body']['id'])) {
        json_response(['error' => $subApi['error'] ?: 'Failed to create Razorpay subscription.'], 502);
    }

    $subscriptionId = (string) $subApi['body']['id'];
    $payment = null;
    mutate_store('payments.json', function ($payments) use ($sessionUser, $plan, $amountInr, $subscriptionId, &$payment) {
        if (!is_array($payments)) {
            $payments = [];
        }
        foreach ($payments as $i => $row) {
            if (
                ($row['userId'] ?? '') === ($sessionUser['uid'] ?? '') &&
                ($row['status'] ?? '') === 'pending' &&
                ($row['method'] ?? '') === 'razorpay' &&
                empty($row['razorpayPaymentId'])
            ) {
                $payments[$i]['status'] = 'cancelled';
                $payments[$i]['reviewedAt'] = gmdate('c');
                $payments[$i]['note'] = 'Superseded by a new Razorpay subscription';
            }
        }
        $payment = [
            'id' => 'pay_' . bin2hex(random_bytes(8)),
            'userId' => $sessionUser['uid'],
            'email' => $sessionUser['email'] ?? '',
            'name' => $sessionUser['name'] ?? '',
            'plan' => $plan,
            'amount' => $amountInr,
            'utr' => '',
            'method' => 'razorpay',
            'autoRenew' => true,
            'razorpayOrderId' => null,
            'razorpaySubscriptionId' => $subscriptionId,
            'razorpayPaymentId' => null,
            'razorpayReceipt' => '',
            'status' => 'pending',
            'createdAt' => gmdate('c'),
            'reviewedAt' => null,
            'note' => '',
        ];
        $payments[] = $payment;
        return $payments;
    }, []);

    update_user((string) $sessionUser['uid'], [
        'pendingPaymentId' => $payment['id'] ?? null,
        'pendingPlan' => $plan,
        'autoRenew' => true,
    ]);

    json_response([
        'success' => true,
        'mode' => 'subscription',
        'keyId' => RAZORPAY_KEY_ID,
        'subscription' => [
            'id' => $subscriptionId,
        ],
        'order' => null,
        'payment' => $payment,
        'prefill' => [
            'name' => $sessionUser['name'] ?? '',
            'email' => $sessionUser['email'] ?? '',
        ],
    ]);
}

$receipt = 'rx_' . substr(bin2hex(random_bytes(6)), 0, 12);

$api = razorpay_api('POST', 'orders', [
    'amount' => $amountPaise,
    'currency' => 'INR',
    'receipt' => $receipt,
    'notes' => [
        'uid' => $sessionUser['uid'] ?? '',
        'email' => $sessionUser['email'] ?? '',
        'plan' => $plan,
        'product' => 'ReconcileX Pro',
    ],
]);

if (!$api['ok']) {
    json_response(['error' => $api['error'] ?: 'Failed to create Razorpay order.'], 502);
}

$order = $api['body'];
$orderId = (string) ($order['id'] ?? '');
if ($orderId === '') {
    json_response(['error' => 'Razorpay did not return an order id.'], 502);
}

$payment = null;
mutate_store('payments.json', function ($payments) use ($sessionUser, $plan, $amountInr, $orderId, $receipt, &$payment) {
    if (!is_array($payments)) {
        $payments = [];
    }

    foreach ($payments as $i => $row) {
        if (
            ($row['userId'] ?? '') === ($sessionUser['uid'] ?? '') &&
            ($row['status'] ?? '') === 'pending' &&
            ($row['method'] ?? '') === 'razorpay' &&
            empty($row['razorpayPaymentId'])
        ) {
            $payments[$i]['status'] = 'cancelled';
            $payments[$i]['reviewedAt'] = gmdate('c');
            $payments[$i]['note'] = 'Superseded by a new Razorpay order';
        }
    }

    $payment = [
        'id' => 'pay_' . bin2hex(random_bytes(8)),
        'userId' => $sessionUser['uid'],
        'email' => $sessionUser['email'] ?? '',
        'name' => $sessionUser['name'] ?? '',
        'plan' => $plan,
        'amount' => $amountInr,
        'utr' => '',
        'method' => 'razorpay',
        'autoRenew' => false,
        'razorpayOrderId' => $orderId,
        'razorpayPaymentId' => null,
        'razorpayReceipt' => $receipt,
        'status' => 'pending',
        'createdAt' => gmdate('c'),
        'reviewedAt' => null,
        'note' => '',
    ];
    $payments[] = $payment;
    return $payments;
}, []);

if (!$payment) {
    json_response(['error' => 'Failed to save payment record.'], 500);
}

update_user((string) $sessionUser['uid'], [
    'pendingPaymentId' => $payment['id'],
    'pendingPlan' => $plan,
    'autoRenew' => false,
]);

json_response([
    'success' => true,
    'mode' => 'order',
    'keyId' => RAZORPAY_KEY_ID,
    'order' => [
        'id' => $orderId,
        'amount' => $amountPaise,
        'currency' => 'INR',
        'receipt' => $receipt,
    ],
    'subscription' => null,
    'payment' => $payment,
    'prefill' => [
        'name' => $sessionUser['name'] ?? '',
        'email' => $sessionUser['email'] ?? '',
    ],
]);
