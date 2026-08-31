<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

if (!feature_enabled('trialCodes')) {
    json_response(['error' => 'Trial codes are disabled.'], 403);
}

$session = require_user();
rate_limit_check('trial_redeem', 8, 60);
$body = read_json_body();
$code = strtoupper(trim((string) ($body['code'] ?? '')));
if ($code === '' || strlen($code) < 4) {
    json_response(['error' => 'Enter a valid trial code.'], 400);
}

$user = find_user_by_uid((string) $session['uid']);
if ($user && user_has_active_pro($user) && ($user['plan'] ?? '') !== 'trial') {
    json_response(['error' => 'You already have an active Pro plan.'], 409);
}

$bag = ['error' => null, 'http' => 200, 'code' => null];
mutate_store('trial_codes.json', function ($rows) use ($code, &$bag) {
    if (!is_array($rows)) {
        $rows = [];
    }
    foreach ($rows as $i => $row) {
        if (strtoupper((string) ($row['code'] ?? '')) !== $code) {
            continue;
        }
        if (empty($row['active'])) {
            $bag['error'] = 'This code is inactive.';
            $bag['http'] = 400;
            return $rows;
        }
        if ((int) ($row['used'] ?? 0) >= (int) ($row['maxUses'] ?? 0)) {
            $bag['error'] = 'This code has reached its usage limit.';
            $bag['http'] = 400;
            return $rows;
        }
        $rows[$i]['used'] = (int) ($row['used'] ?? 0) + 1;
        $bag['code'] = $rows[$i];
        return $rows;
    }
    $bag['error'] = 'Invalid trial code.';
    $bag['http'] = 404;
    return $rows;
}, []);

if ($bag['error']) {
    json_response(['error' => $bag['error']], (int) $bag['http']);
}

$days = (int) ($bag['code']['days'] ?? 7);
$updated = grant_trial_pro((string) $session['uid'], $days, 'code:' . $code);
if (!$updated) {
    json_response(['error' => 'Could not activate trial.'], 500);
}

set_user_session(array_merge($session, [
    'isPro' => true,
    'selectedPlan' => 'trial',
    'paymentStatus' => 'approved',
]));

json_response([
    'success' => true,
    'message' => "Pro trial activated for {$days} days.",
    'days' => $days,
    'proExpiresAt' => $updated['proExpiresAt'] ?? null,
]);
