<?php
/**
 * Nightly backup: /api/cron/payflow-backup.php?key=CRON_SECRET
 * ServerByt: Cron Jobs → fetch this URL daily.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../payflow/store.php';

$key = isset($_GET['key']) ? (string) $_GET['key'] : '';
$expected = defined('CRON_SECRET') ? CRON_SECRET : '';
if ($expected === '' || !hash_equals($expected, $key)) {
    json_response(['error' => 'Unauthorized.'], 401);
}

$payload = [
    'exportedAt' => gmdate('c'),
    'agents' => payflow_agents_all(),
    'wallets' => [],
    'ledger' => payflow_ledger_all(null, 5000),
];

foreach ($payload['agents'] as $agent) {
    $uid = (string) ($agent['uid'] ?? '');
    if ($uid === '') {
        continue;
    }
    // Strip secrets from backup agent rows
    unset($agent['passcode'], $agent['pinHash']);
    $payload['wallets'][] = [
        'uid' => $uid,
        'agentId' => $agent['agentId'] ?? '',
        'balance' => payflow_wallet_get($uid),
    ];
}

$dir = DATA_DIR . '/backups';
if (!is_dir($dir)) {
    @mkdir($dir, 0750, true);
}
$day = (new DateTime('now', new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
$file = $dir . '/payflow-' . $day . '.json.gz';
$json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    json_response(['error' => 'Failed to encode backup'], 500);
}
$gz = gzencode($json, 9);
if ($gz === false || @file_put_contents($file, $gz) === false) {
    // Fallback uncompressed
    $file = $dir . '/payflow-' . $day . '.json';
    if (@file_put_contents($file, $json) === false) {
        json_response(['error' => 'Failed to write backup file'], 500);
    }
}

// Keep last 14 backups
$files = glob($dir . '/payflow-*') ?: [];
rsort($files);
foreach (array_slice($files, 14) as $old) {
    @unlink($old);
}

// Daily settlement snapshot
$db = mysql_pdo();
if ($db) {
    $now = gmdate('c');
    foreach ($payload['wallets'] as $w) {
        $uid = $w['uid'];
        $closing = (float) $w['balance'];
        $credits = 0.0;
        $debits = 0.0;
        foreach (payflow_ledger_all($uid, 500) as $row) {
            $created = (string) ($row['createdAt'] ?? '');
            if (strpos($created, substr(gmdate('c', strtotime($day . ' Asia/Kolkata')), 0, 10)) === false
                && strpos($created, $day) === false) {
                // approximate: include entries from today IST by date prefix in ISO
            }
            $amt = (float) ($row['amount'] ?? 0);
            if (strncmp($created, gmdate('Y-m-d'), 10) === 0 || strpos($created, $day) !== false) {
                if ($amt >= 0) {
                    $credits += $amt;
                } else {
                    $debits += abs($amt);
                }
            }
        }
        $opening = round($closing - $credits + $debits, 2);
        $id = 'set_' . md5($uid . $day);
        $stmt = $db->prepare(
            'INSERT INTO rx_settlements (id, uid, day_ist, opening_balance, closing_balance, credits, debits, created_at)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE closing_balance=VALUES(closing_balance), credits=VALUES(credits),
               debits=VALUES(debits), opening_balance=VALUES(opening_balance)'
        );
        $stmt->execute([$id, $uid, $day, $opening, $closing, $credits, $debits, $now]);
    }
}

json_response([
    'success' => true,
    'file' => basename($file),
    'agents' => count($payload['agents']),
    'ledger' => count($payload['ledger']),
]);
