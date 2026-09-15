<?php
require_once __DIR__ . '/../_bootstrap.php';

$agent = payflow_require_agent();
$uid = (string) $agent['uid'];
$full = payflow_find_agent(null, $uid);
if (!$full) {
    json_response(['error' => 'Agent not found'], 404);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response([
        'hasPin' => !empty($full['pinHash']),
        'locale' => $full['locale'] ?? 'en',
        'branding' => $full['branding'] ?? null,
        'kycStatus' => $full['kycStatus'] ?? 'pending',
        'parentUid' => $full['parentUid'] ?? null,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = read_json_body();
$action = (string) ($body['action'] ?? '');

if ($action === 'set_pin') {
    $pin = (string) ($body['pin'] ?? '');
    if (!preg_match('/^\d{4,6}$/', $pin)) {
        json_response(['error' => 'PIN must be 4–6 digits'], 400);
    }
    $full['pinHash'] = password_hash($pin, PASSWORD_DEFAULT);
    $full['updatedAt'] = gmdate('c');
    payflow_agent_save($full);
    json_response(['success' => true, 'hasPin' => true]);
}

if ($action === 'verify_pin') {
    $pin = (string) ($body['pin'] ?? '');
    if (empty($full['pinHash']) || !password_verify($pin, (string) $full['pinHash'])) {
        json_response(['error' => 'Incorrect PIN', 'ok' => false], 401);
    }
    json_response(['success' => true, 'ok' => true]);
}

if ($action === 'clear_pin') {
    $full['pinHash'] = null;
    $full['updatedAt'] = gmdate('c');
    payflow_agent_save($full);
    json_response(['success' => true, 'hasPin' => false]);
}

if ($action === 'set_locale') {
    $locale = strtolower(trim((string) ($body['locale'] ?? 'en')));
    if (!in_array($locale, ['en', 'hi'], true)) {
        json_response(['error' => 'Unsupported locale'], 400);
    }
    $full['locale'] = $locale;
    $full['updatedAt'] = gmdate('c');
    payflow_agent_save($full);
    json_response(['success' => true, 'locale' => $locale]);
}

if ($action === 'invite') {
    // Referral: create pending sub-retailer shell (admin still sets passcode) or return invite code
    $code = strtoupper(substr(md5($uid . 'invite'), 0, 8));
    json_response([
        'success' => true,
        'inviteCode' => $code,
        'parentUid' => $uid,
        'message' => 'Share this code with admin when onboarding a sub-retailer.',
    ]);
}

json_response(['error' => 'Unknown action'], 400);
