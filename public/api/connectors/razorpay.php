<?php
/**
 * Fetch Razorpay captured payments for a date range (uses platform Razorpay keys).
 * Useful as a payments-side CSV for recon against Shopify/orders.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$session = require_user();
rate_limit_check('connector_razorpay', 10, 60);

if (!razorpay_is_configured()) {
    json_response(['error' => 'Razorpay is not configured on this server.'], 503);
}

$body = read_json_body();
$from = isset($body['from']) ? strtotime((string) $body['from']) : strtotime('-7 days');
$to = isset($body['to']) ? strtotime((string) $body['to']) : time();
if ($from === false || $to === false) {
    json_response(['error' => 'Invalid from/to dates.'], 400);
}
$count = isset($body['count']) ? min(100, max(1, (int) $body['count'])) : 50;

$path = 'payments?from=' . $from . '&to=' . $to . '&count=' . $count;
$res = razorpay_api('GET', $path, null);
if (empty($res['ok'])) {
    json_response(['error' => $res['error'] ?? 'Razorpay fetch failed.'], 502);
}

$items = $res['body']['items'] ?? [];
$rows = [];
foreach ($items as $item) {
    if (!is_array($item)) {
        continue;
    }
    $rows[] = [
        'payment_id' => (string) ($item['id'] ?? ''),
        'order_id' => (string) ($item['order_id'] ?? ''),
        'amount' => isset($item['amount']) ? round(((int) $item['amount']) / 100, 2) : 0,
        'fee' => isset($item['fee']) ? round(((int) $item['fee']) / 100, 2) : 0,
        'currency' => (string) ($item['currency'] ?? 'INR'),
        'status' => (string) ($item['status'] ?? ''),
        'method' => (string) ($item['method'] ?? ''),
        'email' => (string) ($item['email'] ?? ''),
        'created_at' => isset($item['created_at']) ? gmdate('c', (int) $item['created_at']) : '',
        'source' => 'razorpay',
    ];
}

$user = find_user_by_uid((string) $session['uid']);
$connections = is_array($user['connections'] ?? null) ? $user['connections'] : [];
$found = false;
foreach ($connections as $i => $c) {
    if (($c['provider'] ?? '') === 'razorpay') {
        $connections[$i]['status'] = 'live';
        $connections[$i]['notes'] = 'Last payout fetch ' . gmdate('c');
        $found = true;
        break;
    }
}
if (!$found) {
    $connections[] = [
        'provider' => 'razorpay',
        'label' => 'Razorpay',
        'status' => 'live',
        'notes' => 'API fetch enabled',
    ];
}
update_user((string) $session['uid'], ['connections' => $connections]);

track_analytics('connector_fetch', ['provider' => 'razorpay', 'rows' => count($rows)], (string) $session['uid']);

json_response([
    'success' => true,
    'provider' => 'razorpay',
    'rows' => $rows,
    'count' => count($rows),
    'csvHint' => 'Map payment_id / amount / created_at into the Payments channel.',
]);
