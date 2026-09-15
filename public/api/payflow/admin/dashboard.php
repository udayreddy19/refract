<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

$agents = array_map(static function ($a) {
    return payflow_agent_public($a, true);
}, payflow_agents_all());

$active = 0;
$disabled = 0;
$totalBalance = 0.0;
foreach ($agents as $a) {
    if (($a['status'] ?? '') === 'disabled') {
        $disabled++;
    } else {
        $active++;
    }
    $totalBalance += (float) ($a['balance'] ?? 0);
}

$ledger = payflow_ledger_all(null, 500);
$credits = 0.0;
$debits = 0.0;
$todayVolume = 0.0;
$today = gmdate('Y-m-d');
foreach ($ledger as $row) {
    $amt = (float) ($row['amount'] ?? 0);
    if ($amt >= 0) {
        $credits += $amt;
    } else {
        $debits += abs($amt);
    }
    $created = substr((string) ($row['createdAt'] ?? ''), 0, 10);
    if ($created === $today) {
        $todayVolume += abs($amt);
    }
}

usort($agents, static function ($a, $b) {
    return strcmp((string) ($b['updatedAt'] ?? $b['createdAt'] ?? ''), (string) ($a['updatedAt'] ?? $a['createdAt'] ?? ''));
});

json_response([
    'stats' => [
        'agents' => count($agents),
        'activeAgents' => $active,
        'disabledAgents' => $disabled,
        'totalWalletBalance' => round($totalBalance, 2),
        'ledgerEntries' => count($ledger),
        'creditsVolume' => round($credits, 2),
        'debitsVolume' => round($debits, 2),
        'todayVolume' => round($todayVolume, 2),
    ],
    'recentAgents' => array_slice($agents, 0, 8),
    'recentLedger' => array_slice($ledger, 0, 12),
]);
