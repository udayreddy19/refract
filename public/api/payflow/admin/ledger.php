<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$uid = trim((string) ($_GET['uid'] ?? ''));
$agentId = strtoupper(trim((string) ($_GET['agentId'] ?? '')));
$limit = (int) ($_GET['limit'] ?? 200);
if ($limit < 1) {
    $limit = 50;
}
if ($limit > 1000) {
    $limit = 1000;
}

if ($uid === '' && $agentId !== '') {
    $agent = payflow_find_agent($agentId);
    if ($agent) {
        $uid = (string) $agent['uid'];
    }
}

$agentMap = [];
foreach (payflow_agents_all() as $a) {
    $agentMap[(string) ($a['uid'] ?? '')] = $a;
}

$entries = [];
foreach (payflow_ledger_all($uid !== '' ? $uid : null, $limit) as $row) {
    $u = (string) ($row['uid'] ?? '');
    $agent = $agentMap[$u] ?? null;
    $entries[] = array_merge($row, [
        'agentId' => $agent['agentId'] ?? ($row['agentId'] ?? ''),
        'agentName' => $agent['name'] ?? '',
    ]);
}

json_response(['entries' => $entries]);
