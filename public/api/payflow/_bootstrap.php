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
 * Prefer PayFlow agent session; then Firebase bearer mapped to a registered agent.
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
            if (($registered['status'] ?? 'active') === 'disabled') {
                json_response(['error' => 'This retailer account is disabled. Contact support.'], 403);
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

    $entryType = $meta['type'] ?? ($amount >= 0 ? 'credit' : 'debit');
    mutate_store('payflow_ledger.json', function ($rows) use ($uid, $amount, $meta, $balance, $entryType) {
        if (!is_array($rows)) {
            $rows = [];
        }
        $rows[] = array_merge([
            'id' => 'led_' . bin2hex(random_bytes(6)),
            'uid' => $uid,
            'type' => $entryType,
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
    // Never allow simulated wallet credits in production.
    if (payflow_is_production()) {
        return false;
    }
    $allow = getenv('PAYFLOW_ALLOW_DEMO') ?: (defined('PAYFLOW_ALLOW_DEMO') ? (string) PAYFLOW_ALLOW_DEMO : '0');
    if (!in_array(strtolower((string) $allow), ['1', 'true', 'yes'], true)) {
        return false;
    }
    return !razorpay_is_configured() && !cashfree_is_configured();
}

function payflow_is_production(): bool
{
    $env = strtolower((string) (getenv('APP_ENV') ?: (defined('APP_ENV') ? APP_ENV : 'production')));
    return !in_array($env, ['local', 'development', 'dev', 'test'], true);
}

function payflow_hash_passcode(string $passcode): string
{
    return password_hash($passcode, PASSWORD_DEFAULT);
}

function payflow_verify_passcode(string $passcode, string $stored): bool
{
    if ($passcode === '' || $stored === '') {
        return false;
    }
    if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2a$') || str_starts_with($stored, '$argon2')) {
        return password_verify($passcode, $stored);
    }
    // Legacy plaintext — verify then upgrade on successful login
    return hash_equals($stored, $passcode);
}

function payflow_passcode_needs_rehash(string $stored): bool
{
    if ($stored === '') {
        return true;
    }
    if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2a$') || str_starts_with($stored, '$argon2')) {
        return password_needs_rehash($stored, PASSWORD_DEFAULT);
    }
    return true;
}

/** @return array<int, array<string, mixed>> */
function payflow_default_agents(): array
{
    // Production starts empty — create retailers from Admin.
    return [];
}

/** @return array<int, array<string, mixed>> */
function payflow_agents_all(): array
{
    $agents = read_store('payflow_agents.json', []);
    if (!is_array($agents)) {
        $agents = [];
    }
    return array_values($agents);
}

function payflow_agent_set_passcode(string $uid, string $passcode): void
{
    $hash = payflow_hash_passcode($passcode);
    mutate_store('payflow_agents.json', function ($agents) use ($uid, $hash) {
        if (!is_array($agents)) {
            $agents = [];
        }
        foreach ($agents as $i => $row) {
            if (($row['uid'] ?? '') === $uid) {
                $agents[$i]['passcode'] = $hash;
                $agents[$i]['updatedAt'] = gmdate('c');
                break;
            }
        }
        return $agents;
    }, []);
}

/**
 * Mark deposit paid+credited atomically. Returns deposit row when credit should run (first time only).
 * @return array{deposit:?array,shouldCredit:bool}
 */
function payflow_deposit_mark_paid_and_claim_credit(string $matchOrderId, string $paymentId, string $utr, ?int $amountPaise = null, ?string $depositIdHint = null): array
{
    $shouldCredit = false;
    $deposit = null;
    mutate_store('payflow_deposits.json', function ($rows) use ($matchOrderId, $paymentId, $utr, $amountPaise, $depositIdHint, &$shouldCredit, &$deposit) {
        if (!is_array($rows)) {
            $rows = [];
        }
        foreach ($rows as $i => $row) {
            $orderMatch = $matchOrderId !== '' && ($row['orderId'] ?? '') === $matchOrderId;
            $idMatch = $depositIdHint !== null && $depositIdHint !== '' && ($row['id'] ?? '') === $depositIdHint;
            if (!$orderMatch && !$idMatch) {
                continue;
            }
            if (!empty($row['_credited'])) {
                $deposit = $rows[$i];
                $shouldCredit = false;
                return $rows;
            }
            if ($amountPaise !== null && $amountPaise > 0 && (int) ($row['amountPaise'] ?? 0) !== $amountPaise) {
                $rows[$i]['status'] = 'AMOUNT_MISMATCH';
                $deposit = $rows[$i];
                $shouldCredit = false;
                return $rows;
            }
            $rows[$i]['status'] = 'PAID';
            $rows[$i]['paymentId'] = $paymentId;
            $rows[$i]['utr'] = $utr;
            $rows[$i]['paidAt'] = gmdate('c');
            $rows[$i]['updatedAt'] = gmdate('c');
            $rows[$i]['_credited'] = true;
            $deposit = $rows[$i];
            $shouldCredit = true;
            break;
        }
        return $rows;
    }, []);

    return ['deposit' => $deposit, 'shouldCredit' => $shouldCredit];
}

function payflow_agent_public(array $agent, bool $withBalance = true): array
{
    $uid = (string) ($agent['uid'] ?? '');
    $out = [
        'uid' => $uid,
        'agentId' => (string) ($agent['agentId'] ?? ''),
        'name' => (string) ($agent['name'] ?? ''),
        'email' => (string) ($agent['email'] ?? ''),
        'mobile' => (string) ($agent['mobile'] ?? ''),
        'status' => (string) ($agent['status'] ?? 'active'),
        'city' => (string) ($agent['city'] ?? ''),
        'notes' => (string) ($agent['notes'] ?? ''),
        'createdAt' => (string) ($agent['createdAt'] ?? ''),
        'updatedAt' => (string) ($agent['updatedAt'] ?? ''),
        'lastLoginAt' => $agent['lastLoginAt'] ?? null,
    ];
    if ($withBalance && $uid !== '') {
        $out['balance'] = payflow_wallet_get($uid);
    }
    return $out;
}

function payflow_find_agent(?string $agentId = null, ?string $uid = null, ?string $mobile = null): ?array
{
    $agentId = $agentId !== null ? strtoupper(trim($agentId)) : null;
    $uid = $uid !== null ? trim($uid) : null;
    $digits = $mobile !== null ? preg_replace('/\D+/', '', $mobile) : '';
    foreach (payflow_agents_all() as $agent) {
        if ($uid !== null && $uid !== '' && ($agent['uid'] ?? '') === $uid) {
            return $agent;
        }
        if ($agentId !== null && $agentId !== '' && strtoupper((string) ($agent['agentId'] ?? '')) === $agentId) {
            return $agent;
        }
        if ($digits !== '' && strlen($digits) >= 10) {
            $m = preg_replace('/\D+/', '', (string) ($agent['mobile'] ?? ''));
            if ($m !== '' && substr($m, -10) === substr($digits, -10)) {
                return $agent;
            }
        }
    }
    return null;
}

/**
 * @param callable(array):array $mutator
 * @return array<string, mixed>|null
 */
function payflow_agents_mutate(callable $mutator): ?array
{
    $result = null;
    mutate_store('payflow_agents.json', function ($agents) use ($mutator, &$result) {
        if (!is_array($agents) || count($agents) === 0) {
            $agents = [];
        }
        $agents = $mutator($agents);
        if (!is_array($agents)) {
            $agents = [];
        }
        return array_values($agents);
    }, []);
    return $result;
}

function payflow_agent_touch_login(string $uid): void
{
    mutate_store('payflow_agents.json', function ($agents) use ($uid) {
        if (!is_array($agents)) {
            $agents = [];
        }
        foreach ($agents as $i => $row) {
            if (($row['uid'] ?? '') === $uid) {
                $agents[$i]['lastLoginAt'] = gmdate('c');
                break;
            }
        }
        return $agents;
    }, []);
}

/** @return array<int, array<string, mixed>> */
function payflow_ledger_all(?string $uid = null, int $limit = 200): array
{
    $rows = read_store('payflow_ledger.json', []);
    if (!is_array($rows)) {
        $rows = [];
    }
    if ($uid !== null && $uid !== '') {
        $rows = array_values(array_filter($rows, static function ($r) use ($uid) {
            return is_array($r) && ($r['uid'] ?? '') === $uid;
        }));
    }
    usort($rows, static function ($a, $b) {
        return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
    });
    if ($limit > 0) {
        $rows = array_slice($rows, 0, $limit);
    }
    return $rows;
}
