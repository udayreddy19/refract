<?php
require_once __DIR__ . '/../_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$agent = payflow_require_agent();
$body = read_json_body();
$amount = round((float) ($body['amount'] ?? 0), 2);
$note = trim((string) ($body['note'] ?? 'Wallet debit'));
$type = trim((string) ($body['type'] ?? 'wallet_withdraw'));

if ($amount <= 0) {
    json_response(['error' => 'Amount must be greater than zero'], 400);
}

$uid = (string) $agent['uid'];
$balance = payflow_wallet_get($uid);
if ($amount > $balance) {
    json_response(['error' => 'Insufficient wallet balance'], 400);
}

$next = payflow_wallet_credit($uid, -1 * $amount, [
    'type' => $type,
    'note' => $note,
    'source' => 'agent',
    'agentId' => $agent['agentId'] ?? '',
]);

json_response([
    'success' => true,
    'balance' => $next,
]);
