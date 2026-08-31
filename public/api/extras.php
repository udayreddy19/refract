<?php
/**
 * Extended helpers: SQLite store, rate limits, mail, teams, runs, analytics, GST, Pro expiry.
 * Included from config.php.
 */

function sqlite_pdo(): ?PDO
{
    static $pdo = false;
    if ($pdo !== false) {
        return $pdo instanceof PDO ? $pdo : null;
    }
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        $pdo = null;
        return null;
    }
    try {
        $path = data_path('reconcilex.sqlite');
        $instance = new PDO('sqlite:' . $path);
        $instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $instance->exec('PRAGMA journal_mode=WAL;');
        $instance->exec(
            'CREATE TABLE IF NOT EXISTS stores (
                name TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )'
        );
        $instance->exec(
            'CREATE TABLE IF NOT EXISTS rate_limits (
                bucket TEXT PRIMARY KEY,
                window_start INTEGER NOT NULL,
                hit_count INTEGER NOT NULL
            )'
        );
        $instance->exec(
            'CREATE TABLE IF NOT EXISTS analytics_events (
                id TEXT PRIMARY KEY,
                event TEXT NOT NULL,
                at TEXT NOT NULL,
                uid TEXT,
                meta TEXT
            )'
        );
        $instance->exec(
            'CREATE INDEX IF NOT EXISTS idx_analytics_event_at ON analytics_events(event, at)'
        );
        $pdo = $instance;
        return $instance;
    } catch (Throwable $e) {
        $pdo = null;
        return null;
    }
}

function sqlite_available(): bool
{
    return sqlite_pdo() !== null;
}

/**
 * Dual-write: SQLite primary when available, JSON file always kept as mirror.
 */
function store_read_payload(string $file, $default = [])
{
    $db = sqlite_pdo();
    if ($db) {
        try {
            $stmt = $db->prepare('SELECT payload FROM stores WHERE name = ? LIMIT 1');
            $stmt->execute([$file]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && isset($row['payload'])) {
                $decoded = json_decode((string) $row['payload'], true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
            // Migrate from JSON file if present
            $path = data_path($file);
            if (is_readable($path)) {
                $raw = file_get_contents($path);
                if (is_string($raw) && trim($raw) !== '') {
                    $decoded = json_decode($raw, true);
                    if (is_array($decoded)) {
                        store_write_payload($file, $decoded);
                        return $decoded;
                    }
                }
            }
            return $default;
        } catch (Throwable $e) {
            // fall through to JSON
        }
    }

    $path = data_path($file);
    if (!is_readable($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return $default;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

function store_write_payload(string $file, $data): bool
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        return false;
    }

    $db = sqlite_pdo();
    if ($db) {
        try {
            $stmt = $db->prepare(
                'INSERT INTO stores(name, payload, updated_at) VALUES(?,?,?)
                 ON CONFLICT(name) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at'
            );
            $stmt->execute([$file, $json, gmdate('c')]);
        } catch (Throwable $e) {
            // still try JSON
        }
    }

    $path = data_path($file);
    if (!file_exists($path)) {
        touch($path);
    }
    $fp = fopen($path, 'c+');
    if ($fp === false) {
        return false;
    }
    try {
        if (!flock($fp, LOCK_EX)) {
            return false;
        }
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        return true;
    } finally {
        fclose($fp);
    }
}

function client_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? '',
    ];
    foreach ($candidates as $raw) {
        if ($raw === '') {
            continue;
        }
        $ip = trim(explode(',', $raw)[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '0.0.0.0';
}

/**
 * Sliding window rate limit. Returns true if allowed; exits with 429 if exceeded when $hard=true.
 */
function rate_limit_check(string $bucket, int $max, int $windowSeconds, bool $hard = true): bool
{
    $key = $bucket . '|' . client_ip();
    $now = time();
    $db = sqlite_pdo();

    if ($db) {
        try {
            $db->beginTransaction();
            $stmt = $db->prepare('SELECT window_start, hit_count FROM rate_limits WHERE bucket = ?');
            $stmt->execute([$key]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row || ($now - (int) $row['window_start']) >= $windowSeconds) {
                $ups = $db->prepare(
                    'INSERT INTO rate_limits(bucket, window_start, hit_count) VALUES(?,?,1)
                     ON CONFLICT(bucket) DO UPDATE SET window_start=excluded.window_start, hit_count=1'
                );
                $ups->execute([$key, $now]);
                $db->commit();
                return true;
            }
            $count = (int) $row['hit_count'];
            if ($count >= $max) {
                $db->commit();
                if ($hard) {
                    json_response(['error' => 'Too many requests. Try again shortly.'], 429);
                }
                return false;
            }
            $ups = $db->prepare('UPDATE rate_limits SET hit_count = hit_count + 1 WHERE bucket = ?');
            $ups->execute([$key]);
            $db->commit();
            return true;
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
        }
    }

    // File fallback
    $path = data_path('rate_limits.json');
    $all = [];
    if (is_readable($path)) {
        $decoded = json_decode((string) file_get_contents($path), true);
        $all = is_array($decoded) ? $decoded : [];
    }
    $entry = $all[$key] ?? null;
    if (!is_array($entry) || ($now - (int) ($entry['start'] ?? 0)) >= $windowSeconds) {
        $all[$key] = ['start' => $now, 'count' => 1];
    } else {
        if ((int) ($entry['count'] ?? 0) >= $max) {
            if ($hard) {
                json_response(['error' => 'Too many requests. Try again shortly.'], 429);
            }
            return false;
        }
        $all[$key]['count'] = (int) $entry['count'] + 1;
    }
    // prune old
    foreach ($all as $k => $v) {
        if (!is_array($v) || ($now - (int) ($v['start'] ?? 0)) > 86400) {
            unset($all[$k]);
        }
    }
    @file_put_contents($path, json_encode($all), LOCK_EX);
    return true;
}

function plan_duration_days(string $plan): int
{
    if ($plan === 'annual') {
        return 365;
    }
    if ($plan === 'quarterly') {
        return 90;
    }
    return 30;
}

function compute_pro_expires_at(string $plan, ?string $fromIso = null): string
{
    $base = $fromIso ? strtotime($fromIso) : time();
    if ($base === false) {
        $base = time();
    }
    return gmdate('c', $base + plan_duration_days($plan) * 86400);
}

function gst_rate(): float
{
    $settings = get_settings();
    $rate = isset($settings['gstRate']) ? (float) $settings['gstRate'] : 18.0;
    return $rate > 0 ? $rate : 18.0;
}

function invoice_breakdown(int $amountInr): array
{
    $rate = gst_rate();
    $taxable = round($amountInr / (1 + $rate / 100), 2);
    $gst = round($amountInr - $taxable, 2);
    $cgst = round($gst / 2, 2);
    $sgst = round($gst - $cgst, 2);
    return [
        'total' => $amountInr,
        'taxable' => $taxable,
        'gstRate' => $rate,
        'gst' => $gst,
        'cgst' => $cgst,
        'sgst' => $sgst,
    ];
}

function notify_payment_submitted(array $user, array $payment): void
{
    $email = (string) ($user['email'] ?? $payment['email'] ?? '');
    $name = (string) ($user['name'] ?? $payment['name'] ?? 'there');
    $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
    $plan = (string) ($payment['plan'] ?? '');
    $utr = (string) ($payment['utr'] ?? '');
    $amount = (int) ($payment['amount'] ?? 0);
    $subject = 'ReconcileX payment received — pending verification';
    $body = "Hi {$name},\n\nWe received your UTR submission for Pro ({$plan}).\n\nAmount: ₹{$amount}\nUTR: {$utr}\n\nAn admin will verify and activate Pro shortly. Track status at {$app}/account\n\n— ReconcileX\n";
    send_app_mail($email, $subject, $body);
}

function notify_payment_receipt(array $user, array $payment): void
{
    $email = (string) ($user['email'] ?? $payment['email'] ?? '');
    $name = (string) ($user['name'] ?? $payment['name'] ?? 'there');
    $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
    $plan = (string) ($payment['plan'] ?? '');
    $amount = (int) ($payment['amount'] ?? 0);
    $ref = (string) ($payment['razorpayPaymentId'] ?? $payment['utr'] ?? $payment['id'] ?? '');
    $id = (string) ($payment['id'] ?? '');
    $breakdown = invoice_breakdown($amount);
    $subject = 'ReconcileX payment receipt';
    $body = "Hi {$name},\n\nPayment confirmed for ReconcileX Pro ({$plan}).\n\n"
        . "Invoice: {$id}\nReference: {$ref}\nTaxable: ₹{$breakdown['taxable']}\n"
        . "GST ({$breakdown['gstRate']}%): ₹{$breakdown['gst']}\nTotal: ₹{$amount}\n\n"
        . "Download invoice: {$app}/api/payments/invoice.php?id=" . rawurlencode($id) . "\n"
        . "Account: {$app}/account\n\n— ReconcileX\n";
    send_app_mail($email, $subject, $body);
}

function notify_payment_failed(array $user, array $payment, string $reason = ''): void
{
    $email = (string) ($user['email'] ?? $payment['email'] ?? '');
    $name = (string) ($user['name'] ?? $payment['name'] ?? 'there');
    $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
    $subject = 'ReconcileX payment failed';
    $extra = $reason !== '' ? "\nReason: {$reason}\n" : "\n";
    $body = "Hi {$name},\n\nYour Razorpay payment did not complete.{$extra}\nYou can retry from {$app}/pricing\n\n— ReconcileX\n";
    send_app_mail($email, $subject, $body);
}

function notify_refund(array $user, array $payment): void
{
    $email = (string) ($user['email'] ?? $payment['email'] ?? '');
    $name = (string) ($user['name'] ?? $payment['name'] ?? 'there');
    $amount = (int) ($payment['amount'] ?? 0);
    $subject = 'ReconcileX refund processed';
    $body = "Hi {$name},\n\nA refund of ₹{$amount} has been processed for payment {$payment['id']}.\nPro access may have been revoked if this was your active plan.\n\n— ReconcileX\n";
    send_app_mail($email, $subject, $body);
}

function track_analytics(string $event, array $meta = [], ?string $uid = null): void
{
    $event = preg_replace('/[^a-z0-9_\-\.]/i', '', $event) ?: 'unknown';
    $id = 'evt_' . bin2hex(random_bytes(8));
    $at = gmdate('c');
    $metaJson = json_encode($meta);
    $db = sqlite_pdo();
    if ($db) {
        try {
            $stmt = $db->prepare(
                'INSERT INTO analytics_events(id, event, at, uid, meta) VALUES(?,?,?,?,?)'
            );
            $stmt->execute([$id, $event, $at, $uid, $metaJson]);
            // Cap at ~5000
            $db->exec(
                'DELETE FROM analytics_events WHERE id IN (
                    SELECT id FROM analytics_events ORDER BY at DESC LIMIT -1 OFFSET 5000
                )'
            );
            return;
        } catch (Throwable $e) {
            // fall through
        }
    }
    mutate_store('analytics.json', function ($rows) use ($id, $event, $at, $uid, $meta) {
        if (!is_array($rows)) {
            $rows = [];
        }
        $rows[] = ['id' => $id, 'event' => $event, 'at' => $at, 'uid' => $uid, 'meta' => $meta];
        if (count($rows) > 5000) {
            $rows = array_slice($rows, -5000);
        }
        return array_values($rows);
    }, []);
}

function get_analytics_summary(int $days = 30): array
{
    $since = gmdate('c', time() - max(1, $days) * 86400);
    $counts = [];
    $db = sqlite_pdo();
    if ($db) {
        try {
            $stmt = $db->prepare(
                'SELECT event, COUNT(*) AS c FROM analytics_events WHERE at >= ? GROUP BY event'
            );
            $stmt->execute([$since]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $counts[(string) $row['event']] = (int) $row['c'];
            }
        } catch (Throwable $e) {
            $counts = [];
        }
    }
    if (!$counts) {
        $rows = read_store('analytics.json', []);
        if (is_array($rows)) {
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                if (strcmp((string) ($row['at'] ?? ''), $since) < 0) {
                    continue;
                }
                $ev = (string) ($row['event'] ?? 'unknown');
                $counts[$ev] = ($counts[$ev] ?? 0) + 1;
            }
        }
    }

    $payments = get_payments();
    $approved = 0;
    $failed = 0;
    $refunded = 0;
    $revenue = 0;
    foreach ($payments as $p) {
        if (strcmp((string) ($p['createdAt'] ?? ''), $since) < 0) {
            continue;
        }
        $st = $p['status'] ?? '';
        if ($st === 'approved') {
            $approved++;
            $revenue += (int) ($p['amount'] ?? 0);
        } elseif ($st === 'failed') {
            $failed++;
        } elseif ($st === 'refunded') {
            $refunded++;
        }
    }

    $checkoutOpen = (int) ($counts['checkout_open'] ?? 0);
    $paymentSuccess = (int) ($counts['payment_success'] ?? $approved);
    $conversion = $checkoutOpen > 0 ? round($paymentSuccess / $checkoutOpen, 4) : 0;

    return [
        'days' => $days,
        'since' => $since,
        'events' => $counts,
        'payments' => [
            'approved' => $approved,
            'failed' => $failed,
            'refunded' => $refunded,
            'revenueInr' => $revenue,
        ],
        'funnel' => [
            'pricing_view' => (int) ($counts['pricing_view'] ?? 0),
            'checkout_open' => $checkoutOpen,
            'payment_started' => (int) ($counts['payment_started'] ?? 0),
            'payment_success' => $paymentSuccess,
            'conversion' => $conversion,
        ],
    ];
}

function get_teams(): array
{
    $teams = read_store('teams.json', []);
    return is_array($teams) ? array_values($teams) : [];
}

function find_team(string $teamId): ?array
{
    foreach (get_teams() as $team) {
        if (($team['id'] ?? '') === $teamId) {
            return $team;
        }
    }
    return null;
}

function find_team_by_code(string $code): ?array
{
    $code = strtoupper(trim($code));
    foreach (get_teams() as $team) {
        if (strtoupper((string) ($team['inviteCode'] ?? '')) === $code) {
            return $team;
        }
    }
    return null;
}

function user_has_active_pro(array $user): bool
{
    if (empty($user['isPro'])) {
        return false;
    }
    $expires = $user['proExpiresAt'] ?? null;
    if ($expires && strtotime((string) $expires) !== false && strtotime((string) $expires) < time()) {
        return false;
    }
    return true;
}

function team_grants_pro(array $user): bool
{
    $teamId = (string) ($user['teamId'] ?? '');
    if ($teamId === '') {
        return false;
    }
    $team = find_team($teamId);
    if (!$team) {
        return false;
    }
    $owner = find_user_by_uid((string) ($team['ownerUid'] ?? ''));
    return $owner ? user_has_active_pro($owner) : false;
}

function effective_is_pro(array $user): bool
{
    return user_has_active_pro($user) || team_grants_pro($user);
}

function get_runs_for_user(string $uid, int $limit = 50): array
{
    $runs = read_store('runs.json', []);
    if (!is_array($runs)) {
        return [];
    }
    $mine = array_values(array_filter($runs, function ($r) use ($uid) {
        return is_array($r) && ($r['userId'] ?? '') === $uid;
    }));
    usort($mine, function ($a, $b) {
        return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
    });
    return array_slice($mine, 0, max(1, $limit));
}

function razorpay_ensure_plan_id(string $plan): ?string
{
    $settings = get_settings();
    $cached = $settings['razorpayPlanIds'][$plan] ?? null;
    if (is_string($cached) && $cached !== '') {
        return $cached;
    }
    $amount = plan_amount($plan);
    if ($amount <= 0 || !razorpay_is_configured()) {
        return null;
    }
    $period = $plan === 'annual' ? 'yearly' : ($plan === 'quarterly' ? 'monthly' : 'monthly');
    $interval = $plan === 'quarterly' ? 3 : 1;
    $res = razorpay_api('POST', 'plans', [
        'period' => $period,
        'interval' => $interval,
        'item' => [
            'name' => 'ReconcileX Pro ' . ucfirst($plan),
            'amount' => $amount * 100,
            'currency' => 'INR',
            'description' => 'ReconcileX Pro subscription',
        ],
    ]);
    if (empty($res['ok']) || empty($res['body']['id'])) {
        return null;
    }
    $planId = (string) $res['body']['id'];
    $settings['razorpayPlanIds'] = $settings['razorpayPlanIds'] ?? [];
    $settings['razorpayPlanIds'][$plan] = $planId;
    $settings['updatedAt'] = gmdate('c');
    write_store('settings.json', $settings);
    return $planId;
}

function expire_lapsed_pro_users(): int
{
    $now = time();
    $count = 0;
    mutate_store('users.json', function ($users) use ($now, &$count) {
        if (!is_array($users)) {
            return [];
        }
        foreach ($users as $i => $user) {
            if (empty($user['isPro'])) {
                continue;
            }
            $exp = $user['proExpiresAt'] ?? null;
            if (!$exp) {
                continue;
            }
            $ts = strtotime((string) $exp);
            if ($ts !== false && $ts < $now) {
                $users[$i]['isPro'] = false;
                $users[$i]['status'] = 'expired';
                $users[$i]['proExpiredAt'] = gmdate('c');
                $count++;
            }
        }
        return $users;
    }, []);
    return $count;
}

function get_feature_flags(): array
{
    $settings = get_settings();
    $flags = $settings['featureFlags'] ?? [];
    return is_array($flags) ? $flags : [];
}

function feature_enabled(string $flag): bool
{
    $flags = get_feature_flags();
    return !empty($flags[$flag]);
}

function get_match_rules(): array
{
    $settings = get_settings();
    $rules = $settings['matchRules'] ?? [];
    $defaults = [
        'settlementWindowDays' => 5,
        'amountTolerancePaise' => 100,
        'feePct' => 0.02,
        'feeAnomalyFactor' => 1.05,
        'fuzzyWindowDays' => 3,
    ];
    return array_merge($defaults, is_array($rules) ? $rules : []);
}

function get_trial_codes(): array
{
    $rows = read_store('trial_codes.json', []);
    return is_array($rows) ? array_values($rows) : [];
}

function get_changelog(int $limit = 50): array
{
    $rows = read_store('changelog.json', []);
    if (!is_array($rows)) {
        return [];
    }
    usort($rows, function ($a, $b) {
        return strcmp((string) ($b['at'] ?? ''), (string) ($a['at'] ?? ''));
    });
    return array_slice(array_values($rows), 0, max(1, $limit));
}

function get_brands(): array
{
    $rows = read_store('brands.json', []);
    return is_array($rows) ? array_values($rows) : [];
}

function find_brand(string $id): ?array
{
    foreach (get_brands() as $b) {
        if (($b['id'] ?? '') === $id) {
            return $b;
        }
    }
    return null;
}

function grant_trial_pro(string $uid, int $days, string $note = ''): ?array
{
    $days = max(1, min(90, $days));
    $now = gmdate('c');
    $expires = gmdate('c', time() + $days * 86400);
    $user = update_user($uid, [
        'isPro' => true,
        'plan' => 'trial',
        'proUpdatedAt' => $now,
        'proExpiresAt' => $expires,
        'status' => 'active',
        'trialNote' => $note,
        'pendingPaymentId' => null,
        'pendingPlan' => null,
    ]);
    if ($user) {
        append_audit('trial_grant', ['userId' => $uid, 'days' => $days, 'note' => $note]);
        $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
        send_app_mail(
            (string) ($user['email'] ?? ''),
            'ReconcileX Pro trial activated',
            "Hi {$user['name']},\n\nYour {$days}-day Pro trial is active until {$expires}.\n\nOpen {$app}/account\n\n— ReconcileX\n"
        );
    }
    return $user;
}

function send_exception_digests(): int
{
    if (!feature_enabled('exceptionDigest')) {
        return 0;
    }
    $sent = 0;
    $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
    $runs = read_store('runs.json', []);
    if (!is_array($runs)) {
        return 0;
    }
    // Latest run per user
    $latest = [];
    foreach ($runs as $run) {
        if (!is_array($run)) {
            continue;
        }
        $uid = (string) ($run['userId'] ?? '');
        if ($uid === '') {
            continue;
        }
        if (!isset($latest[$uid]) || strcmp((string) ($run['createdAt'] ?? ''), (string) ($latest[$uid]['createdAt'] ?? '')) > 0) {
            $latest[$uid] = $run;
        }
    }
    foreach ($latest as $uid => $run) {
        $user = find_user_by_uid($uid);
        if (!$user || !effective_is_pro($user)) {
            continue;
        }
        $workflow = is_array($run['workflow'] ?? null) ? $run['workflow'] : [];
        $open = 0;
        $types = is_array($run['exceptionTypes'] ?? null) ? $run['exceptionTypes'] : [];
        $exCount = (int) ($run['summary']['exceptionCount'] ?? 0);
        if ($exCount <= 0) {
            continue;
        }
        // Count open = exceptions without fixed/ignored
        if ($workflow) {
            $closed = 0;
            foreach ($workflow as $row) {
                if (is_array($row) && in_array(($row['status'] ?? ''), ['fixed', 'ignored'], true)) {
                    $closed++;
                }
            }
            $open = max(0, $exCount - $closed);
        } else {
            $open = $exCount;
        }
        if ($open <= 0) {
            continue;
        }
        $email = (string) ($user['email'] ?? '');
        if ($email === '') {
            continue;
        }
        $name = (string) ($user['name'] ?? 'there');
        $label = (string) ($run['label'] ?? 'latest run');
        $typeList = $types ? implode(', ', array_slice($types, 0, 8)) : 'various';
        $ok = send_app_mail(
            $email,
            "ReconcileX: {$open} open exception(s)",
            "Hi {$name},\n\nYour latest recon \"{$label}\" still has {$open} open exception(s) ({$typeList}).\n\nReview at {$app}/account or run a fresh recon at {$app}/#tool\n\n— ReconcileX\n"
        );
        if ($ok) {
            $sent++;
        }
    }
    return $sent;
}

function get_alert_settings(): array
{
    $settings = get_settings();
    $alerts = $settings['alerts'] ?? [];
    return array_merge([
        'enabled' => true,
        'thresholdInr' => 10000,
        'email' => '',
        'slackWebhook' => '',
    ], is_array($alerts) ? $alerts : []);
}

function send_slack_webhook(string $webhook, string $text): bool
{
    if ($webhook === '' || strpos($webhook, 'https://hooks.slack.com/') !== 0) {
        return false;
    }
    $ch = curl_init($webhook);
    if ($ch === false) {
        return false;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['text' => $text]),
        CURLOPT_TIMEOUT => 12,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $raw !== false && $status >= 200 && $status < 300;
}

/**
 * Fire risk alert when amount-at-risk crosses admin threshold.
 * @return array{sent:bool,channels:array<int,string>,reason?:string}
 */
function maybe_send_risk_alert(array $run, ?array $user = null): array
{
    $alerts = get_alert_settings();
    if (empty($alerts['enabled'])) {
        return ['sent' => false, 'channels' => [], 'reason' => 'disabled'];
    }
    $threshold = (int) ($alerts['thresholdInr'] ?? 0);
    $atRiskInr = ((int) ($run['summary']['amountAtRiskPaise'] ?? 0)) / 100;
    if ($threshold <= 0 || $atRiskInr < $threshold) {
        return ['sent' => false, 'channels' => [], 'reason' => 'below_threshold'];
    }

    $app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';
    $label = (string) ($run['label'] ?? 'recon');
    $emailUser = (string) (($user['email'] ?? '') ?: ($run['email'] ?? ''));
    $name = (string) (($user['name'] ?? '') ?: 'team');
    $exCount = (int) ($run['summary']['exceptionCount'] ?? 0);
    $msg = "ReconcileX risk alert: ₹" . number_format($atRiskInr, 2) .
        " at risk on \"{$label}\" ({$exCount} exceptions). Threshold ₹{$threshold}. {$app}/results";

    $channels = [];
    $alertEmail = trim((string) ($alerts['email'] ?? ''));
    if ($alertEmail !== '' && send_app_mail($alertEmail, 'ReconcileX risk threshold alert', $msg . "\n\n— ReconcileX\n")) {
        $channels[] = 'admin_email';
    }
    if ($emailUser !== '' && send_app_mail($emailUser, 'ReconcileX: amount at risk alert', "Hi {$name},\n\n{$msg}\n\n— ReconcileX\n")) {
        $channels[] = 'user_email';
    }
    $hook = trim((string) ($alerts['slackWebhook'] ?? ''));
    if ($hook !== '' && send_slack_webhook($hook, $msg)) {
        $channels[] = 'slack';
    }

    if ($channels) {
        append_audit('risk_alert', [
            'runId' => $run['id'] ?? '',
            'amountAtRiskInr' => $atRiskInr,
            'thresholdInr' => $threshold,
            'channels' => $channels,
        ]);
    }

    return ['sent' => count($channels) > 0, 'channels' => $channels];
}

function build_exception_explain_local(array $ex): array
{
    $type = (string) ($ex['type'] ?? '');
    $amount = isset($ex['amountPaise']) ? ((int) $ex['amountPaise']) / 100 : 0;
    $ref = (string) ($ex['orderNo'] ?? $ex['paymentId'] ?? $ex['settlementId'] ?? 'this line');
    $desc = (string) ($ex['description'] ?? '');

    $catalog = [
        'SETTLED_NO_ORDER' => [
            'summary' => "Money settled ({$ref}) but no store order matched — often a missing/merged order or COD remittance.",
            'likelyCauses' => [
                'Order ID edited or merged after payment',
                'Settlement belongs to another channel/store',
                'COD remittance without matching order export',
            ],
            'suggestedActions' => [
                'Search the gateway payment/UTR in the dashboard',
                'Check alternate order IDs and cancelled/merged orders',
                'If confirmed orphan, ticket the gateway with settlement proof',
            ],
        ],
        'PAID_NOT_SETTLED' => [
            'summary' => "Order {$ref} is paid but settlement has not appeared yet — usually T+N timing or a hold.",
            'likelyCauses' => [
                'Still inside settlement window',
                'Payment authorized but not captured',
                'Refund/chargeback cancelled payout',
            ],
            'suggestedActions' => [
                'Confirm Captured status in the gateway',
                'Wait for the next payout cycle and re-export',
                'Check on-hold / under-review queues',
            ],
        ],
        'AMOUNT_MISMATCH' => [
            'summary' => "Amounts for {$ref} do not reconcile (≈ ₹" . number_format($amount, 2) . " gap) — partial captures, fees, or discounts are common.",
            'likelyCauses' => [
                'Partial capture / tip / COD difference',
                'Discount or gift-card double counting',
                'Rounding or FX conversion',
            ],
            'suggestedActions' => [
                'Compare order gross vs payment amount line-by-line',
                'Verify discounts and store credit treatment',
                'Document the diff if the gateway amount is authoritative',
            ],
        ],
        'FEE_ANOMALY' => [
            'summary' => "Fees on {$ref} look higher than your contracted rate (over ~₹" . number_format($amount, 2) . ").",
            'likelyCauses' => [
                'International / EMI / corporate card MDR',
                'GST on fees treated differently in exports',
                'Rate plan change not reflected in ReconcileX rules',
            ],
            'suggestedActions' => [
                'Compare MDR vs contract for that method',
                'Update Admin → Control match fee % if the contract changed',
                'Escalate recurring overcharges to the gateway AM',
            ],
        ],
        'REFUND_MISMATCH' => [
            'summary' => "Refund settlement for {$ref} has no clear matching order/payment context.",
            'likelyCauses' => [
                'Partial refund vs full cancel mismatch',
                'Refund fee/reversal treated as a new payment',
                'Missing refund export from the store',
            ],
            'suggestedActions' => [
                'Match refund IDs across store and gateway',
                'Confirm partial vs full refunds',
                'Update books once both sides agree',
            ],
        ],
        'SETTLEMENT_OVERDUE' => [
            'summary' => "Order {$ref} is past the settlement SLA window — payout may be delayed or stuck.",
            'likelyCauses' => [
                'Gateway on-hold / risk review',
                'Bank beneficiary / KYC issue',
                'Missed payout cycle export',
            ],
            'suggestedActions' => [
                'Check expected settlement date and holds',
                'Verify bank account KYC details',
                'Open a support ticket with payment IDs past SLA',
            ],
        ],
    ];

    $base = $catalog[$type] ?? [
        'summary' => $desc !== '' ? $desc : "Exception on {$ref} needs manual review.",
        'likelyCauses' => ['Data mismatch between channel exports'],
        'suggestedActions' => ['Re-export both CSVs and re-run recon', 'Mark fixed/ignored after verification'],
    ];

    return [
        'summary' => $base['summary'],
        'likelyCauses' => $base['likelyCauses'],
        'suggestedActions' => $base['suggestedActions'],
        'source' => 'rules',
        'type' => $type,
        'amountInr' => $amount,
        'ref' => $ref,
    ];
}

function gemini_is_configured(): bool
{
    return defined('GEMINI_API_KEY')
        && GEMINI_API_KEY !== ''
        && strpos(GEMINI_API_KEY, 'your-') !== 0;
}

/**
 * Optional Gemini enrichment. Falls back silently.
 */
function gemini_enrich_exception_explain(array $local, array $ex): array
{
    if (!gemini_is_configured()) {
        return $local;
    }
    $prompt = "You are a payments reconciliation assistant for Indian e-commerce.\n"
        . "Given this exception, reply with concise JSON only:\n"
        . '{"summary":"...","likelyCauses":["..."],"suggestedActions":["..."]}' . "\n"
        . "Exception type: " . ($ex['type'] ?? '') . "\n"
        . "Description: " . ($ex['description'] ?? '') . "\n"
        . "Amount paise: " . ($ex['amountPaise'] ?? 0) . "\n"
        . "Order: " . ($ex['orderNo'] ?? '') . " Payment: " . ($ex['paymentId'] ?? '') . "\n"
        . "Keep 2-4 bullet items each. No markdown.";

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='
        . rawurlencode(GEMINI_API_KEY);
    $payload = [
        'contents' => [
            ['parts' => [['text' => $prompt]]],
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'maxOutputTokens' => 512,
        ],
    ];
    $ch = curl_init($url);
    if ($ch === false) {
        return $local;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $status < 200 || $status >= 300) {
        return $local;
    }
    $body = json_decode($raw, true);
    $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (!is_string($text) || trim($text) === '') {
        return $local;
    }
    $text = trim($text);
    $text = preg_replace('/^```json\s*|\s*```$/', '', $text) ?: $text;
    $parsed = json_decode($text, true);
    if (!is_array($parsed)) {
        return $local;
    }
    $out = $local;
    if (!empty($parsed['summary']) && is_string($parsed['summary'])) {
        $out['summary'] = substr($parsed['summary'], 0, 500);
    }
    if (!empty($parsed['likelyCauses']) && is_array($parsed['likelyCauses'])) {
        $out['likelyCauses'] = array_values(array_slice(array_map('strval', $parsed['likelyCauses']), 0, 5));
    }
    if (!empty($parsed['suggestedActions']) && is_array($parsed['suggestedActions'])) {
        $out['suggestedActions'] = array_values(array_slice(array_map('strval', $parsed['suggestedActions']), 0, 5));
    }
    $out['source'] = 'ai';
    return $out;
}
