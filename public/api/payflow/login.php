<?php
require_once __DIR__ . '/_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = read_json_body();
$agentId = strtoupper(trim((string) ($body['agentId'] ?? '')));
$name = trim((string) ($body['name'] ?? $agentId));
$email = trim((string) ($body['email'] ?? ''));
$mobile = trim((string) ($body['mobile'] ?? ''));
$idToken = payflow_get_bearer_token();

if ($idToken !== '') {
    $fb = payflow_verify_firebase_id_token($idToken);
    if ($fb) {
        $email = (string) ($fb['email'] ?? $email);
        $name = (string) ($fb['displayName'] ?? $name);
        if ($agentId === '') {
            $agentId = strtoupper(explode('@', $email)[0] ?: 'AGENT');
        }
        $uid = 'agent_' . ($fb['localId'] ?? bin2hex(random_bytes(6)));
        $_SESSION['payflow_agent'] = [
            'uid' => $uid,
            'agentId' => $agentId,
            'email' => $email,
            'name' => $name !== '' ? $name : $agentId,
            'mobile' => $mobile,
            'firebaseUid' => $fb['localId'] ?? null,
        ];
        json_response([
            'success' => true,
            'agent' => $_SESSION['payflow_agent'],
            'balance' => payflow_wallet_get($uid),
            'auth' => 'firebase',
        ]);
    }
}

// Seeded agent accounts (mirrors frontend mock registry for PHP session)
$accounts = [
    'AGENT1001' => ['passcode' => '123456', 'name' => 'AGENT USER', 'email' => 'agent@example.com', 'mobile' => '9000000000'],
    'AGENTPROD' => ['passcode' => 'PayFlow@2026', 'name' => 'PROD AGENT', 'email' => 'prod@payflow.agent', 'mobile' => '9876543210'],
];

$passcode = (string) ($body['passcode'] ?? '');
if ($agentId === '' || !isset($accounts[$agentId])) {
    json_response(['error' => 'Invalid Agent ID or Passcode'], 401);
}
if ($passcode !== '' && $passcode !== $accounts[$agentId]['passcode']) {
    json_response(['error' => 'Invalid Agent ID or Passcode'], 401);
}

$acc = $accounts[$agentId];
$uid = 'agent_' . strtolower($agentId);
$_SESSION['payflow_agent'] = [
    'uid' => $uid,
    'agentId' => $agentId,
    'email' => $email !== '' ? $email : $acc['email'],
    'name' => $name !== '' ? $name : $acc['name'],
    'mobile' => $mobile !== '' ? $mobile : $acc['mobile'],
];

json_response([
    'success' => true,
    'agent' => $_SESSION['payflow_agent'],
    'balance' => payflow_wallet_get($uid),
    'auth' => 'local',
]);
