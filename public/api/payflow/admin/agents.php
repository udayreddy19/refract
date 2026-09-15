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
    $created = null;
    mutate_store('payflow_agents.json', function ($agents) use ($uid, $agentId, $name, $email, $mobile, $passcode, $city, $notes, $now, &$created) {
        if (!is_array($agents) || count($agents) === 0) {
            $agents = [];
        }
        $created = [
            'uid' => $uid,
            'agentId' => $agentId,
            'name' => $name,
            'email' => $email,
            'mobile' => $mobile,
            'passcode' => payflow_hash_passcode($passcode),
            'status' => 'active',
            'city' => $city,
            'notes' => $notes,
            'createdAt' => $now,
            'updatedAt' => $now,
            'lastLoginAt' => null,
        ];
        $agents[] = $created;
        return $agents;
    }, []);

    append_audit('payflow_agent_create', ['agentId' => $agentId, 'uid' => $uid]);
    json_response(['success' => true, 'agent' => payflow_agent_public($created, true)]);
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
    $updated = null;
    mutate_store('payflow_agents.json', function ($agents) use ($body, $targetUid, &$updated) {
        if (!is_array($agents)) {
            $agents = [];
        }
        foreach ($agents as $i => $row) {
            if (($row['uid'] ?? '') !== $targetUid) {
                continue;
            }
            foreach (['name', 'email', 'city', 'notes'] as $field) {
                if (array_key_exists($field, $body)) {
                    $agents[$i][$field] = trim((string) $body[$field]);
                }
            }
            if (array_key_exists('mobile', $body)) {
                $agents[$i]['mobile'] = preg_replace('/\D+/', '', (string) $body['mobile']);
            }
            $agents[$i]['updatedAt'] = gmdate('c');
            $updated = $agents[$i];
            break;
        }
        return $agents;
    }, []);

    if (!$updated) {
        json_response(['error' => 'Agent not found.'], 404);
    }
    append_audit('payflow_agent_update', ['uid' => $targetUid, 'agentId' => $updated['agentId'] ?? '']);
    json_response(['success' => true, 'agent' => payflow_agent_public($updated, true)]);
}

if ($action === 'set_status') {
    require_admin_role(['super']);
    $status = strtolower(trim((string) ($body['status'] ?? '')));
    if (!in_array($status, ['active', 'disabled'], true)) {
        json_response(['error' => 'Status must be active or disabled.'], 400);
    }
    $updated = null;
    mutate_store('payflow_agents.json', function ($agents) use ($targetUid, $status, &$updated) {
        if (!is_array($agents)) {
            $agents = [];
        }
        foreach ($agents as $i => $row) {
            if (($row['uid'] ?? '') !== $targetUid) {
                continue;
            }
            $agents[$i]['status'] = $status;
            $agents[$i]['updatedAt'] = gmdate('c');
            $updated = $agents[$i];
            break;
        }
        return $agents;
    }, []);
    if (!$updated) {
        json_response(['error' => 'Agent not found.'], 404);
    }
    append_audit('payflow_agent_status', [
        'uid' => $targetUid,
        'agentId' => $updated['agentId'] ?? '',
        'status' => $status,
    ]);
    json_response(['success' => true, 'agent' => payflow_agent_public($updated, true)]);
}

if ($action === 'reset_passcode') {
    require_admin_role(['super']);
    $passcode = (string) ($body['passcode'] ?? '');
    if (strlen($passcode) < 6) {
        json_response(['error' => 'Passcode must be at least 6 characters.'], 400);
    }
    $updated = null;
    mutate_store('payflow_agents.json', function ($agents) use ($targetUid, $passcode, &$updated) {
        if (!is_array($agents)) {
            $agents = [];
        }
        foreach ($agents as $i => $row) {
            if (($row['uid'] ?? '') !== $targetUid) {
                continue;
            }
            $agents[$i]['passcode'] = payflow_hash_passcode($passcode);
            $agents[$i]['updatedAt'] = gmdate('c');
            $updated = $agents[$i];
            break;
        }
        return $agents;
    }, []);
    if (!$updated) {
        json_response(['error' => 'Agent not found.'], 404);
    }
    append_audit('payflow_agent_reset_passcode', [
        'uid' => $targetUid,
        'agentId' => $updated['agentId'] ?? '',
    ]);
    json_response(['success' => true, 'agent' => payflow_agent_public($updated, true)]);
}

json_response(['error' => 'Unknown action.'], 400);
