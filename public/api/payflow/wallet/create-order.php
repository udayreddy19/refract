<?php
require_once __DIR__ . '/../_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$agent = payflow_require_agent();
rate_limit_check('payflow_create_order', 20, 60);

$body = read_json_body();
$amount = round((float) ($body['amount'] ?? 0), 2);
$provider = strtoupper(trim((string) ($body['provider'] ?? 'RAZORPAY')));
$customerName = trim((string) ($body['customerName'] ?? $agent['name'] ?? ''));
$mobile = preg_replace('/\D+/', '', (string) ($body['mobile'] ?? $agent['mobile'] ?? ''));
$email = trim((string) ($body['email'] ?? $agent['email'] ?? ''));
$category = trim((string) ($body['category'] ?? ''));

if ($amount < 100 || $amount > 100000) {
    json_response(['error' => 'Amount must be between ₹100 and ₹1,00,000'], 400);
}
if (!in_array($provider, ['RAZORPAY', 'CASHFREE'], true)) {
    json_response(['error' => 'Invalid payment provider'], 400);
}

$depositId = 'dep_' . bin2hex(random_bytes(8));
$amountPaise = (int) round($amount * 100);
$demoMode = payflow_demo_mode();

$deposit = [
    'id' => $depositId,
    'uid' => $agent['uid'],
    'agentId' => $agent['agentId'] ?? '',
    'provider' => $provider,
    'amount' => $amount,
    'amountPaise' => $amountPaise,
    'customerName' => $customerName,
    'mobile' => $mobile,
    'email' => $email,
    'category' => $category,
    'status' => 'CREATED',
    'orderId' => null,
    'paymentSessionId' => null,
    'paymentId' => null,
    'utr' => null,
    'createdAt' => gmdate('c'),
    'updatedAt' => gmdate('c'),
];

if ($provider === 'RAZORPAY') {
    if (!razorpay_is_configured()) {
        if (payflow_demo_mode()) {
            $deposit['orderId'] = 'order_demo_' . time();
            $deposit['status'] = 'CREATED';
            $deposit['demoMode'] = true;
            mutate_store('payflow_deposits.json', function ($rows) use ($deposit) {
                if (!is_array($rows)) $rows = [];
                $rows[] = $deposit;
                return $rows;
            }, []);
            json_response([
                'success' => true,
                'demoMode' => true,
                'provider' => 'RAZORPAY',
                'depositId' => $depositId,
                'orderId' => $deposit['orderId'],
                'amount' => $amount,
                'amountPaise' => $amountPaise,
                'keyId' => RAZORPAY_KEY_ID !== '' ? RAZORPAY_KEY_ID : 'rzp_test_demo',
            ]);
        }
        json_response(['error' => 'Razorpay is not configured. Add live keys in api/secrets.php.'], 503);
    }

    $api = razorpay_api('POST', 'orders', [
        'amount' => $amountPaise,
        'currency' => 'INR',
        'receipt' => substr($depositId, 0, 40),
        'notes' => [
            'depositId' => $depositId,
            'uid' => $agent['uid'],
            'agentId' => $agent['agentId'] ?? '',
            'product' => 'ReconcileX Wallet',
        ],
    ]);
    if (empty($api['ok']) || empty($api['body']['id'])) {
        json_response(['error' => $api['error'] ?: 'Failed to create Razorpay order'], 502);
    }
    $deposit['orderId'] = (string) $api['body']['id'];
    $deposit['status'] = 'CREATED';
    mutate_store('payflow_deposits.json', function ($rows) use ($deposit) {
        if (!is_array($rows)) $rows = [];
        $rows[] = $deposit;
        return $rows;
    }, []);

    json_response([
        'success' => true,
        'demoMode' => false,
        'provider' => 'RAZORPAY',
        'depositId' => $depositId,
        'orderId' => $deposit['orderId'],
        'amount' => $amount,
        'amountPaise' => $amountPaise,
        'keyId' => RAZORPAY_KEY_ID,
    ]);
}

// Cashfree
if (!cashfree_is_configured()) {
    if (payflow_demo_mode()) {
        $deposit['orderId'] = $depositId;
        $deposit['paymentSessionId'] = 'session_demo_' . time();
        $deposit['demoMode'] = true;
        mutate_store('payflow_deposits.json', function ($rows) use ($deposit) {
            if (!is_array($rows)) $rows = [];
            $rows[] = $deposit;
            return $rows;
        }, []);
        json_response([
            'success' => true,
            'demoMode' => true,
            'provider' => 'CASHFREE',
            'depositId' => $depositId,
            'orderId' => $deposit['orderId'],
            'paymentSessionId' => $deposit['paymentSessionId'],
            'amount' => $amount,
            'amountPaise' => $amountPaise,
            'environment' => cashfree_environment(),
        ]);
    }
    json_response(['error' => 'Cashfree is not configured. Add live keys in api/secrets.php.'], 503);
}

$notifyUrl = rtrim(APP_URL, '/') . '/api/payflow/webhooks/cashfree.php';
$returnUrl = rtrim(APP_URL, '/') . '/wallet';
$cf = cashfree_api('POST', 'orders', [
    'order_id' => $depositId,
    'order_amount' => $amount,
    'order_currency' => 'INR',
    'customer_details' => [
        'customer_id' => substr(preg_replace('/[^a-zA-Z0-9_-]/', '', $agent['uid']), 0, 50),
        'customer_phone' => $mobile !== '' ? $mobile : '9999999999',
        'customer_name' => $customerName !== '' ? $customerName : ($agent['name'] ?? 'Agent'),
    ],
    'order_meta' => [
        'return_url' => $returnUrl,
        'notify_url' => $notifyUrl,
    ],
    'order_note' => 'ReconcileX wallet top-up',
]);

if (empty($cf['ok']) || empty($cf['body']['payment_session_id'])) {
    json_response(['error' => $cf['error'] ?: 'Failed to create Cashfree order'], 502);
}

$deposit['orderId'] = (string) ($cf['body']['order_id'] ?? $depositId);
$deposit['paymentSessionId'] = (string) $cf['body']['payment_session_id'];
$deposit['cfOrderId'] = $cf['body']['cf_order_id'] ?? null;

mutate_store('payflow_deposits.json', function ($rows) use ($deposit) {
    if (!is_array($rows)) $rows = [];
    $rows[] = $deposit;
    return $rows;
}, []);

json_response([
    'success' => true,
    'demoMode' => false,
    'provider' => 'CASHFREE',
    'depositId' => $depositId,
    'orderId' => $deposit['orderId'],
    'paymentSessionId' => $deposit['paymentSessionId'],
    'amount' => $amount,
    'amountPaise' => $amountPaise,
    'environment' => cashfree_environment(),
]);
