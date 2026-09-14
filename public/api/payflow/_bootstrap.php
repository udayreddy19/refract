<?php
/**
 * PayFlow Agent helpers — wallet deposits via Razorpay + Cashfree (BetKing patterns).
 */
require_once __DIR__ . '/../config.php';

if (!defined('CASHFREE_APP_ID')) {
    define('CASHFREE_APP_ID', getenv('CASHFREE_APP_ID') ?: getenv('CASHFREE_CLIENT_ID') ?: '');
}
if (!defined('CASHFREE_SECRET_KEY')) {
    define('CASHFREE_SECRET_KEY', getenv('CASHFREE_SECRET_KEY') ?: getenv('CASHFREE_CLIENT_SECRET') ?: '');
}
if (!defined('CASHFREE_WEBHOOK_SECRET')) {
    define('CASHFREE_WEBHOOK_SECRET', getenv('CASHFREE_WEBHOOK_SECRET') ?: CASHFREE_SECRET_KEY);
}
if (!defined('CASHFREE_ENVIRONMENT')) {
    define('CASHFREE_ENVIRONMENT', getenv('CASHFREE_ENVIRONMENT') ?: 'sandbox');
}
if (!defined('CASHFREE_API_VERSION')) {
    define('CASHFREE_API_VERSION', getenv('CASHFREE_API_VERSION') ?: '2023-08-01');
}
if (!defined('FIREBASE_WEB_API_KEY')) {
    define('FIREBASE_WEB_API_KEY', getenv('FIREBASE_WEB_API_KEY') ?: getenv('NEXT_PUBLIC_FIREBASE_API_KEY') ?: '');
}

header('Access-Control-Allow-Headers: Content-Type, Authorization');

function cashfree_is_configured(): bool
{
    return CASHFREE_APP_ID !== ''
        && CASHFREE_SECRET_KEY !== ''
        && strpos(CASHFREE_APP_ID, 'your-') !== 0;
}

function cashfree_environment(): string
{
    $env = strtolower(CASHFREE_ENVIRONMENT);
    return in_array($env, ['production', 'prod'], true) ? 'production' : 'sandbox';
}

function cashfree_base_url(): string
{
    return cashfree_environment() === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
}

/**
 * @return array{ok:bool,status?:int,body?:array,error?:string,raw?:string}
 */
function cashfree_api(string $method, string $path, array $payload = null): array
{
    if (!cashfree_is_configured()) {
        return ['ok' => false, 'error' => 'Cashfree is not configured.'];
    }
    $url = rtrim(cashfree_base_url(), '/') . '/' . ltrim($path, '/');
    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'curl_init failed'];
    }
    $headers = [
        'Content-Type: application/json',
        'x-client-id: ' . CASHFREE_APP_ID,
        'x-client-secret: ' . CASHFREE_SECRET_KEY,
        'x-api-version: ' . CASHFREE_API_VERSION,
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
    ];
    if ($payload !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($payload);
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) {
        return ['ok' => false, 'error' => $err !== '' ? $err : 'Cashfree request failed'];
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }
    return [
        'ok' => $status >= 200 && $status < 300,
        'status' => $status,
        'body' => $body,
        'raw' => $raw,
        'error' => ($status >= 200 && $status < 300)
            ? null
            : (string) ($body['message'] ?? $body['error_description'] ?? 'Cashfree API error'),
    ];
}

function cashfree_verify_webhook_signature(string $rawBody, array $headers): bool
{
    $signature = $headers['x-webhook-signature'] ?? $headers['X-Webhook-Signature'] ?? $headers['x-cf-signature'] ?? '';
    $timestamp = $headers['x-webhook-timestamp'] ?? $headers['X-Webhook-Timestamp'] ?? $headers['x-cf-timestamp'] ?? '';
    if ($signature === '' || $timestamp === '' || CASHFREE_WEBHOOK_SECRET === '') {
        return false;
    }
    $tsNum = (float) $timestamp;
    $tsMs = $tsNum < 1e11 ? $tsNum * 1000 : $tsNum;
    if (abs(microtime(true) * 1000 - $tsMs) > 300000) {
        return false;
    }
    $expected = base64_encode(hash_hmac('sha256', $timestamp . $rawBody, CASHFREE_WEBHOOK_SECRET, true));
    return hash_equals($expected, $signature);
}

function payflow_get_bearer_token(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
        return $m[1];
    }
    return '';
}

function payflow_verify_firebase_id_token(string $idToken): ?array
{
    if ($idToken === '' || FIREBASE_WEB_API_KEY === '') {
        return null;
    }
    $url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . urlencode(FIREBASE_WEB_API_KEY);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['idToken' => $idToken]),
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $status < 200 || $status >= 300) {
        return null;
    }
    $body = json_decode($raw, true);
    $user = $body['users'][0] ?? null;
    return is_array($user) ? $user : null;
}

/**
 * Prefer PayFlow agent session; fall back to ReconcileX Google session; then Firebase bearer.
 */
function payflow_require_agent(): array
{
    if (!empty($_SESSION['payflow_agent']) && is_array($_SESSION['payflow_agent'])) {
        return $_SESSION['payflow_agent'];
    }

    $token = payflow_get_bearer_token();
    if ($token !== '') {
        $fb = payflow_verify_firebase_id_token($token);
        if ($fb) {
            $email = (string) ($fb['email'] ?? '');
            $agentId = strtoupper(explode('@', $email)[0] ?: 'AGENT');
            $agent = [
                'uid' => 'agent_' . ($fb['localId'] ?? bin2hex(random_bytes(6))),
                'agentId' => $agentId,
                'email' => $email,
                'name' => (string) ($fb['displayName'] ?? $agentId),
                'mobile' => '',
            ];
            $_SESSION['payflow_agent'] = $agent;
            return $agent;
        }
    }

    $user = current_user_session();
    if ($user) {
        return [
            'uid' => $user['uid'],
            'agentId' => 'GOOGLE',
            'email' => $user['email'] ?? '',
            'name' => $user['name'] ?? 'User',
            'mobile' => '',
        ];
    }

    json_response(['error' => 'Sign in required.'], 401);
}

function payflow_wallet_get(string $uid): float
{
    $wallets = read_store('payflow_wallets.json', []);
    foreach ($wallets as $row) {
        if (($row['uid'] ?? '') === $uid) {
            return (float) ($row['balance'] ?? 0);
        }
    }
    return 0.0;
}

function payflow_wallet_credit(string $uid, float $amount, array $meta = []): float
{
    $balance = 0.0;
    mutate_store('payflow_wallets.json', function ($wallets) use ($uid, $amount, &$balance) {
        if (!is_array($wallets)) {
            $wallets = [];
        }
        $found = false;
        foreach ($wallets as $i => $row) {
            if (($row['uid'] ?? '') === $uid) {
                $wallets[$i]['balance'] = round(((float) ($row['balance'] ?? 0)) + $amount, 2);
                $wallets[$i]['updatedAt'] = gmdate('c');
                $balance = (float) $wallets[$i]['balance'];
                $found = true;
                break;
            }
        }
        if (!$found) {
            $balance = round($amount, 2);
            $wallets[] = [
                'uid' => $uid,
                'balance' => $balance,
                'updatedAt' => gmdate('c'),
            ];
        }
        return $wallets;
    }, []);

    mutate_store('payflow_ledger.json', function ($rows) use ($uid, $amount, $meta, $balance) {
        if (!is_array($rows)) {
            $rows = [];
        }
        $rows[] = array_merge([
            'id' => 'led_' . bin2hex(random_bytes(6)),
            'uid' => $uid,
            'type' => 'credit',
            'amount' => $amount,
            'balance' => $balance,
            'createdAt' => gmdate('c'),
        ], $meta);
        return $rows;
    }, []);

    return $balance;
}

function payflow_demo_mode(): bool
{
    return !razorpay_is_configured() && !cashfree_is_configured();
}
