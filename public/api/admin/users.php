<?php
require_once __DIR__ . '/../config.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $q = isset($_GET['q']) ? strtolower(trim((string) $_GET['q'])) : '';
    $users = get_users();

    if ($q !== '') {
        $users = array_values(array_filter($users, function ($user) use ($q) {
            $hay = strtolower(
                ($user['name'] ?? '') . ' ' .
                ($user['email'] ?? '') . ' ' .
                ($user['uid'] ?? '')
            );
            return strpos($hay, $q) !== false;
        }));
    }

    usort($users, function ($a, $b) {
        return strcmp((string) ($b['lastLoginAt'] ?? ''), (string) ($a['lastLoginAt'] ?? ''));
    });

    json_response(['users' => $users]);
}

if ($method === 'PATCH' || $method === 'POST') {
    require_admin_role(['super']);
    $body = read_json_body();
    $uid = isset($body['uid']) ? trim((string) $body['uid']) : '';
    if ($uid === '') {
        json_response(['error' => 'uid is required.'], 400);
    }

    $action = isset($body['action']) ? (string) $body['action'] : '';
    $patch = [];

    if ($action === 'grant_pro') {
        $plan = isset($body['plan']) ? (string) $body['plan'] : 'monthly';
        if (!in_array($plan, ['monthly', 'quarterly', 'annual', 'trial'], true)) {
            json_response(['error' => 'Invalid plan.'], 400);
        }
        $days = isset($body['days']) ? max(1, min(365, (int) $body['days'])) : plan_duration_days($plan === 'trial' ? 'monthly' : $plan);
        $patch = [
            'isPro' => true,
            'plan' => $plan,
            'status' => 'active',
            'proUpdatedAt' => gmdate('c'),
            'proExpiresAt' => gmdate('c', time() + $days * 86400),
            'pendingPaymentId' => null,
            'pendingPlan' => null,
        ];
        if (!empty($body['utrValue'])) {
            $patch['utrValue'] = trim((string) $body['utrValue']);
        }
    } elseif ($action === 'revoke_pro') {
        $patch = [
            'isPro' => false,
            'plan' => null,
            'utrValue' => null,
            'proUpdatedAt' => gmdate('c'),
            'proExpiresAt' => gmdate('c'),
            'status' => 'revoked',
        ];
    } elseif ($action === 'set_team') {
        $patch = [
            'teamId' => isset($body['teamId']) ? substr(trim((string) $body['teamId']), 0, 64) : null,
            'teamName' => isset($body['teamName']) ? substr(trim((string) $body['teamName']), 0, 80) : '',
        ];
    } elseif ($action === 'set_brand') {
        $brandId = isset($body['brandId']) ? trim((string) $body['brandId']) : '';
        $brandName = '';
        if ($brandId !== '') {
            $brand = find_brand($brandId);
            if (!$brand) {
                json_response(['error' => 'Brand not found.'], 404);
            }
            $brandName = (string) ($brand['name'] ?? '');
        }
        $patch = [
            'brandId' => $brandId !== '' ? $brandId : null,
            'brandName' => $brandName,
        ];
    } elseif ($action === 'disable') {
        $patch = [
            'status' => 'disabled',
            'isPro' => false,
            'proExpiresAt' => gmdate('c'),
        ];
    } elseif ($action === 'enable') {
        $patch = [
            'status' => 'active',
        ];
    } elseif ($action === 'grant_trial') {
        $days = isset($body['days']) ? (int) $body['days'] : 7;
        $updated = grant_trial_pro($uid, $days, (string) ($body['note'] ?? 'admin'));
        if (!$updated) {
            json_response(['error' => 'User not found.'], 404);
        }
        append_audit('user_grant_trial', ['userId' => $uid, 'days' => $days]);
        json_response(['success' => true, 'user' => $updated]);
    } else {
        json_response(['error' => 'Unknown action.'], 400);
    }

    $updated = update_user($uid, $patch);
    if (!$updated) {
        json_response(['error' => 'User not found.'], 404);
    }

    // Keep live customer session in sync if same browser (rare) — no-op for other users
    $sessionUser = current_user_session();
    if ($sessionUser && ($sessionUser['uid'] ?? '') === $uid) {
        set_user_session(array_merge($sessionUser, [
            'isPro' => !empty($updated['isPro']),
            'selectedPlan' => $updated['plan'] ?? null,
            'utrValue' => $updated['utrValue'] ?? null,
            'teamName' => $updated['teamName'] ?? '',
            'teamId' => $updated['teamId'] ?? null,
        ]));
    }

    if ($action === 'grant_pro') {
        notify_pro_approved($updated, (string) ($updated['plan'] ?? 'monthly'));
        append_audit('user_grant_pro', [
            'userId' => $uid,
            'email' => $updated['email'] ?? '',
            'plan' => $updated['plan'] ?? '',
        ]);
    } elseif ($action === 'revoke_pro') {
        append_audit('user_revoke_pro', [
            'userId' => $uid,
            'email' => $updated['email'] ?? '',
        ]);
    } elseif ($action === 'set_team') {
        append_audit('user_set_team', [
            'userId' => $uid,
            'teamId' => $updated['teamId'] ?? '',
            'teamName' => $updated['teamName'] ?? '',
        ]);
    }

    json_response(['success' => true, 'user' => $updated]);
}

json_response(['error' => 'Method not allowed.'], 405);
