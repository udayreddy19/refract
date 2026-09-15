<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $uid = trim((string) ($_GET['uid'] ?? ''));
    $agents = [];
    foreach (payflow_agents_all() as $agent) {
        if ($uid !== '' && ($agent['uid'] ?? '') !== $uid) {
            continue;
        }
        $agents[] = payflow_agent_public($agent, true);
    }
    usort($agents, static function ($a, $b) {
        return ((float) ($b['balance'] ?? 0)) <=> ((float) ($a['balance'] ?? 0));
    });
    json_response(['wallets' => $agents]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_role(['super', 'billing']);

$body = read_json_body();
$uid = trim((string) ($body['uid'] ?? ''));
$agentId = strtoupper(trim((string) ($body['agentId'] ?? '')));
$agent = payflow_find_agent($agentId !== '' ? $agentId : null, $uid !== '' ? $uid : null);
if (!$agent) {
    json_response(['error' => 'Agent not found.'], 404);
}

$direction = strtolower(trim((string) ($body['direction'] ?? 'credit')));
$amount = round((float) ($body['amount'] ?? 0), 2);
$note = trim((string) ($body['note'] ?? 'Admin adjustment'));

if ($amount <= 0) {
    json_response(['error' => 'Amount must be greater than zero.'], 400);
}
if (!in_array($direction, ['credit', 'debit'], true)) {
    json_response(['error' => 'Direction must be credit or debit.'], 400);
}

$delta = $direction === 'debit' ? -1 * $amount : $amount;
$targetUid = (string) $agent['uid'];
$current = payflow_wallet_get($targetUid);
if ($direction === 'debit' && $amount > $current) {
    json_response(['error' => 'Insufficient wallet balance for debit.'], 400);
}

$balance = payflow_wallet_credit($targetUid, $delta, [
    'type' => $direction === 'debit' ? 'admin_debit' : 'admin_credit',
    'source' => 'admin',
    'note' => $note,
    'agentId' => $agent['agentId'] ?? '',
    'adminRole' => admin_role(),
]);

append_audit('payflow_wallet_adjust', [
    'uid' => $targetUid,
    'agentId' => $agent['agentId'] ?? '',
    'direction' => $direction,
    'amount' => $amount,
    'balance' => $balance,
    'note' => $note,
]);

json_response([
    'success' => true,
    'balance' => $balance,
    'agent' => payflow_agent_public(array_merge($agent, []), true),
]);
