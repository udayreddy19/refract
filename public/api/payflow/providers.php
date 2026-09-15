<?php
require_once __DIR__ . '/_bootstrap.php';

json_response([
    'providers' => [
        [
            'id' => 'RAZORPAY',
            'label' => 'Razorpay',
            'enabled' => razorpay_is_configured(),
            'keyId' => razorpay_is_configured() ? RAZORPAY_KEY_ID : '',
        ],
        [
            'id' => 'CASHFREE',
            'label' => 'Cashfree',
            'enabled' => cashfree_is_configured(),
            'environment' => cashfree_environment(),
        ],
    ],
    'primary' => razorpay_is_configured()
        ? 'RAZORPAY'
        : (cashfree_is_configured() ? 'CASHFREE' : null),
    'demoMode' => payflow_demo_mode(),
]);
