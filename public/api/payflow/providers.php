<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$providers = [];
if (razorpay_is_configured()) {
    $providers[] = [
        'id' => 'RAZORPAY',
        'label' => 'Razorpay',
        'enabled' => true,
        'keyId' => RAZORPAY_KEY_ID,
    ];
} else {
    $providers[] = [
        'id' => 'RAZORPAY',
        'label' => 'Razorpay',
        'enabled' => true,
        'keyId' => '',
    ];
}

if (cashfree_is_configured()) {
    $providers[] = [
        'id' => 'CASHFREE',
        'label' => 'Cashfree',
        'enabled' => true,
        'environment' => cashfree_environment(),
    ];
} else {
    $providers[] = [
        'id' => 'CASHFREE',
        'label' => 'Cashfree',
        'enabled' => true,
        'environment' => 'sandbox',
    ];
}

json_response([
    'providers' => $providers,
    'primary' => razorpay_is_configured() ? 'RAZORPAY' : (cashfree_is_configured() ? 'CASHFREE' : 'RAZORPAY'),
    'demoMode' => payflow_demo_mode(),
]);
