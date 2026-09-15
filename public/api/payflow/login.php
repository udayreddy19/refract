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

// Optional Firebase path — only succeed if retailer exists in registry.
// If Firebase is valid but no retailer row, fall through to Agent ID + passcode.
if ($idToken !== '') {
    $fb = payflow_verify_firebase_id_token($idToken);
    if ($fb) {
        $email = (string) ($fb['email'] ?? $email);
        $name = (string) ($fb['displayName'] ?? $name);
        if ($agentId === '' && $email !== '') {
            $agentId = strtoupper(explode('@', $email)[0] ?: '');
        }

        $registered = payflow_find_agent($agentId !== '' ? $agentId : null, null, null);
        if (!$registered && $email !== '') {
            foreach (payflow_agents_all() as $row) {
                if (strcasecmp((string) ($row['email'] ?? ''), $email) === 0) {
                    $registered = $row;
                    break;
                }
            }
        }
        if ($registered) {
            $block = payflow_agent_can_transact($registered);
            if ($block) {
                json_response(['error' => $block], 403);
            }
            $registered['email'] = $email !== '' ? $email : (string) ($registered['email'] ?? '');
            $registered['name'] = $name !== '' ? $name : (string) ($registered['name'] ?? $registered['agentId']);
            $registered['firebaseUid'] = $fb['localId'] ?? null;
            payflow_login_success($registered, 'firebase');
        }
    }
}

if ($agentId === '') {
    json_response(['error' => 'Agent ID is required'], 400);
}
if ($passcode === '') {
    json_response(['error' => 'Passcode is required'], 400);
}

// Look up by Agent ID only (do not treat Agent ID as mobile).
$agent = payflow_find_agent($agentId, null, null);
if (!$agent) {
    json_response([
        'error' => 'Invalid Agent ID or Passcode. Ask admin to create your retailer account (or run Import JSON → MySQL).',
    ], 401);
}

$block = payflow_agent_can_transact($agent);
if ($block) {
    json_response(['error' => $block], 403);
}

$stored = (string) ($agent['passcode'] ?? '');
if ($stored === '' || !payflow_verify_passcode($passcode, $stored)) {
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

payflow_login_success($agent, 'local');
