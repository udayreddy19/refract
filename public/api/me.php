<?php
require_once __DIR__ . '/config.php';

$user = current_user_session();
if (!$user) {
    json_response(['authenticated' => false, 'user' => null]);
}

$stored = find_user_by_uid((string) $user['uid']);
if ($stored) {
    if (($stored['status'] ?? '') === 'disabled') {
        clear_user_session();
        json_response(['authenticated' => false, 'user' => null, 'error' => 'Account disabled.']);
    }
    // Auto-lapse expired Pro
    if (!empty($stored['isPro']) && !user_has_active_pro($stored)) {
        $stored = update_user((string) $stored['uid'], [
            'isPro' => false,
            'status' => 'expired',
            'proExpiredAt' => gmdate('c'),
        ]) ?: $stored;
        $stored['isPro'] = false;
    }

    $isPro = effective_is_pro($stored);
    $user = array_merge($user, [
        'name' => $stored['name'] ?? $user['name'],
        'email' => $stored['email'] ?? $user['email'],
        'avatar' => $stored['avatar'] ?? $user['avatar'],
        'isPro' => $isPro,
        'selectedPlan' => $stored['plan'] ?? null,
        'utrValue' => $stored['utrValue'] ?? null,
        'photoURL' => $stored['photoURL'] ?? ($user['photoURL'] ?? null),
        'reminderHour' => isset($stored['reminderHour']) ? (int) $stored['reminderHour'] : 9,
        'teamName' => $stored['teamName'] ?? '',
        'teamId' => $stored['teamId'] ?? null,
        'teamRole' => $stored['teamRole'] ?? null,
        'connections' => $stored['connections'] ?? [],
        'proExpiresAt' => $stored['proExpiresAt'] ?? null,
        'autoRenew' => !empty($stored['autoRenew']),
        'proViaTeam' => !$stored['isPro'] && team_grants_pro($stored),
    ]);
    set_user_session($user);
}

$payments = get_payments();
$pending = null;
foreach ($payments as $payment) {
    if (
        ($payment['userId'] ?? '') === ($user['uid'] ?? '') &&
        ($payment['status'] ?? '') === 'pending'
    ) {
        $pending = $payment;
        break;
    }
}

$user['paymentStatus'] = !empty($user['isPro'])
    ? 'approved'
    : ($pending ? 'pending' : null);
$user['pendingPayment'] = $pending;

json_response([
    'authenticated' => true,
    'user' => $user,
    'settings' => [
        'upiId' => get_settings()['upiId'],
        'qrPath' => get_settings()['qrPath'],
        'payeeName' => get_settings()['payeeName'] ?? 'ReconcileX',
        'plans' => get_settings()['plans'],
        'razorpayEnabled' => razorpay_is_configured(),
        'razorpayKeyId' => razorpay_is_configured() ? RAZORPAY_KEY_ID : '',
        'gstin' => get_settings()['gstin'] ?? '',
    ],
]);
