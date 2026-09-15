<?php
require_once __DIR__ . '/../_bootstrap.php';

$agent = payflow_require_agent();
$uid = (string) $agent['uid'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $db = mysql_pdo();
    $rows = [];
    if ($db) {
        $stmt = $db->prepare('SELECT * FROM rx_favorites WHERE uid = ? ORDER BY updated_at DESC LIMIT 40');
        $stmt->execute([$uid]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                'id' => $r['id'],
                'categoryId' => $r['category_id'],
                'categoryName' => $r['category_name'],
                'consumerNumber' => $r['consumer_number'],
                'customerName' => $r['customer_name'],
                'mobile' => $r['mobile'],
                'lastAmount' => $r['last_amount'] !== null ? (float) $r['last_amount'] : null,
                'useCount' => (int) $r['use_count'],
                'updatedAt' => $r['updated_at'],
            ];
        }
    } else {
        $all = read_store('payflow_favorites.json', []);
        foreach ($all as $r) {
            if (($r['uid'] ?? '') === $uid) {
                $rows[] = $r;
            }
        }
    }
    json_response(['favorites' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = read_json_body();
$categoryId = trim((string) ($body['categoryId'] ?? ''));
$categoryName = trim((string) ($body['categoryName'] ?? ''));
$consumerNumber = trim((string) ($body['consumerNumber'] ?? ''));
$customerName = trim((string) ($body['customerName'] ?? ''));
$mobile = preg_replace('/\D+/', '', (string) ($body['mobile'] ?? ''));
$lastAmount = isset($body['lastAmount']) ? (float) $body['lastAmount'] : null;
if ($categoryId === '' || $consumerNumber === '') {
    json_response(['error' => 'categoryId and consumerNumber required'], 400);
}

$now = gmdate('c');
$db = mysql_pdo();
if ($db) {
    $id = 'fav_' . substr(md5($uid . $categoryId . $consumerNumber), 0, 16);
    $stmt = $db->prepare(
        'INSERT INTO rx_favorites (id, uid, category_id, category_name, consumer_number, customer_name, mobile, last_amount, use_count, updated_at)
         VALUES (?,?,?,?,?,?,?,?,1,?)
         ON DUPLICATE KEY UPDATE category_name=VALUES(category_name), customer_name=VALUES(customer_name),
           mobile=VALUES(mobile), last_amount=VALUES(last_amount), use_count=use_count+1, updated_at=VALUES(updated_at)'
    );
    $stmt->execute([$id, $uid, $categoryId, $categoryName, $consumerNumber, $customerName, $mobile, $lastAmount, $now]);
    json_response(['success' => true, 'id' => $id]);
}

mutate_store('payflow_favorites.json', function ($rows) use ($uid, $categoryId, $categoryName, $consumerNumber, $customerName, $mobile, $lastAmount, $now) {
    if (!is_array($rows)) {
        $rows = [];
    }
    foreach ($rows as $i => $r) {
        if (($r['uid'] ?? '') === $uid && ($r['categoryId'] ?? '') === $categoryId && ($r['consumerNumber'] ?? '') === $consumerNumber) {
            $rows[$i]['useCount'] = ((int) ($r['useCount'] ?? 1)) + 1;
            $rows[$i]['lastAmount'] = $lastAmount;
            $rows[$i]['updatedAt'] = $now;
            return $rows;
        }
    }
    $rows[] = [
        'id' => 'fav_' . bin2hex(random_bytes(4)),
        'uid' => $uid,
        'categoryId' => $categoryId,
        'categoryName' => $categoryName,
        'consumerNumber' => $consumerNumber,
        'customerName' => $customerName,
        'mobile' => $mobile,
        'lastAmount' => $lastAmount,
        'useCount' => 1,
        'updatedAt' => $now,
    ];
    return $rows;
}, []);

json_response(['success' => true]);
