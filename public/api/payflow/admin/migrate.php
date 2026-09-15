<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_role(['super']);

if (!mysql_pdo()) {
    json_response([
        'error' => 'MySQL is not configured. Add MYSQL_* to api/secrets.php on ServerByt.',
        'mysqlConfigured' => false,
    ], 503);
}

$agents = read_store('payflow_agents.json', []);
$wallets = read_store('payflow_wallets.json', []);
$ledger = read_store('payflow_ledger.json', []);
$deposits = read_store('payflow_deposits.json', []);

$counts = ['agents' => 0, 'wallets' => 0, 'ledger' => 0, 'deposits' => 0];

if (is_array($agents)) {
    foreach ($agents as $agent) {
        if (!is_array($agent) || empty($agent['uid'])) {
            continue;
        }
        if (!isset($agent['kycStatus'])) {
            $agent['kycStatus'] = 'pending';
        }
        payflow_agent_save($agent);
        $counts['agents']++;
    }
}

$db = mysql_pdo();
if (is_array($wallets) && $db) {
    $stmt = $db->prepare('INSERT INTO rx_wallets (uid, balance, updated_at) VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE balance=VALUES(balance), updated_at=VALUES(updated_at)');
    foreach ($wallets as $w) {
        if (!is_array($w) || empty($w['uid'])) {
            continue;
        }
        $stmt->execute([
            $w['uid'],
            (float) ($w['balance'] ?? 0),
            (string) ($w['updatedAt'] ?? gmdate('c')),
        ]);
        $counts['wallets']++;
    }
}

if (is_array($ledger) && $db) {
    $stmt = $db->prepare(
        'INSERT IGNORE INTO rx_ledger (id, uid, entry_type, amount, balance, meta_json, created_at)
         VALUES (?,?,?,?,?,?,?)'
    );
    foreach ($ledger as $row) {
        if (!is_array($row) || empty($row['id'])) {
            continue;
        }
        $meta = $row;
        unset($meta['id'], $meta['uid'], $meta['type'], $meta['amount'], $meta['balance'], $meta['createdAt']);
        $stmt->execute([
            $row['id'],
            $row['uid'] ?? '',
            $row['type'] ?? 'credit',
            (float) ($row['amount'] ?? 0),
            (float) ($row['balance'] ?? 0),
            json_encode($meta, JSON_UNESCAPED_SLASHES),
            $row['createdAt'] ?? gmdate('c'),
        ]);
        $counts['deposits'] = $counts['deposits']; // keep structure
        $counts['ledger']++;
    }
}

if (is_array($deposits)) {
    foreach ($deposits as $dep) {
        if (!is_array($dep) || empty($dep['id'])) {
            continue;
        }
        payflow_deposit_save($dep);
        $counts['deposits']++;
    }
}

payflow_admin_audit('payflow_mysql_migrate', $counts, 'Imported JSON stores into MySQL');

json_response([
    'success' => true,
    'mysql' => true,
    'imported' => $counts,
]);
