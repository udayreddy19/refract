<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

rate_limit_check('analytics_track', 60, 60);

$body = read_json_body();
$event = isset($body['event']) ? trim((string) $body['event']) : '';
$meta = isset($body['meta']) && is_array($body['meta']) ? $body['meta'] : [];
$allowed = [
    'pricing_view',
    'checkout_open',
    'payment_started',
    'payment_success',
    'payment_failed',
    'connector_fetch',
    'run_saved',
];
if ($event === '' || !in_array($event, $allowed, true)) {
    json_response(['error' => 'Invalid event.'], 400);
}

$session = current_user_session();
$uid = $session['uid'] ?? null;
track_analytics($event, $meta, is_string($uid) ? $uid : null);
json_response(['success' => true]);
