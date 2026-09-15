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
$full = payflow_find_agent(null, $uid);
if ($full) {
    $block = payflow_agent_can_transact($full);
    if ($block) {
        json_response(['error' => $block], 403);
    }
}

$product = $type === 'bill' ? 'bills' : ($type === 'qr' ? 'qr' : 'topup');
$rule = payflow_commission_for($type === 'bill' ? 'bills' : ($type === 'wallet_withdraw' ? 'topup' : $product));
$debitAmount = $type === 'bill' ? payflow_apply_fee($amount, $rule) : $amount;

$limitErr = payflow_check_debit_limits($uid, $debitAmount);
if ($limitErr) {
    json_response(['error' => $limitErr], 429);
}

$balance = payflow_wallet_get($uid);
if ($debitAmount > $balance) {
    json_response(['error' => 'Insufficient wallet balance'], 400);
}

$next = payflow_wallet_credit($uid, -1 * $debitAmount, [
    'type' => $type,
    'note' => $note,
    'source' => 'agent',
    'agentId' => $agent['agentId'] ?? '',
    'fee' => round($debitAmount - $amount, 2),
    'principal' => $amount,
]);

json_response([
    'success' => true,
    'balance' => $next,
    'debited' => $debitAmount,
    'fee' => round($debitAmount - $amount, 2),
]);
