<?php
/**
 * ReconcileX agent helpers — wallet deposits via Razorpay + Cashfree.
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

require_once __DIR__ . '/store.php';

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
 * Prefer agent session; then Firebase bearer mapped to a registered agent.
 */
function payflow_require_agent(): array
{
    if (!empty($_SESSION['payflow_agent']) && is_array($_SESSION['payflow_agent'])) {
        $session = $_SESSION['payflow_agent'];
        $registered = payflow_find_agent(
            isset($session['agentId']) ? (string) $session['agentId'] : null,
            isset($session['uid']) ? (string) $session['uid'] : null
        );
        if (!$registered || ($registered['status'] ?? 'active') === 'disabled') {
            unset($_SESSION['payflow_agent']);
            json_response(['error' => 'Retailer account is disabled or not found.'], 403);
        }
        $block = payflow_agent_can_transact($registered);
        if ($block) {
            unset($_SESSION['payflow_agent']);
            json_response(['error' => $block], 403);
        }
        $session['uid'] = (string) $registered['uid'];
        $session['agentId'] = (string) $registered['agentId'];
        $_SESSION['payflow_agent'] = $session;
        return $session;
    }

    $token = payflow_get_bearer_token();
    if ($token !== '') {
        $fb = payflow_verify_firebase_id_token($token);
        if ($fb) {
            $email = (string) ($fb['email'] ?? '');
            $agentIdHint = strtoupper(explode('@', $email)[0] ?: '');
            $registered = payflow_find_agent($agentIdHint !== '' ? $agentIdHint : null, null, null);
            if (!$registered && $email !== '') {
                foreach (payflow_agents_all() as $row) {
                    if (strcasecmp((string) ($row['email'] ?? ''), $email) === 0) {
                        $registered = $row;
                        break;
                    }
                }
            }
            if (!$registered) {
                json_response(['error' => 'No retailer account linked to this login. Contact admin.'], 403);
            }
            $block = payflow_agent_can_transact($registered);
            if ($block) {
                json_response(['error' => $block], 403);
            }
            $agent = [
                'uid' => (string) $registered['uid'],
                'agentId' => (string) $registered['agentId'],
                'email' => $email !== '' ? $email : (string) ($registered['email'] ?? ''),
                'name' => (string) ($fb['displayName'] ?? $registered['name'] ?? $registered['agentId']),
                'mobile' => (string) ($registered['mobile'] ?? ''),
                'firebaseUid' => $fb['localId'] ?? null,
            ];
            $_SESSION['payflow_agent'] = $agent;
            return $agent;
        }
    }

    json_response(['error' => 'Sign in required.'], 401);
}
