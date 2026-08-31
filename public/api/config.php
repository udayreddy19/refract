<?php
/**
 * ReconcileX API bootstrap for ServerByt / shared hosting.
 */

if (session_status() !== PHP_SESSION_ACTIVE) {
    $httpsOn = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');

    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => $httpsOn,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://reconcilex.in',
    'https://www.reconcilex.in',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$secretsFile = __DIR__ . '/secrets.php';
if (is_readable($secretsFile)) {
    require_once $secretsFile;
}

if (!defined('GOOGLE_CLIENT_ID')) {
    define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '');
}
if (!defined('GOOGLE_CLIENT_SECRET')) {
    define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '');
}
if (!defined('GOOGLE_REDIRECT_URI')) {
    define('GOOGLE_REDIRECT_URI', getenv('GOOGLE_REDIRECT_URI') ?: 'https://reconcilex.in/api/google-callback.php');
}
if (!defined('APP_URL')) {
    define('APP_URL', getenv('APP_URL') ?: 'https://reconcilex.in');
}
if (!defined('ADMIN_PASSWORD')) {
    define('ADMIN_PASSWORD', getenv('ADMIN_PASSWORD') ?: '');
}
if (!defined('ADMIN_BILLING_PASSWORD')) {
    define('ADMIN_BILLING_PASSWORD', getenv('ADMIN_BILLING_PASSWORD') ?: '');
}
if (!defined('ADMIN_VIEWER_PASSWORD')) {
    define('ADMIN_VIEWER_PASSWORD', getenv('ADMIN_VIEWER_PASSWORD') ?: '');
}
if (!defined('GEMINI_API_KEY')) {
    define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');
}
if (!defined('MAIL_FROM')) {
    define('MAIL_FROM', getenv('MAIL_FROM') ?: 'noreply@reconcilex.in');
}
if (!defined('CRON_SECRET')) {
    define('CRON_SECRET', getenv('CRON_SECRET') ?: '');
}
if (!defined('RAZORPAY_KEY_ID')) {
    define('RAZORPAY_KEY_ID', getenv('RAZORPAY_KEY_ID') ?: '');
}
if (!defined('RAZORPAY_KEY_SECRET')) {
    define('RAZORPAY_KEY_SECRET', getenv('RAZORPAY_KEY_SECRET') ?: '');
}
if (!defined('RAZORPAY_WEBHOOK_SECRET')) {
    define('RAZORPAY_WEBHOOK_SECRET', getenv('RAZORPAY_WEBHOOK_SECRET') ?: '');
}

define('DATA_DIR', dirname(__DIR__) . '/data');

require_once __DIR__ . '/extras.php';

function google_is_configured(): bool
{
    return GOOGLE_CLIENT_ID !== ''
        && GOOGLE_CLIENT_SECRET !== ''
        && strpos(GOOGLE_CLIENT_ID, 'your-') !== 0;
}

function admin_password_configured(): bool
{
    return ADMIN_PASSWORD !== '' && ADMIN_PASSWORD !== 'change-me';
}

function razorpay_is_configured(): bool
{
    return RAZORPAY_KEY_ID !== ''
        && RAZORPAY_KEY_SECRET !== ''
        && strpos(RAZORPAY_KEY_ID, 'your-') !== 0
        && strpos(RAZORPAY_KEY_ID, 'rzp_test_xxxx') !== 0;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function current_user_session(): ?array
{
    if (empty($_SESSION['user']) || !is_array($_SESSION['user'])) {
        return null;
    }
    return $_SESSION['user'];
}

function set_user_session(array $user): void
{
    $_SESSION['user'] = [
        'uid' => $user['uid'],
        'name' => $user['name'],
        'email' => $user['email'],
        'avatar' => $user['avatar'],
        'isPro' => !empty($user['isPro']),
        'selectedPlan' => $user['selectedPlan'] ?? ($user['plan'] ?? null),
        'utrValue' => $user['utrValue'] ?? null,
        'photoURL' => $user['photoURL'] ?? null,
        'paymentStatus' => $user['paymentStatus'] ?? null,
    ];
}

function clear_user_session(): void
{
    unset($_SESSION['user']);
}

function is_admin_authenticated(): bool
{
    return !empty($_SESSION['admin']) && is_array($_SESSION['admin']);
}

function admin_role(): string
{
    $role = $_SESSION['admin']['role'] ?? 'viewer';
    return in_array($role, ['viewer', 'billing', 'super'], true) ? $role : 'viewer';
}

function require_admin(): void
{
    if (!is_admin_authenticated()) {
        json_response(['error' => 'Admin authentication required.'], 401);
    }
}

/** @param array<int, string> $roles */
function require_admin_role(array $roles): void
{
    require_admin();
    if (!in_array(admin_role(), $roles, true)) {
        json_response(['error' => 'Your admin role cannot perform this action.'], 403);
    }
}

function resolve_admin_role_from_password(string $password): ?string
{
    if ($password === '') {
        return null;
    }
    if (ADMIN_PASSWORD !== '' && hash_equals(ADMIN_PASSWORD, $password)) {
        return 'super';
    }
    if (ADMIN_BILLING_PASSWORD !== '' && hash_equals(ADMIN_BILLING_PASSWORD, $password)) {
        return 'billing';
    }
    if (ADMIN_VIEWER_PASSWORD !== '' && hash_equals(ADMIN_VIEWER_PASSWORD, $password)) {
        return 'viewer';
    }
    return null;
}

function require_user(): array
{
    $user = current_user_session();
    if (!$user) {
        json_response(['error' => 'Sign in required.'], 401);
    }
    return $user;
}

function get_initials(string $name): string
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $initials = '';
    foreach ($parts as $part) {
        if ($part !== '') {
            $initials .= strtoupper($part[0]);
        }
        if (strlen($initials) >= 2) {
            break;
        }
    }
    return $initials !== '' ? $initials : 'U';
}

function ensure_data_dir(): void
{
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0750, true);
    }
}

function data_path(string $file): string
{
    ensure_data_dir();
    return DATA_DIR . '/' . $file;
}

function default_settings(): array
{
    return [
        'upiId' => 'paytmqr28100505050101fi5qu5@paytm',
        'qrPath' => '/paytm_qr.jpg',
        'payeeName' => 'ReconcileX',
        'plans' => [
            'monthly' => ['label' => 'Monthly', 'amount' => 4999],
            'quarterly' => ['label' => 'Quarterly', 'amount' => 9999],
            'annual' => ['label' => 'Annual', 'amount' => 29999],
        ],
        'gstin' => '',
        'gstRate' => 18,
        'billingAddress' => "ReconcileX\nIndia",
        'razorpayPlanIds' => [
            'monthly' => '',
            'quarterly' => '',
            'annual' => '',
        ],
        'featureFlags' => [
            'sampleDemo' => true,
            'trialCodes' => true,
            'agencyBrands' => true,
            'exceptionDigest' => true,
            'csvReplay' => true,
            'maintenanceMode' => false,
            'publicChangelog' => true,
        ],
        'matchRules' => [
            'settlementWindowDays' => 5,
            'amountTolerancePaise' => 100,
            'feePct' => 0.02,
            'feeAnomalyFactor' => 1.05,
            'fuzzyWindowDays' => 3,
        ],
        'announcement' => [
            'enabled' => false,
            'message' => '',
            'level' => 'info',
        ],
        'alerts' => [
            'enabled' => true,
            'thresholdInr' => 10000,
            'email' => '',
            'slackWebhook' => '',
        ],
        'updatedAt' => null,
    ];
}

/**
 * @return array<int, mixed>|array<string, mixed>
 */
function read_store(string $file, $default = [])
{
    return store_read_payload($file, $default);
}

function write_store(string $file, $data): bool
{
    return store_write_payload($file, $data);
}

/**
 * Atomically read-modify-write a store under an exclusive lock (JSON flock + SQLite mirror).
 * @param callable $mutator function(array $current): array
 */
function mutate_store(string $file, callable $mutator, $default = [])
{
    $path = data_path($file);
    if (!file_exists($path)) {
        // Seed from SQLite / existing if any
        $seed = store_read_payload($file, $default);
        if (is_array($seed) && $seed !== $default) {
            @file_put_contents($path, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            touch($path);
        }
    }
    $fp = fopen($path, 'c+');
    if ($fp === false) {
        return $default;
    }
    try {
        if (!flock($fp, LOCK_EX)) {
            return $default;
        }
        $raw = stream_get_contents($fp);
        $current = [];
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            $current = is_array($decoded) ? $decoded : $default;
        } else {
            $fromDb = store_read_payload($file, $default);
            $current = is_array($fromDb) ? $fromDb : $default;
        }
        $next = $mutator($current);
        if (!is_array($next)) {
            $next = $default;
        }
        $json = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return $current;
        }
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);

        // Mirror to SQLite (best-effort)
        $db = sqlite_pdo();
        if ($db) {
            try {
                $stmt = $db->prepare(
                    'INSERT INTO stores(name, payload, updated_at) VALUES(?,?,?)
                     ON CONFLICT(name) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at'
                );
                $stmt->execute([$file, $json, gmdate('c')]);
            } catch (Throwable $e) {
                // ignore mirror failures
            }
        }
        return $next;
    } finally {
        fclose($fp);
    }
}

function sanitize_oauth_return_path(?string $path): string
{
    if ($path === null || $path === '') {
        return '/';
    }
    $path = trim($path);
    if ($path[0] !== '/' || strpos($path, '//') === 0 || strpos($path, '\\') !== false) {
        return '/';
    }
    // Only allow same-site relative paths
    if (preg_match('#^(https?:)?//#i', $path)) {
        return '/';
    }
    $allowed = ['/', '/results', '/admin', '/account', '/pricing', '/connections', '/status', '/contact', '/privacy', '/terms', '/changelog'];
    $parts = parse_url($path);
    $base = isset($parts['path']) ? $parts['path'] : '/';
    if (!is_string($base)) {
        return '/';
    }
    $ok = false;
    foreach ($allowed as $prefix) {
        if ($base === $prefix || ($prefix !== '/' && strpos($base, $prefix . '/') === 0)) {
            $ok = true;
            break;
        }
    }
    if (!$ok) {
        return '/';
    }
    // Preserve a small allow-list of query flags (e.g. reopen checkout after Google)
    $query = [];
    if (!empty($parts['query'])) {
        parse_str($parts['query'], $q);
        if (isset($q['checkout']) && (string) $q['checkout'] === '1') {
            $query['checkout'] = '1';
        }
        if (isset($q['plan']) && in_array((string) $q['plan'], ['monthly', 'quarterly', 'annual'], true)) {
            $query['plan'] = (string) $q['plan'];
        }
    }
    if ($query) {
        return $base . '?' . http_build_query($query);
    }
    return $base;
}

function get_settings(): array
{
    $settings = read_store('settings.json', null);
    if (!is_array($settings)) {
        $settings = default_settings();
        write_store('settings.json', $settings);
    }
    return array_replace_recursive(default_settings(), $settings);
}

function get_users(): array
{
    $users = read_store('users.json', []);
    return is_array($users) ? array_values($users) : [];
}

function save_users(array $users): bool
{
    return write_store('users.json', array_values($users));
}

function find_user_by_uid(string $uid): ?array
{
    foreach (get_users() as $user) {
        if (($user['uid'] ?? '') === $uid) {
            return $user;
        }
    }
    return null;
}

function upsert_user(array $incoming): array
{
    $now = gmdate('c');
    $result = null;
    mutate_store('users.json', function ($users) use ($incoming, $now, &$result) {
        if (!is_array($users)) {
            $users = [];
        }
        $users = array_values($users);
        $idx = -1;
        foreach ($users as $i => $user) {
            if (($user['uid'] ?? '') === ($incoming['uid'] ?? '')) {
                $idx = $i;
                break;
            }
        }

        if ($idx >= 0) {
            $existing = $users[$idx];
            $merged = array_merge($existing, $incoming);
            $merged['createdAt'] = $existing['createdAt'] ?? $now;
            $merged['lastLoginAt'] = $incoming['lastLoginAt'] ?? $now;
            $merged['isPro'] = !empty($existing['isPro']) || !empty($incoming['isPro']);
            if (empty($incoming['plan']) && !empty($existing['plan'])) {
                $merged['plan'] = $existing['plan'];
            }
            if (empty($incoming['utrValue']) && !empty($existing['utrValue'])) {
                $merged['utrValue'] = $existing['utrValue'];
            }
            $users[$idx] = $merged;
            $result = $merged;
            return $users;
        }

        $created = array_merge([
            'isPro' => false,
            'plan' => null,
            'utrValue' => null,
            'status' => 'active',
            'createdAt' => $now,
            'lastLoginAt' => $now,
        ], $incoming);
        $users[] = $created;
        $result = $created;
        return $users;
    }, []);

    return is_array($result) ? $result : $incoming;
}

function update_user(string $uid, array $patch): ?array
{
    $updated = null;
    mutate_store('users.json', function ($users) use ($uid, $patch, &$updated) {
        if (!is_array($users)) {
            $users = [];
        }
        $users = array_values($users);
        foreach ($users as $i => $user) {
            if (($user['uid'] ?? '') !== $uid) {
                continue;
            }
            $users[$i] = array_merge($user, $patch);
            $updated = $users[$i];
            break;
        }
        return $users;
    }, []);
    return $updated;
}

function get_payments(): array
{
    $payments = read_store('payments.json', []);
    return is_array($payments) ? array_values($payments) : [];
}

function save_payments(array $payments): bool
{
    return write_store('payments.json', array_values($payments));
}

function plan_amount(string $plan): int
{
    $settings = get_settings();
    return (int) ($settings['plans'][$plan]['amount'] ?? 0);
}

function append_audit(string $action, array $meta = []): void
{
    mutate_store('audit.json', function ($rows) use ($action, $meta) {
        if (!is_array($rows)) {
            $rows = [];
        }
        $rows[] = array_merge([
            'id' => 'aud_' . bin2hex(random_bytes(6)),
            'action' => $action,
            'at' => gmdate('c'),
            'actor' => 'admin',
        ], $meta);
        // Keep last 500 events
        if (count($rows) > 500) {
            $rows = array_slice($rows, -500);
        }
        return array_values($rows);
    }, []);
}

function get_audit(int $limit = 100): array
{
    $rows = read_store('audit.json', []);
    if (!is_array($rows)) {
        return [];
    }
    $rows = array_values($rows);
    usort($rows, function ($a, $b) {
        return strcmp((string) ($b['at'] ?? ''), (string) ($a['at'] ?? ''));
    });
    return array_slice($rows, 0, max(1, $limit));
}

function send_app_mail(string $to, string $subject, string $body): bool
{
    if ($to === '' || strpos($to, '@') === false) {
        return false;
    }
    $from = defined('MAIL_FROM') && MAIL_FROM !== '' ? MAIL_FROM : 'noreply@reconcilex.in';
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/plain; charset=UTF-8',
        'From: ReconcileX <' . $from . '>',
        'Reply-To: ' . $from,
    ];
    return @mail($to, $subject, $body, implode("\r\n", $headers));
}

function notify_pro_approved(array $user, string $plan): void
{
    $email = (string) ($user['email'] ?? '');
    $name = (string) ($user['name'] ?? 'there');
    $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
    $subject = 'ReconcileX Pro is active';
    $body = "Hi {$name},\n\nYour ReconcileX Pro ({$plan}) access is now active.\n\nYou can export full Excel reports from your next reconciliation.\n\nOpen {$app}/account to view your plan.\n\n— ReconcileX\n";
    send_app_mail($email, $subject, $body);
}

/**
 * @return array{ok:bool,status?:int,body?:array,error?:string,raw?:string}
 */
function razorpay_api(string $method, string $path, array $payload = null): array
{
    if (!razorpay_is_configured()) {
        return ['ok' => false, 'error' => 'Razorpay is not configured.'];
    }
    $url = 'https://api.razorpay.com/v1/' . ltrim($path, '/');
    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'curl_init failed'];
    }
    $headers = ['Content-Type: application/json'];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => RAZORPAY_KEY_ID . ':' . RAZORPAY_KEY_SECRET,
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
        return ['ok' => false, 'error' => $err !== '' ? $err : 'Razorpay request failed'];
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
        'error' => ($status >= 200 && $status < 300) ? null : (string) ($body['error']['description'] ?? 'Razorpay API error'),
    ];
}

function razorpay_verify_payment_signature(string $orderId, string $paymentId, string $signature): bool
{
    $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, RAZORPAY_KEY_SECRET);
    return hash_equals($expected, $signature);
}

function activate_pro_from_payment(array $payment, string $note = ''): array
{
    $now = gmdate('c');
    $uid = (string) ($payment['userId'] ?? '');
    $plan = (string) ($payment['plan'] ?? 'monthly');
    $utr = (string) ($payment['utr'] ?? $payment['razorpayPaymentId'] ?? '');
    $expires = compute_pro_expires_at($plan, $now);

    $user = update_user($uid, [
        'isPro' => true,
        'plan' => $plan,
        'utrValue' => $utr !== '' ? $utr : null,
        'proUpdatedAt' => $now,
        'proExpiresAt' => $expires,
        'status' => 'active',
        'pendingPaymentId' => null,
        'pendingPlan' => null,
        'autoRenew' => !empty($payment['autoRenew']),
        'razorpaySubscriptionId' => $payment['razorpaySubscriptionId'] ?? null,
    ]);

    if (!$user) {
        $user = upsert_user([
            'uid' => $uid,
            'email' => $payment['email'] ?? '',
            'name' => $payment['name'] ?? ($payment['email'] ?? 'User'),
            'avatar' => get_initials((string) ($payment['name'] ?? $payment['email'] ?? 'U')),
            'isPro' => true,
            'plan' => $plan,
            'utrValue' => $utr !== '' ? $utr : null,
            'proExpiresAt' => $expires,
            'lastLoginAt' => $now,
        ]);
    }

    $sessionUser = current_user_session();
    if ($sessionUser && ($sessionUser['uid'] ?? '') === $uid) {
        set_user_session(array_merge($sessionUser, [
            'isPro' => true,
            'selectedPlan' => $plan,
            'utrValue' => $utr !== '' ? $utr : null,
            'paymentStatus' => 'approved',
        ]));
    }

    if (is_array($user)) {
        notify_pro_approved($user, $plan);
        notify_payment_receipt($user, $payment);
    }

    track_analytics('payment_success', [
        'plan' => $plan,
        'method' => $payment['method'] ?? '',
        'amount' => $payment['amount'] ?? 0,
    ], $uid);

    append_audit('payment_razorpay_approved', [
        'paymentId' => $payment['id'] ?? '',
        'userId' => $uid,
        'plan' => $plan,
        'razorpayPaymentId' => $payment['razorpayPaymentId'] ?? '',
        'note' => $note,
        'proExpiresAt' => $expires,
    ]);

    return is_array($user) ? $user : [];
}


