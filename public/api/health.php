<?php
require_once __DIR__ . '/config.php';

$checks = [];
$ok = true;

$checks['php'] = [
    'ok' => true,
    'detail' => PHP_VERSION,
];

$checks['session'] = [
    'ok' => session_status() === PHP_SESSION_ACTIVE,
    'detail' => session_status() === PHP_SESSION_ACTIVE ? 'active' : 'inactive',
];
$ok = $ok && $checks['session']['ok'];

$checks['data_dir'] = [
    'ok' => is_dir(DATA_DIR) && is_writable(DATA_DIR),
    'detail' => DATA_DIR,
];
$ok = $ok && $checks['data_dir']['ok'];

$checks['google_oauth'] = [
    'ok' => google_is_configured(),
    'detail' => google_is_configured() ? 'configured' : 'missing secrets',
];

$checks['admin_password'] = [
    'ok' => admin_password_configured(),
    'detail' => admin_password_configured() ? 'configured' : 'change default',
];

$checks['razorpay'] = [
    'ok' => razorpay_is_configured(),
    'detail' => razorpay_is_configured() ? 'configured' : 'missing keys (UPI manual still available)',
];

$checks['sqlite'] = [
    'ok' => sqlite_available(),
    'detail' => sqlite_available() ? 'available (dual-write)' : 'unavailable — JSON only',
];

$checks['mail'] = [
    'ok' => function_exists('mail'),
    'detail' => function_exists('mail') ? 'mail() present' : 'mail() missing',
];

$checks['gemini'] = [
    'ok' => gemini_is_configured(),
    'detail' => gemini_is_configured() ? 'configured (AI explains)' : 'rules-only explains (optional GEMINI_API_KEY)',
];

json_response([
    'ok' => $ok,
    'service' => 'ReconcileX',
    'time' => gmdate('c'),
    'checks' => $checks,
], $ok ? 200 : 503);
