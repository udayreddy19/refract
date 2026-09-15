<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    $db = mysql_pdo();
    $rows = [];
    if ($db) {
        if ($status !== '') {
            $stmt = $db->prepare('SELECT * FROM rx_disputes WHERE status = ? ORDER BY updated_at DESC LIMIT 200');
            $stmt->execute([$status]);
        } else {
            $stmt = $db->query('SELECT * FROM rx_disputes ORDER BY updated_at DESC LIMIT 200');
        }
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                'id' => $r['id'],
                'uid' => $r['uid'],
                'agentId' => $r['agent_id'],
                'utr' => $r['utr'],
                'amount' => (float) $r['amount'],
                'status' => $r['status'],
                'notes' => $r['notes'],
                'createdAt' => $r['created_at'],
                'updatedAt' => $r['updated_at'],
            ];
        }
    } else {
        $all = read_store('payflow_disputes.json', []);
        foreach ($all as $r) {
            if ($status === '' || ($r['status'] ?? '') === $status) {
                $rows[] = $r;
            }
        }
    }
    json_response(['disputes' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_role(['super', 'billing']);
$body = read_json_body();
$action = (string) ($body['action'] ?? 'create');

if ($action === 'create') {
    $utr = trim((string) ($body['utr'] ?? ''));
    $uid = trim((string) ($body['uid'] ?? ''));
    $agentId = strtoupper(trim((string) ($body['agentId'] ?? '')));
    $amount = round((float) ($body['amount'] ?? 0), 2);
    $notes = trim((string) ($body['notes'] ?? ''));
    $agent = payflow_find_agent($agentId !== '' ? $agentId : null, $uid !== '' ? $uid : null);
    if (!$agent) {
        json_response(['error' => 'Agent not found'], 404);
    }
    if ($utr === '') {
        json_response(['error' => 'UTR required'], 400);
    }
    $now = gmdate('c');
    $id = 'dsp_' . bin2hex(random_bytes(6));
    $row = [
        'id' => $id,
        'uid' => $agent['uid'],
        'agentId' => $agent['agentId'],
        'utr' => $utr,
        'amount' => $amount,
        'status' => 'open',
        'notes' => $notes,
        'createdAt' => $now,
        'updatedAt' => $now,
    ];
    $db = mysql_pdo();
    if ($db) {
        $stmt = $db->prepare(
            'INSERT INTO rx_disputes (id, uid, agent_id, utr, amount, status, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([$id, $row['uid'], $row['agentId'], $utr, $amount, 'open', $notes, $now, $now]);
    } else {
        mutate_store('payflow_disputes.json', function ($rows) use ($row) {
            if (!is_array($rows)) {
                $rows = [];
            }
            $rows[] = $row;
            return $rows;
        }, []);
    }
    payflow_admin_audit('payflow_dispute_create', ['uid' => $row['uid'], 'utr' => $utr, 'id' => $id]);
    json_response(['success' => true, 'dispute' => $row]);
}

if ($action === 'set_status') {
    $id = trim((string) ($body['id'] ?? ''));
    $status = strtolower(trim((string) ($body['status'] ?? '')));
    if (!in_array($status, ['open', 'investigating', 'resolved', 'rejected'], true)) {
        json_response(['error' => 'Invalid status'], 400);
    }
    $notes = trim((string) ($body['notes'] ?? ''));
    $now = gmdate('c');
    $db = mysql_pdo();
    if ($db) {
        $stmt = $db->prepare('UPDATE rx_disputes SET status = ?, notes = IF(?="", notes, ?), updated_at = ? WHERE id = ?');
        $stmt->execute([$status, $notes, $notes, $now, $id]);
    } else {
        mutate_store('payflow_disputes.json', function ($rows) use ($id, $status, $notes, $now) {
            if (!is_array($rows)) {
                return [];
            }
            foreach ($rows as $i => $r) {
                if (($r['id'] ?? '') === $id) {
                    $rows[$i]['status'] = $status;
                    if ($notes !== '') {
                        $rows[$i]['notes'] = $notes;
                    }
                    $rows[$i]['updatedAt'] = $now;
                }
            }
            return $rows;
        }, []);
    }
    payflow_admin_audit('payflow_dispute_status', ['id' => $id, 'status' => $status]);
    json_response(['success' => true]);
}

json_response(['error' => 'Unknown action'], 400);
