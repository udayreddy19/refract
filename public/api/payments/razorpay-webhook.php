<?php
/**
 * Razorpay webhook — payment.captured, order.paid, payment.failed, subscription.charged
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$raw = file_get_contents('php://input');
if ($raw === false) {
    $raw = '';
}

$sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
$secret = defined('RAZORPAY_WEBHOOK_SECRET') ? RAZORPAY_WEBHOOK_SECRET : '';

if ($secret !== '' && $sig !== '') {
    $expected = hash_hmac('sha256', $raw, $secret);
    if (!hash_equals($expected, $sig)) {
        json_response(['error' => 'Invalid webhook signature.'], 400);
    }
} elseif ($secret !== '') {
    json_response(['error' => 'Missing webhook signature.'], 400);
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    json_response(['error' => 'Invalid JSON.'], 400);
}

$event = (string) ($payload['event'] ?? '');

if ($event === 'payment.failed') {
    $entity = $payload['payload']['payment']['entity'] ?? null;
    if (!is_array($entity)) {
        json_response(['success' => true, 'ignored' => 'no_entity']);
    }
    $orderId = (string) ($entity['order_id'] ?? '');
    $paymentId = (string) ($entity['id'] ?? '');
    $reason = (string) ($entity['error_description'] ?? $entity['error_code'] ?? 'failed');
    $bag = ['payment' => null];
    mutate_store('payments.json', function ($payments) use ($orderId, $paymentId, $reason, &$bag) {
        if (!is_array($payments)) {
            return [];
        }
        foreach ($payments as $i => $row) {
            $matchOrder = $orderId !== '' && ($row['razorpayOrderId'] ?? '') === $orderId;
            $matchPay = $paymentId !== '' && ($row['razorpayPaymentId'] ?? '') === $paymentId;
            if (!$matchOrder && !$matchPay) {
                continue;
            }
            if (($row['status'] ?? '') === 'approved') {
                $bag['payment'] = $row;
                return $payments;
            }
            $payments[$i]['status'] = 'failed';
            $payments[$i]['reviewedAt'] = gmdate('c');
            $payments[$i]['note'] = 'Razorpay failed: ' . $reason;
            if ($paymentId !== '') {
                $payments[$i]['razorpayPaymentId'] = $paymentId;
            }
            $bag['payment'] = $payments[$i];
            return $payments;
        }
        return $payments;
    }, []);
    if ($bag['payment']) {
        $user = find_user_by_uid((string) ($bag['payment']['userId'] ?? ''));
        notify_payment_failed($user ?: $bag['payment'], $bag['payment'], $reason);
        track_analytics('payment_failed', ['reason' => $reason], (string) ($bag['payment']['userId'] ?? ''));
        append_audit('payment_failed', [
            'paymentId' => $bag['payment']['id'] ?? '',
            'reason' => $reason,
        ]);
    }
    json_response(['success' => true, 'processed' => (bool) $bag['payment'], 'event' => $event]);
}

if ($event === 'subscription.charged' || $event === 'subscription.activated') {
    $sub = $payload['payload']['subscription']['entity'] ?? null;
    $pay = $payload['payload']['payment']['entity'] ?? null;
    if (!is_array($sub)) {
        json_response(['success' => true, 'ignored' => 'no_subscription']);
    }
    $subscriptionId = (string) ($sub['id'] ?? '');
    $paymentId = is_array($pay) ? (string) ($pay['id'] ?? '') : '';
    $bag = ['payment' => null, 'already' => false];
    mutate_store('payments.json', function ($payments) use ($subscriptionId, $paymentId, &$bag) {
        if (!is_array($payments)) {
            return [];
        }
        foreach ($payments as $i => $row) {
            if (($row['razorpaySubscriptionId'] ?? '') !== $subscriptionId) {
                continue;
            }
            if (($row['status'] ?? '') === 'approved' && $paymentId !== '' && ($row['razorpayPaymentId'] ?? '') === $paymentId) {
                $bag['payment'] = $row;
                $bag['already'] = true;
                return $payments;
            }
            // Renew: if already approved, create extension by updating same row's note + re-activate
            if (($row['status'] ?? '') === 'approved' && $paymentId !== '' && ($row['razorpayPaymentId'] ?? '') !== $paymentId) {
                $clone = $row;
                $clone['id'] = 'pay_' . bin2hex(random_bytes(8));
                $clone['status'] = 'approved';
                $clone['razorpayPaymentId'] = $paymentId;
                $clone['utr'] = $paymentId;
                $clone['createdAt'] = gmdate('c');
                $clone['reviewedAt'] = gmdate('c');
                $clone['note'] = 'Subscription renewal';
                $clone['autoRenew'] = true;
                $payments[] = $clone;
                $bag['payment'] = $clone;
                return $payments;
            }
            $payments[$i]['status'] = 'approved';
            $payments[$i]['method'] = 'razorpay';
            $payments[$i]['autoRenew'] = true;
            if ($paymentId !== '') {
                $payments[$i]['razorpayPaymentId'] = $paymentId;
                $payments[$i]['utr'] = $paymentId;
            }
            $payments[$i]['reviewedAt'] = gmdate('c');
            $payments[$i]['note'] = 'Auto-approved via subscription webhook';
            $bag['payment'] = $payments[$i];
            return $payments;
        }
        return $payments;
    }, []);

    if ($bag['payment'] && !$bag['already']) {
        activate_pro_from_payment($bag['payment'], 'subscription_webhook');
    }
    json_response(['success' => true, 'processed' => (bool) $bag['payment'], 'event' => $event]);
}

if ($event !== 'payment.captured' && $event !== 'order.paid') {
    json_response(['success' => true, 'ignored' => $event]);
}

$entity = $payload['payload']['payment']['entity']
    ?? $payload['payload']['order']['entity']
    ?? null;

if (!is_array($entity)) {
    json_response(['success' => true, 'ignored' => 'no_entity']);
}

$orderId = (string) ($entity['order_id'] ?? $entity['id'] ?? '');
$paymentId = (string) ($entity['id'] ?? '');
if (($payload['event'] ?? '') === 'order.paid') {
    $orderId = (string) ($entity['id'] ?? '');
    $paymentId = (string) ($entity['payments']['items'][0]['id'] ?? $paymentId);
}

if ($orderId === '') {
    json_response(['success' => true, 'ignored' => 'no_order']);
}

$bag = ['payment' => null, 'already' => false];
mutate_store('payments.json', function ($payments) use ($orderId, $paymentId, &$bag) {
    if (!is_array($payments)) {
        $payments = [];
    }
    foreach ($payments as $i => $row) {
        if (($row['razorpayOrderId'] ?? '') !== $orderId) {
            continue;
        }
        if (($row['status'] ?? '') === 'approved') {
            $bag['payment'] = $row;
            $bag['already'] = true;
            return $payments;
        }
        $payments[$i]['status'] = 'approved';
        $payments[$i]['method'] = 'razorpay';
        if ($paymentId !== '') {
            $payments[$i]['razorpayPaymentId'] = $paymentId;
            $payments[$i]['utr'] = $paymentId;
        }
        $payments[$i]['reviewedAt'] = gmdate('c');
        $payments[$i]['note'] = 'Auto-approved via Razorpay webhook';
        $bag['payment'] = $payments[$i];
        return $payments;
    }
    return $payments;
}, []);

if ($bag['payment'] && !$bag['already']) {
    activate_pro_from_payment($bag['payment'], 'webhook');
}

json_response(['success' => true, 'processed' => (bool) $bag['payment']]);
