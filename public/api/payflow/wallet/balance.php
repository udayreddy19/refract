<?php
require_once __DIR__ . '/../_bootstrap.php';

$agent = payflow_require_agent();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$limit = (int) ($_GET['limit'] ?? 100);
$entries = payflow_ledger_all((string) $agent['uid'], $limit);

json_response([
    'balance' => payflow_wallet_get((string) $agent['uid']),
    'entries' => $entries,
]);
