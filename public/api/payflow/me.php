<?php
require_once __DIR__ . '/_bootstrap.php';

$agent = payflow_require_agent();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response([
        'agent' => [
            'uid' => $agent['uid'],
            'id' => $agent['uid'],
            'agentId' => $agent['agentId'] ?? '',
            'name' => $agent['name'] ?? '',
            'email' => $agent['email'] ?? '',
            'mobile' => $agent['mobile'] ?? '',
            'avatarInitials' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', (string) ($agent['name'] ?? 'PF')) ?: 'PF', 0, 2)),
        ],
        'balance' => payflow_wallet_get((string) $agent['uid']),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json_body();
    $action = (string) ($body['action'] ?? '');
    if ($action === 'change_passcode') {
        $current = (string) ($body['currentPasscode'] ?? '');
        $next = (string) ($body['newPasscode'] ?? '');
        if (strlen($next) < 6) {
            json_response(['error' => 'New passcode must be at least 6 characters.'], 400);
        }
        $registered = payflow_find_agent(null, (string) $agent['uid']);
        if (!$registered) {
            json_response(['error' => 'Agent not found'], 404);
        }
        if (!payflow_verify_passcode($current, (string) ($registered['passcode'] ?? ''))) {
            json_response(['error' => 'Current passcode is incorrect'], 401);
        }
        payflow_agent_set_passcode((string) $agent['uid'], $next);
        append_audit('payflow_agent_change_passcode', ['uid' => $agent['uid'], 'agentId' => $agent['agentId'] ?? '']);
        json_response(['success' => true]);
    }
    if ($action === 'logout') {
        unset($_SESSION['payflow_agent']);
        json_response(['success' => true]);
    }
    json_response(['error' => 'Unknown action'], 400);
}

json_response(['error' => 'Method not allowed.'], 405);
