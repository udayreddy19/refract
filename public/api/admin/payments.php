<?php
require_once __DIR__ . '/../config.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = isset($_GET['status']) ? trim((string) $_GET['status']) : '';
    $q = isset($_GET['q']) ? strtolower(trim((string) $_GET['q'])) : '';
    $payments = get_payments();

    if ($status !== '' && in_array($status, ['pending', 'approved', 'rejected', 'cancelled', 'failed', 'refunded'], true)) {
        $payments = array_values(array_filter($payments, function ($p) use ($status) {
            return ($p['status'] ?? '') === $status;
        }));
    }

    if ($q !== '') {
        $payments = array_values(array_filter($payments, function ($p) use ($q) {
            $hay = strtolower(
                ($p['email'] ?? '') . ' ' .
                ($p['name'] ?? '') . ' ' .
                ($p['utr'] ?? '') . ' ' .
                ($p['note'] ?? '') . ' ' .
                ($p['id'] ?? '')
            );
            return strpos($hay, $q) !== false;
        }));
    }

    usort($payments, function ($a, $b) {
        return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
    });

    json_response(['payments' => $payments]);
}

if ($method === 'PATCH' || $method === 'POST') {
    require_admin_role(['super', 'billing']);
    $body = read_json_body();
    $id = isset($body['id']) ? trim((string) $body['id']) : '';
    $action = isset($body['action']) ? (string) $body['action'] : '';
    $note = isset($body['note']) ? trim((string) $body['note']) : '';

    if ($id === '' || !in_array($action, ['approve', 'reject', 'refund'], true)) {
        json_response(['error' => 'id and action (approve|reject|refund) are required.'], 400);
    }

    if ($action === 'refund') {
        $found = null;
        foreach (get_payments() as $p) {
            if (($p['id'] ?? '') === $id) {
                $found = $p;
                break;
            }
        }
        if (!$found) {
            json_response(['error' => 'Payment not found.'], 404);
        }
        if (($found['status'] ?? '') !== 'approved') {
            json_response(['error' => 'Only approved payments can be refunded.'], 400);
        }

        $rzpId = (string) ($found['razorpayPaymentId'] ?? '');
        if (($found['method'] ?? '') === 'razorpay' && $rzpId !== '' && razorpay_is_configured()) {
            $amountPaise = ((int) ($found['amount'] ?? 0)) * 100;
            $api = razorpay_api('POST', 'payments/' . rawurlencode($rzpId) . '/refund', [
                'amount' => $amountPaise,
                'notes' => ['paymentId' => $id, 'note' => $note],
            ]);
            if (empty($api['ok'])) {
                json_response(['error' => $api['error'] ?: 'Razorpay refund failed.'], 502);
            }
        }

        $bag = ['payment' => null];
        mutate_store('payments.json', function ($payments) use ($id, $note, &$bag) {
            if (!is_array($payments)) {
                return [];
            }
            foreach ($payments as $i => $payment) {
                if (($payment['id'] ?? '') !== $id) {
                    continue;
                }
                $payments[$i]['status'] = 'refunded';
                $payments[$i]['reviewedAt'] = gmdate('c');
                $payments[$i]['note'] = $note !== '' ? $note : 'Refunded by admin';
                $bag['payment'] = $payments[$i];
                break;
            }
            return $payments;
        }, []);

        $payment = $bag['payment'];
        if (!$payment) {
            json_response(['error' => 'Payment not found.'], 404);
        }

        update_user((string) ($found['userId'] ?? ''), [
            'isPro' => false,
            'status' => 'refunded',
            'proExpiresAt' => gmdate('c'),
            'pendingPaymentId' => null,
            'pendingPlan' => null,
        ]);

        $user = find_user_by_uid((string) ($found['userId'] ?? ''));
        notify_refund($user ?: $found, $payment);
        append_audit('payment_refund', [
            'paymentId' => $id,
            'userId' => $found['userId'] ?? '',
            'note' => $note,
        ]);

        json_response(['success' => true, 'payment' => $payment]);
    }

    $bag = [
        'error' => null,
        'status' => 200,
        'payment' => null,
        'found' => null,
    ];

    mutate_store('payments.json', function ($payments) use ($id, $action, $note, &$bag) {
        if (!is_array($payments)) {
            $payments = [];
        }

        $idx = -1;
        foreach ($payments as $i => $payment) {
            if (($payment['id'] ?? '') === $id) {
                $idx = $i;
                $bag['found'] = $payment;
                break;
            }
        }

        if ($idx < 0) {
            $bag['error'] = 'Payment not found.';
            $bag['status'] = 404;
            return $payments;
        }

        if (($payments[$idx]['status'] ?? '') !== 'pending') {
            $bag['error'] = 'Only pending payments can be reviewed.';
            $bag['status'] = 400;
            return $payments;
        }

        $now = gmdate('c');
        if ($action === 'approve') {
            $payments[$idx]['status'] = 'approved';
            $payments[$idx]['reviewedAt'] = $now;
            $payments[$idx]['note'] = $note;
        } else {
            $payments[$idx]['status'] = 'rejected';
            $payments[$idx]['reviewedAt'] = $now;
            $payments[$idx]['note'] = $note !== '' ? $note : 'Rejected by admin';
        }

        $bag['payment'] = $payments[$idx];
        $bag['found'] = $payments[$idx];
        return $payments;
    }, []);

    if ($bag['error'] !== null) {
        json_response(['error' => $bag['error']], (int) $bag['status']);
    }

    $found = $bag['found'];
    $payment = $bag['payment'];
    if (!$found || !$payment) {
        json_response(['error' => 'Payment not found.'], 404);
    }

    $now = gmdate('c');
    if ($action === 'approve') {
        $user = update_user((string) $found['userId'], [
            'isPro' => true,
            'plan' => $found['plan'] ?? 'monthly',
            'utrValue' => $found['utr'] ?? null,
            'proUpdatedAt' => $now,
            'proExpiresAt' => compute_pro_expires_at((string) ($found['plan'] ?? 'monthly'), $now),
            'status' => 'active',
            'pendingPaymentId' => null,
            'pendingPlan' => null,
        ]);

        if (!$user) {
            $user = upsert_user([
                'uid' => $found['userId'],
                'email' => $found['email'] ?? '',
                'name' => $found['name'] ?? ($found['email'] ?? 'User'),
                'avatar' => get_initials((string) ($found['name'] ?? $found['email'] ?? 'U')),
                'isPro' => true,
                'plan' => $found['plan'] ?? 'monthly',
                'utrValue' => $found['utr'] ?? null,
                'proExpiresAt' => compute_pro_expires_at((string) ($found['plan'] ?? 'monthly'), $now),
                'lastLoginAt' => $now,
            ]);
        }

        $sessionUser = current_user_session();
        if ($sessionUser && ($sessionUser['uid'] ?? '') === ($found['userId'] ?? '')) {
            set_user_session(array_merge($sessionUser, [
                'isPro' => true,
                'selectedPlan' => $found['plan'] ?? 'monthly',
                'utrValue' => $found['utr'] ?? null,
                'paymentStatus' => 'approved',
            ]));
        }

        $notifyUser = $user ?: [
            'email' => $found['email'] ?? '',
            'name' => $found['name'] ?? '',
        ];
        notify_pro_approved(is_array($notifyUser) ? $notifyUser : [], (string) ($found['plan'] ?? 'monthly'));
        notify_payment_receipt(is_array($notifyUser) ? $notifyUser : [], $found);
        append_audit('payment_approve', [
            'paymentId' => $found['id'] ?? $id,
            'userId' => $found['userId'] ?? '',
            'email' => $found['email'] ?? '',
            'plan' => $found['plan'] ?? '',
            'utr' => $found['utr'] ?? '',
            'note' => $note,
        ]);
    } else {
        update_user((string) $found['userId'], [
            'pendingPaymentId' => null,
            'pendingPlan' => null,
        ]);

        $sessionUser = current_user_session();
        if ($sessionUser && ($sessionUser['uid'] ?? '') === ($found['userId'] ?? '')) {
            set_user_session(array_merge($sessionUser, [
                'paymentStatus' => null,
            ]));
        }

        append_audit('payment_reject', [
            'paymentId' => $found['id'] ?? $id,
            'userId' => $found['userId'] ?? '',
            'email' => $found['email'] ?? '',
            'note' => $note !== '' ? $note : 'Rejected by admin',
        ]);
    }

    json_response(['success' => true, 'payment' => $payment]);
}

json_response(['error' => 'Method not allowed.'], 405);
