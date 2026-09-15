<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $uid = trim((string) ($_GET['uid'] ?? ''));
    $db = mysql_pdo();
    $rows = [];
    if ($db) {
        if ($uid !== '') {
            $stmt = $db->prepare('SELECT * FROM rx_settlements WHERE uid = ? ORDER BY day_ist DESC LIMIT 90');
            $stmt->execute([$uid]);
        } else {
            $stmt = $db->query('SELECT * FROM rx_settlements ORDER BY day_ist DESC LIMIT 200');
        }
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                'id' => $r['id'],
                'uid' => $r['uid'],
                'day' => $r['day_ist'],
                'openingBalance' => (float) $r['opening_balance'],
                'closingBalance' => (float) $r['closing_balance'],
                'credits' => (float) $r['credits'],
                'debits' => (float) $r['debits'],
                'createdAt' => $r['created_at'],
            ];
        }
    }
    $rules = [];
    if ($db) {
        foreach ($db->query('SELECT * FROM rx_commission_rules ORDER BY product')->fetchAll() as $r) {
            $rules[] = [
                'id' => $r['id'],
                'product' => $r['product'],
                'feeFlat' => (float) $r['fee_flat'],
                'feePct' => (float) $r['fee_pct'],
                'marginFlat' => (float) $r['margin_flat'],
                'marginPct' => (float) $r['margin_pct'],
                'active' => !empty($r['active']),
            ];
        }
    }
    json_response(['settlements' => $rows, 'commissionRules' => $rules]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_role(['super', 'billing']);
$body = read_json_body();
$product = trim((string) ($body['product'] ?? ''));
if (!in_array($product, ['bills', 'qr', 'topup'], true)) {
    json_response(['error' => 'Invalid product'], 400);
}
$db = mysql_pdo();
if (!$db) {
    json_response(['error' => 'MySQL required for commission rules'], 503);
}
$now = gmdate('c');
$stmt = $db->prepare(
    'INSERT INTO rx_commission_rules (id, product, fee_flat, fee_pct, margin_flat, margin_pct, active, updated_at)
     VALUES (?,?,?,?,?,?,1,?)
     ON DUPLICATE KEY UPDATE fee_flat=VALUES(fee_flat), fee_pct=VALUES(fee_pct),
       margin_flat=VALUES(margin_flat), margin_pct=VALUES(margin_pct), updated_at=VALUES(updated_at)'
);
$stmt->execute([
    'cm_' . $product,
    $product,
    (float) ($body['feeFlat'] ?? 0),
    (float) ($body['feePct'] ?? 0),
    (float) ($body['marginFlat'] ?? 0),
    (float) ($body['marginPct'] ?? 0),
    $now,
]);
payflow_admin_audit('payflow_commission_update', ['product' => $product]);
json_response(['success' => true]);
