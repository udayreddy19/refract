<?php
require_once __DIR__ . '/../config.php';
require_admin();

$users = get_users();
$payments = get_payments();

$proCount = 0;
foreach ($users as $user) {
    if (!empty($user['isPro'])) {
        $proCount++;
    }
}

$pending = 0;
$approved = 0;
$rejected = 0;
foreach ($payments as $payment) {
    $status = $payment['status'] ?? 'pending';
    if ($status === 'pending') {
        $pending++;
    } elseif ($status === 'approved') {
        $approved++;
    } elseif ($status === 'rejected') {
        $rejected++;
    }
}

usort($users, function ($a, $b) {
    return strcmp((string) ($b['lastLoginAt'] ?? $b['createdAt'] ?? ''), (string) ($a['lastLoginAt'] ?? $a['createdAt'] ?? ''));
});
usort($payments, function ($a, $b) {
    return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
});

json_response([
    'stats' => [
        'users' => count($users),
        'proUsers' => $proCount,
        'pendingPayments' => $pending,
        'approvedPayments' => $approved,
        'rejectedPayments' => $rejected,
    ],
    'recentUsers' => array_slice($users, 0, 8),
    'recentPayments' => array_slice($payments, 0, 8),
]);
