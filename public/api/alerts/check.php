<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$session = require_user();
rate_limit_check('risk_alert', 10, 60);
$body = read_json_body();

$summary = isset($body['summary']) && is_array($body['summary']) ? $body['summary'] : null;
if (!$summary) {
    json_response(['error' => 'summary required.'], 400);
}

$run = [
    'id' => (string) ($body['runId'] ?? ('adhoc_' . bin2hex(random_bytes(4)))),
    'label' => substr(trim((string) ($body['label'] ?? 'Live recon')), 0, 120),
    'email' => $session['email'] ?? '',
    'summary' => [
        'amountAtRiskPaise' => (int) ($summary['amountAtRiskPaise'] ?? 0),
        'exceptionCount' => (int) ($summary['exceptionCount'] ?? 0),
    ],
];

$user = find_user_by_uid((string) $session['uid']);
$result = maybe_send_risk_alert($run, $user ?: $session);
json_response(['success' => true, 'alert' => $result, 'settings' => [
    'enabled' => !empty(get_alert_settings()['enabled']),
    'thresholdInr' => (int) (get_alert_settings()['thresholdInr'] ?? 0),
]]);
