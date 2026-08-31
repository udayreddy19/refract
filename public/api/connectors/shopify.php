<?php
/**
 * Fetch Shopify orders as recon-ready CSV-style rows (Admin API access token).
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$session = require_user();
rate_limit_check('connector_shopify', 10, 60);

$body = read_json_body();
$shop = isset($body['shop']) ? strtolower(trim((string) $body['shop'])) : '';
$token = isset($body['accessToken']) ? trim((string) $body['accessToken']) : '';
$limit = isset($body['limit']) ? min(100, max(1, (int) $body['limit'])) : 50;

$shop = preg_replace('#^https?://#', '', $shop);
$shop = rtrim($shop, '/');
if (strpos($shop, '.myshopify.com') === false) {
    if (preg_match('/^[a-z0-9\-]+$/i', $shop)) {
        $shop .= '.myshopify.com';
    }
}

if ($shop === '' || $token === '') {
    json_response(['error' => 'shop and accessToken are required.'], 400);
}

$url = 'https://' . $shop . '/admin/api/2024-01/orders.json?status=any&limit=' . $limit;
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'X-Shopify-Access-Token: ' . $token,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT => 45,
]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($raw === false) {
    json_response(['error' => $err !== '' ? $err : 'Shopify request failed.'], 502);
}

$data = json_decode($raw, true);
if ($status < 200 || $status >= 300 || !is_array($data)) {
    $msg = is_array($data) ? (string) ($data['errors'] ?? $data['error'] ?? 'Shopify API error') : 'Shopify API error';
    json_response(['error' => $msg, 'status' => $status], 502);
}

$orders = $data['orders'] ?? [];
$rows = [];
foreach ($orders as $order) {
    if (!is_array($order)) {
        continue;
    }
    $rows[] = [
        'order_id' => (string) ($order['name'] ?? $order['id'] ?? ''),
        'order_number' => (string) ($order['order_number'] ?? ''),
        'email' => (string) ($order['email'] ?? ''),
        'created_at' => (string) ($order['created_at'] ?? ''),
        'total_price' => (string) ($order['total_price'] ?? '0'),
        'currency' => (string) ($order['currency'] ?? 'INR'),
        'financial_status' => (string) ($order['financial_status'] ?? ''),
        'gateway' => (string) (($order['payment_gateway_names'][0] ?? '') ?: ''),
        'source' => 'shopify',
    ];
}

// Persist connection note
$user = find_user_by_uid((string) $session['uid']);
$connections = is_array($user['connections'] ?? null) ? $user['connections'] : [];
$found = false;
foreach ($connections as $i => $c) {
    if (($c['provider'] ?? '') === 'shopify') {
        $connections[$i]['status'] = 'live';
        $connections[$i]['notes'] = 'Last fetch ' . gmdate('c') . ' · ' . $shop;
        $found = true;
        break;
    }
}
if (!$found) {
    $connections[] = [
        'provider' => 'shopify',
        'label' => 'Shopify',
        'status' => 'live',
        'notes' => $shop,
    ];
}
update_user((string) $session['uid'], ['connections' => $connections]);

track_analytics('connector_fetch', ['provider' => 'shopify', 'rows' => count($rows)], (string) $session['uid']);

json_response([
    'success' => true,
    'provider' => 'shopify',
    'shop' => $shop,
    'rows' => $rows,
    'count' => count($rows),
    'csvHint' => 'Map order_id / total_price / created_at into the Orders channel.',
]);
