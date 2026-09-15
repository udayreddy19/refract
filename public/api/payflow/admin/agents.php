<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $q = strtolower(trim((string) ($_GET['q'] ?? '')));
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    $agents = [];
    foreach (payflow_agents_all() as $agent) {
        $pub = payflow_agent_public($agent, true);
        if ($status !== '' && strtolower((string) $pub['status']) !== $status) {
            continue;
        }
        if ($q !== '') {
            $hay = strtolower(implode(' ', [
                $pub['agentId'],
                $pub['name'],
                $pub['email'],
                $pub['mobile'],
                $pub['city'],
                $pub['kycStatus'] ?? '',
            ]));
            if (strpos($hay, $q) === false) {
                continue;
            }
        }
        $agents[] = $pub;
    }
    usort($agents, static function ($a, $b) {
        return strcmp((string) ($a['agentId'] ?? ''), (string) ($b['agentId'] ?? ''));
    });
    json_response(['agents' => $agents]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_role(['super', 'billing']);

$body = read_json_body();
$action = (string) ($body['action'] ?? '');

if ($action === 'create') {
    require_admin_role(['super']);
    $agentId = strtoupper(trim((string) ($body['agentId'] ?? '')));
    $name = trim((string) ($body['name'] ?? ''));
    $passcode = (string) ($body['passcode'] ?? '');
    $email = trim((string) ($body['email'] ?? ''));
    $mobile = preg_replace('/\D+/', '', (string) ($body['mobile'] ?? ''));
    $city = trim((string) ($body['city'] ?? ''));
    $notes = trim((string) ($body['notes'] ?? ''));
    $parentUid = trim((string) ($body['parentUid'] ?? ''));
    $kycStatus = strtolower(trim((string) ($body['kycStatus'] ?? 'pending')));
    if (!in_array($kycStatus, ['pending', 'verified', 'blocked'], true)) {
        $kycStatus = 'pending';
    }

    if ($agentId === '' || !preg_match('/^[A-Z0-9]{4,32}$/', $agentId)) {
        json_response(['error' => 'Agent ID must be 4–32 alphanumeric characters.'], 400);
    }
    if ($name === '') {
        json_response(['error' => 'Name is required.'], 400);
    }
    if (strlen($passcode) < 6) {
        json_response(['error' => 'Passcode must be at least 6 characters.'], 400);
    }
    if (payflow_find_agent($agentId) !== null) {
        json_response(['error' => 'Agent ID already exists.'], 409);
    }
    if ($email === '') {
        $email = strtolower($agentId) . '@payflow.agent';
    }

    $uid = 'agent_' . strtolower($agentId);
    $now = gmdate('c');
    $created = [
        'uid' => $uid,
        'agentId' => $agentId,
        'name' => $name,
        'email' => $email,
        'mobile' => $mobile,
        'passcode' => payflow_hash_passcode($passcode),
        'status' => 'active',
        'kycStatus' => $kycStatus,
        'city' => $city,
        'notes' => $notes,
        'parentUid' => $parentUid !== '' ? $parentUid : null,
        'createdAt' => $now,
        'updatedAt' => $now,
        'lastLoginAt' => null,
    ];
    payflow_agent_save($created);
    payflow_admin_audit('payflow_agent_create', ['agentId' => $agentId, 'uid' => $uid]);
    json_response(['success' => true, 'agent' => payflow_agent_public($created, true)]);
}

if ($action === 'bulk_create') {
    require_admin_role(['super']);
    $rows = $body['rows'] ?? [];
    if (!is_array($rows) || count($rows) === 0) {
        json_response(['error' => 'No rows provided.'], 400);
    }
    $created = [];
    $errors = [];
    foreach ($rows as $i => $row) {
        if (!is_array($row)) {
            $errors[] = ['row' => $i + 1, 'error' => 'Invalid row'];
            continue;
        }
        $agentId = strtoupper(trim((string) ($row['agentId'] ?? '')));
        $name = trim((string) ($row['name'] ?? ''));
        $passcode = (string) ($row['passcode'] ?? '');
        $email = trim((string) ($row['email'] ?? ''));
        $mobile = preg_replace('/\D+/', '', (string) ($row['mobile'] ?? ''));
        $city = trim((string) ($row['city'] ?? ''));
        if ($agentId === '' || !preg_match('/^[A-Z0-9]{4,32}$/', $agentId) || $name === '' || strlen($passcode) < 6) {
            $errors[] = ['row' => $i + 1, 'agentId' => $agentId, 'error' => 'Invalid fields'];
            continue;
        }
        if (payflow_find_agent($agentId) !== null) {
            $errors[] = ['row' => $i + 1, 'agentId' => $agentId, 'error' => 'Already exists'];
            continue;
        }
        if ($email === '') {
            $email = strtolower($agentId) . '@payflow.agent';
        }
        $uid = 'agent_' . strtolower($agentId);
        $now = gmdate('c');
        $agent = [
            'uid' => $uid,
            'agentId' => $agentId,
            'name' => $name,
            'email' => $email,
            'mobile' => $mobile,
            'passcode' => payflow_hash_passcode($passcode),
            'status' => 'active',
            'kycStatus' => 'pending',
            'city' => $city,
            'notes' => '',
            'createdAt' => $now,
            'updatedAt' => $now,
            'lastLoginAt' => null,
        ];
        payflow_agent_save($agent);
        payflow_admin_audit('payflow_agent_bulk_create', ['agentId' => $agentId, 'uid' => $uid]);
        $created[] = payflow_agent_public($agent, true);
    }
    json_response(['success' => true, 'created' => $created, 'errors' => $errors]);
}

$uid = trim((string) ($body['uid'] ?? ''));
$agentId = strtoupper(trim((string) ($body['agentId'] ?? '')));
$agent = payflow_find_agent($agentId !== '' ? $agentId : null, $uid !== '' ? $uid : null);
if (!$agent) {
    json_response(['error' => 'Agent not found.'], 404);
}
$targetUid = (string) $agent['uid'];

if ($action === 'update') {
    require_admin_role(['super']);
    foreach (['name', 'email', 'city', 'notes', 'locale'] as $field) {
        if (array_key_exists($field, $body)) {
            $agent[$field] = trim((string) $body[$field]);
        }
    }
    if (array_key_exists('mobile', $body)) {
        $agent['mobile'] = preg_replace('/\D+/', '', (string) $body['mobile']);
    }
    if (array_key_exists('kycStatus', $body)) {
        $kyc = strtolower(trim((string) $body['kycStatus']));
        if (in_array($kyc, ['pending', 'verified', 'blocked'], true)) {
            $agent['kycStatus'] = $kyc;
        }
    }
    if (array_key_exists('dailyDebitCap', $body)) {
        $cap = $body['dailyDebitCap'];
        $agent['dailyDebitCap'] = $cap === null || $cap === '' ? null : (float) $cap;
    }
    if (array_key_exists('branding', $body) && is_array($body['branding'])) {
        $agent['branding'] = [
            'logoUrl' => trim((string) ($body['branding']['logoUrl'] ?? '')),
            'primaryColor' => trim((string) ($body['branding']['primaryColor'] ?? '')),
            'displayName' => trim((string) ($body['branding']['displayName'] ?? '')),
        ];
    }
    if (array_key_exists('parentUid', $body)) {
        $agent['parentUid'] = trim((string) $body['parentUid']) ?: null;
    }
    $agent['updatedAt'] = gmdate('c');
    payflow_agent_save($agent);
    payflow_admin_audit('payflow_agent_update', ['uid' => $targetUid, 'agentId' => $agent['agentId'] ?? '']);
    json_response(['success' => true, 'agent' => payflow_agent_public($agent, true)]);
}

if ($action === 'set_status') {
    require_admin_role(['super']);
    $status = strtolower(trim((string) ($body['status'] ?? '')));
    if (!in_array($status, ['active', 'disabled'], true)) {
        json_response(['error' => 'Status must be active or disabled.'], 400);
    }
    $agent['status'] = $status;
    $agent['updatedAt'] = gmdate('c');
    payflow_agent_save($agent);
    payflow_admin_audit('payflow_agent_status', [
        'uid' => $targetUid,
        'agentId' => $agent['agentId'] ?? '',
        'status' => $status,
    ]);
    json_response(['success' => true, 'agent' => payflow_agent_public($agent, true)]);
}

if ($action === 'reset_passcode') {
    require_admin_role(['super']);
    $passcode = (string) ($body['passcode'] ?? '');
    if (strlen($passcode) < 6) {
        json_response(['error' => 'Passcode must be at least 6 characters.'], 400);
    }
    payflow_agent_set_passcode($targetUid, $passcode);
    $agent = payflow_find_agent(null, $targetUid);
    payflow_admin_audit('payflow_agent_reset_passcode', [
        'uid' => $targetUid,
        'agentId' => $agent['agentId'] ?? '',
    ]);
    json_response(['success' => true, 'agent' => payflow_agent_public($agent ?: [], true)]);
}

json_response(['error' => 'Unknown action.'], 400);
