<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = read_json_body();
$agentId = strtoupper(trim((string) ($body['agentId'] ?? '')));
$name = trim((string) ($body['name'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));
$mobile = trim((string) ($body['mobile'] ?? ''));
$passcode = (string) ($body['passcode'] ?? '');
$idToken = payflow_get_bearer_token();

function payflow_login_success(array $agent, string $auth): void
{
    $uid = (string) $agent['uid'];
    $_SESSION['payflow_agent'] = [
        'uid' => $uid,
        'agentId' => (string) $agent['agentId'],
        'email' => (string) ($agent['email'] ?? ''),
        'name' => (string) ($agent['name'] ?? $agent['agentId']),
        'mobile' => (string) ($agent['mobile'] ?? ''),
        'firebaseUid' => $agent['firebaseUid'] ?? null,
    ];
    payflow_agent_touch_login($uid);
    json_response([
        'success' => true,
        'agent' => [
            'uid' => $uid,
            'id' => $uid,
            'agentId' => (string) $agent['agentId'],
            'email' => (string) ($agent['email'] ?? ''),
            'name' => (string) ($agent['name'] ?? $agent['agentId']),
            'mobile' => (string) ($agent['mobile'] ?? ''),
            'avatarInitials' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', (string) ($agent['name'] ?? $agent['agentId'])) ?: 'RX', 0, 2)),
        ],
        'balance' => payflow_wallet_get($uid),
        'token' => 'session',
        'auth' => $auth,
    ]);
}

if ($idToken !== '') {
    $fb = payflow_verify_firebase_id_token($idToken);
    if (!$fb) {
        json_response(['error' => 'Invalid Firebase session. Sign in again.'], 401);
    }
    $email = (string) ($fb['email'] ?? $email);
    $name = (string) ($fb['displayName'] ?? $name);
    if ($agentId === '' && $email !== '') {
        $agentId = strtoupper(explode('@', $email)[0] ?: '');
    }

    $registered = payflow_find_agent($agentId !== '' ? $agentId : null, null, $mobile !== '' ? $mobile : null);
    if (!$registered && $email !== '') {
        foreach (payflow_agents_all() as $row) {
            if (strcasecmp((string) ($row['email'] ?? ''), $email) === 0) {
                $registered = $row;
                break;
            }
        }
    }
    if (!$registered) {
        json_response(['error' => 'No retailer account found for this login. Ask admin to create your Agent ID.'], 403);
    }
    if (($registered['status'] ?? 'active') === 'disabled') {
        json_response(['error' => 'This retailer account is disabled. Contact support.'], 403);
    }

    $registered['email'] = $email !== '' ? $email : (string) ($registered['email'] ?? '');
    $registered['name'] = $name !== '' ? $name : (string) ($registered['name'] ?? $registered['agentId']);
    $registered['firebaseUid'] = $fb['localId'] ?? null;
    payflow_login_success($registered, 'firebase');
}

if ($agentId === '' && $mobile === '') {
    json_response(['error' => 'Agent ID or mobile is required'], 400);
}
if ($passcode === '') {
    json_response(['error' => 'Passcode is required'], 400);
}

$agent = payflow_find_agent($agentId !== '' ? $agentId : null, null, $mobile !== '' ? $mobile : null);
if (!$agent) {
    json_response(['error' => 'Invalid Agent ID or Passcode'], 401);
}
if (($agent['status'] ?? 'active') === 'disabled') {
    json_response(['error' => 'This retailer account is disabled. Contact support.'], 403);
}

$stored = (string) ($agent['passcode'] ?? '');
if (!payflow_verify_passcode($passcode, $stored)) {
    json_response(['error' => 'Invalid Agent ID or Passcode'], 401);
}

if (payflow_passcode_needs_rehash($stored)) {
    payflow_agent_set_passcode((string) $agent['uid'], $passcode);
}

if ($email !== '') {
    $agent['email'] = $email;
}
if ($name !== '') {
    $agent['name'] = $name;
}
if ($mobile !== '') {
    $agent['mobile'] = preg_replace('/\D+/', '', $mobile);
}

payflow_login_success($agent, 'local');
