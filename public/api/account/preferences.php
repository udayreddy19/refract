<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$sessionUser = require_user();
$body = read_json_body();
$patch = [];

if (array_key_exists('reminderHour', $body)) {
    $hour = (int) $body['reminderHour'];
    if ($hour < 0 || $hour > 23) {
        json_response(['error' => 'reminderHour must be 0–23.'], 400);
    }
    $patch['reminderHour'] = $hour;
}

if (array_key_exists('teamName', $body)) {
    $patch['teamName'] = substr(trim((string) $body['teamName']), 0, 80);
}

if (array_key_exists('connections', $body) && is_array($body['connections'])) {
    $clean = [];
    foreach ($body['connections'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $provider = trim((string) ($row['provider'] ?? ''));
        if ($provider === '') {
            continue;
        }
        $clean[] = [
            'provider' => substr($provider, 0, 40),
            'label' => substr(trim((string) ($row['label'] ?? '')), 0, 80),
            'status' => in_array(($row['status'] ?? ''), ['planned', 'csv', 'live'], true)
                ? $row['status']
                : 'planned',
            'notes' => substr(trim((string) ($row['notes'] ?? '')), 0, 200),
        ];
    }
    $patch['connections'] = $clean;
}

if (!$patch) {
    json_response(['error' => 'No valid fields to update.'], 400);
}

$updated = update_user((string) $sessionUser['uid'], $patch);
if (!$updated) {
    // First preference write after Google login should exist; upsert soft record
    $updated = upsert_user(array_merge($sessionUser, $patch));
}

set_user_session(array_merge($sessionUser, [
    'reminderHour' => $updated['reminderHour'] ?? 9,
    'teamName' => $updated['teamName'] ?? '',
    'connections' => $updated['connections'] ?? [],
]));

json_response(['success' => true, 'user' => $updated]);
