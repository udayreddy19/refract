<?php
/**
 * ReconcileX durable store — MySQL when configured, JSON fallback otherwise.
 */

function payflow_use_mysql(): bool
{
    return mysql_pdo() !== null;
}

function payflow_agent_row_from_db(array $r): array
{
    $branding = null;
    if (!empty($r['branding_json'])) {
        $decoded = json_decode((string) $r['branding_json'], true);
        $branding = is_array($decoded) ? $decoded : null;
    }
    return [
        'uid' => (string) $r['uid'],
        'agentId' => (string) $r['agent_id'],
        'name' => (string) $r['name'],
        'email' => (string) $r['email'],
        'mobile' => (string) $r['mobile'],
        'passcode' => (string) $r['passcode'],
        'status' => (string) $r['status'],
        'kycStatus' => (string) ($r['kyc_status'] ?? 'pending'),
        'city' => (string) ($r['city'] ?? ''),
        'notes' => (string) ($r['notes'] ?? ''),
        'parentUid' => $r['parent_uid'] ?? null,
        'pinHash' => $r['pin_hash'] ?? null,
        'dailyDebitCap' => isset($r['daily_debit_cap']) && $r['daily_debit_cap'] !== null
            ? (float) $r['daily_debit_cap']
            : null,
        'locale' => (string) ($r['locale'] ?? 'en'),
        'branding' => $branding,
        'createdAt' => (string) $r['created_at'],
        'updatedAt' => (string) $r['updated_at'],
        'lastLoginAt' => $r['last_login_at'] ?? null,
    ];
}

function payflow_wallet_get(string $uid): float
{
    $db = mysql_pdo();
    if ($db) {
        $stmt = $db->prepare('SELECT balance FROM rx_wallets WHERE uid = ? LIMIT 1');
        $stmt->execute([$uid]);
        $row = $stmt->fetch();
        return $row ? (float) $row['balance'] : 0.0;
    }
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
    $entryType = (string) ($meta['type'] ?? ($amount >= 0 ? 'credit' : 'debit'));
    $db = mysql_pdo();
    if ($db) {
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT balance FROM rx_wallets WHERE uid = ? FOR UPDATE');
            $stmt->execute([$uid]);
            $row = $stmt->fetch();
            $balance = $row ? round(((float) $row['balance']) + $amount, 2) : round($amount, 2);
            $now = gmdate('c');
            if ($row) {
                $upd = $db->prepare('UPDATE rx_wallets SET balance = ?, updated_at = ? WHERE uid = ?');
                $upd->execute([$balance, $now, $uid]);
            } else {
                $ins = $db->prepare('INSERT INTO rx_wallets (uid, balance, updated_at) VALUES (?,?,?)');
                $ins->execute([$uid, $balance, $now]);
            }
            $ledgerId = 'led_' . bin2hex(random_bytes(6));
            $metaClean = $meta;
            unset($metaClean['type']);
            $led = $db->prepare(
                'INSERT INTO rx_ledger (id, uid, entry_type, amount, balance, meta_json, created_at)
                 VALUES (?,?,?,?,?,?,?)'
            );
            $led->execute([
                $ledgerId,
                $uid,
                $entryType,
                $amount,
                $balance,
                json_encode($metaClean, JSON_UNESCAPED_SLASHES),
                $now,
            ]);
            $db->commit();
            payflow_maybe_alert_balance($uid, $balance, $amount, $entryType, $meta);
            return $balance;
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

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

    payflow_maybe_alert_balance($uid, $balance, $amount, $entryType, $meta);
    return $balance;
}

function payflow_maybe_alert_balance(string $uid, float $balance, float $amount, string $entryType, array $meta): void
{
    if (!defined('WHATSAPP_ALERTS_ENABLED') || !in_array(strtolower((string) WHATSAPP_ALERTS_ENABLED), ['1', 'true', 'yes'], true)) {
        return;
    }
    $agent = payflow_find_agent(null, $uid);
    if (!$agent) {
        return;
    }
    $mobile = preg_replace('/\D+/', '', (string) ($agent['mobile'] ?? ''));
    if (strlen($mobile) < 10) {
        return;
    }
    $threshold = defined('LOW_BALANCE_THRESHOLD') ? (float) LOW_BALANCE_THRESHOLD : 500.0;
    $messages = [];
    if ($amount > 0 && str_contains($entryType, 'credit')) {
        $messages[] = 'ReconcileX: ₹' . number_format($amount, 2) . ' credited. Balance ₹' . number_format($balance, 2);
    }
    if ($amount < 0 && ($meta['type'] ?? '') === 'bill') {
        $messages[] = 'ReconcileX: Bill payment ₹' . number_format(abs($amount), 2) . ' debited. Balance ₹' . number_format($balance, 2);
    }
    if ($balance < $threshold) {
        $messages[] = 'ReconcileX: Low wallet balance ₹' . number_format($balance, 2) . '. Please top up.';
    }
    foreach ($messages as $text) {
        // Deep-link style log; hosting can wire WhatsApp Business API later.
        error_log('whatsapp_alert:' . substr($mobile, -10) . ':' . $text);
        mutate_store('payflow_whatsapp_outbox.json', function ($rows) use ($mobile, $text) {
            if (!is_array($rows)) {
                $rows = [];
            }
            $rows[] = [
                'id' => 'wa_' . bin2hex(random_bytes(4)),
                'mobile' => substr($mobile, -10),
                'text' => $text,
                'createdAt' => gmdate('c'),
                'waMe' => 'https://wa.me/91' . substr($mobile, -10) . '?text=' . rawurlencode($text),
            ];
            if (count($rows) > 200) {
                $rows = array_slice($rows, -200);
            }
            return $rows;
        }, []);
    }
}

function payflow_demo_mode(): bool
{
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

function payflow_default_agents(): array
{
    return [];
}

/** @return array<int, array<string, mixed>> */
function payflow_agents_from_json(): array
{
    $agents = read_store('payflow_agents.json', []);
    if (!is_array($agents)) {
        return [];
    }
    return array_values($agents);
}

/**
 * If MySQL is configured but empty, import JSON agents once so logins keep working.
 */
function payflow_mysql_bootstrap_from_json(): void
{
    static $tried = false;
    if ($tried) {
        return;
    }
    $tried = true;
    $db = mysql_pdo();
    if (!$db) {
        return;
    }
    try {
        $count = (int) $db->query('SELECT COUNT(*) FROM rx_agents')->fetchColumn();
        if ($count > 0) {
            return;
        }
    } catch (Throwable $e) {
        return;
    }
    $jsonAgents = payflow_agents_from_json();
    if (count($jsonAgents) === 0) {
        return;
    }
    foreach ($jsonAgents as $agent) {
        if (!is_array($agent) || empty($agent['uid']) || empty($agent['agentId'])) {
            continue;
        }
        if (!isset($agent['kycStatus'])) {
            $agent['kycStatus'] = 'pending';
        }
        payflow_agent_save($agent);
    }
    // Import wallets if present
    $wallets = read_store('payflow_wallets.json', []);
    if (is_array($wallets)) {
        $stmt = $db->prepare(
            'INSERT INTO rx_wallets (uid, balance, updated_at) VALUES (?,?,?)
             ON DUPLICATE KEY UPDATE balance=VALUES(balance), updated_at=VALUES(updated_at)'
        );
        foreach ($wallets as $w) {
            if (!is_array($w) || empty($w['uid'])) {
                continue;
            }
            $stmt->execute([
                $w['uid'],
                (float) ($w['balance'] ?? 0),
                (string) ($w['updatedAt'] ?? gmdate('c')),
            ]);
        }
    }
}

/** @return array<int, array<string, mixed>> */
function payflow_agents_all(): array
{
    $db = mysql_pdo();
    if ($db) {
        payflow_mysql_bootstrap_from_json();
        $rows = $db->query('SELECT * FROM rx_agents ORDER BY agent_id ASC')->fetchAll();
        $agents = array_map('payflow_agent_row_from_db', $rows ?: []);
        if (count($agents) > 0) {
            return $agents;
        }
        // MySQL empty / import failed — fall back to JSON so login still works
        return payflow_agents_from_json();
    }
    return payflow_agents_from_json();
}

function payflow_agent_save(array $agent): void
{
    $db = mysql_pdo();
    $now = gmdate('c');
    if ($db) {
        $stmt = $db->prepare(
            'INSERT INTO rx_agents
            (uid, agent_id, name, email, mobile, passcode, status, kyc_status, city, notes, parent_uid, pin_hash, daily_debit_cap, locale, branding_json, created_at, updated_at, last_login_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
              name=VALUES(name), email=VALUES(email), mobile=VALUES(mobile), passcode=VALUES(passcode),
              status=VALUES(status), kyc_status=VALUES(kyc_status), city=VALUES(city), notes=VALUES(notes),
              parent_uid=VALUES(parent_uid), pin_hash=VALUES(pin_hash), daily_debit_cap=VALUES(daily_debit_cap),
              locale=VALUES(locale), branding_json=VALUES(branding_json), updated_at=VALUES(updated_at),
              last_login_at=VALUES(last_login_at)'
        );
        $stmt->execute([
            $agent['uid'],
            $agent['agentId'],
            $agent['name'] ?? '',
            $agent['email'] ?? '',
            $agent['mobile'] ?? '',
            $agent['passcode'] ?? '',
            $agent['status'] ?? 'active',
            $agent['kycStatus'] ?? 'pending',
            $agent['city'] ?? '',
            $agent['notes'] ?? '',
            $agent['parentUid'] ?? null,
            $agent['pinHash'] ?? null,
            $agent['dailyDebitCap'] ?? null,
            $agent['locale'] ?? 'en',
            isset($agent['branding']) ? json_encode($agent['branding'], JSON_UNESCAPED_SLASHES) : null,
            $agent['createdAt'] ?? $now,
            $agent['updatedAt'] ?? $now,
            $agent['lastLoginAt'] ?? null,
        ]);
        return;
    }
    mutate_store('payflow_agents.json', function ($agents) use ($agent) {
        if (!is_array($agents)) {
            $agents = [];
        }
        $found = false;
        foreach ($agents as $i => $row) {
            if (($row['uid'] ?? '') === ($agent['uid'] ?? '')) {
                $agents[$i] = array_merge($row, $agent);
                $found = true;
                break;
            }
        }
        if (!$found) {
            $agents[] = $agent;
        }
        return array_values($agents);
    }, []);
}

function payflow_agent_set_passcode(string $uid, string $passcode): void
{
    $agent = payflow_find_agent(null, $uid);
    if (!$agent) {
        return;
    }
    $agent['passcode'] = payflow_hash_passcode($passcode);
    $agent['updatedAt'] = gmdate('c');
    payflow_agent_save($agent);
}

/**
 * @return array{deposit:?array,shouldCredit:bool}
 */
function payflow_deposit_mark_paid_and_claim_credit(string $matchOrderId, string $paymentId, string $utr, ?int $amountPaise = null, ?string $depositIdHint = null): array
{
    $db = mysql_pdo();
    if ($db) {
        $db->beginTransaction();
        try {
            $deposit = null;
            if ($depositIdHint) {
                $stmt = $db->prepare('SELECT * FROM rx_deposits WHERE id = ? FOR UPDATE');
                $stmt->execute([$depositIdHint]);
                $deposit = $stmt->fetch() ?: null;
            }
            if (!$deposit && $matchOrderId !== '') {
                $stmt = $db->prepare('SELECT * FROM rx_deposits WHERE order_id = ? FOR UPDATE');
                $stmt->execute([$matchOrderId]);
                $deposit = $stmt->fetch() ?: null;
            }
            if (!$deposit) {
                $db->commit();
                return ['deposit' => null, 'shouldCredit' => false];
            }
            $asArray = payflow_deposit_row_from_db($deposit);
            if (!empty($deposit['credited'])) {
                $db->commit();
                return ['deposit' => $asArray, 'shouldCredit' => false];
            }
            if ($amountPaise !== null && $amountPaise > 0 && (int) $deposit['amount_paise'] !== $amountPaise) {
                $upd = $db->prepare('UPDATE rx_deposits SET status = ?, updated_at = ? WHERE id = ?');
                $upd->execute(['AMOUNT_MISMATCH', gmdate('c'), $deposit['id']]);
                $asArray['status'] = 'AMOUNT_MISMATCH';
                $db->commit();
                return ['deposit' => $asArray, 'shouldCredit' => false];
            }
            $now = gmdate('c');
            $upd = $db->prepare(
                'UPDATE rx_deposits SET status = ?, payment_id = ?, utr = ?, paid_at = ?, updated_at = ?, credited = 1 WHERE id = ?'
            );
            $upd->execute(['PAID', $paymentId, $utr, $now, $now, $deposit['id']]);
            $asArray['status'] = 'PAID';
            $asArray['paymentId'] = $paymentId;
            $asArray['utr'] = $utr;
            $asArray['paidAt'] = $now;
            $asArray['_credited'] = true;
            $db->commit();
            return ['deposit' => $asArray, 'shouldCredit' => true];
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

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

function payflow_deposit_row_from_db(array $r): array
{
    $payload = [];
    if (!empty($r['payload_json'])) {
        $decoded = json_decode((string) $r['payload_json'], true);
        if (is_array($decoded)) {
            $payload = $decoded;
        }
    }
    return array_merge($payload, [
        'id' => (string) $r['id'],
        'uid' => (string) $r['uid'],
        'agentId' => (string) $r['agent_id'],
        'provider' => (string) $r['provider'],
        'amount' => (float) $r['amount'],
        'amountPaise' => (int) $r['amount_paise'],
        'customerName' => (string) $r['customer_name'],
        'mobile' => (string) $r['mobile'],
        'email' => (string) $r['email'],
        'category' => (string) $r['category'],
        'status' => (string) $r['status'],
        'orderId' => $r['order_id'],
        'paymentSessionId' => $r['payment_session_id'],
        'paymentId' => $r['payment_id'],
        'utr' => $r['utr'],
        '_credited' => !empty($r['credited']),
        'demoMode' => !empty($r['demo_mode']),
        'createdAt' => (string) $r['created_at'],
        'updatedAt' => (string) $r['updated_at'],
        'paidAt' => $r['paid_at'] ?? null,
    ]);
}

function payflow_deposit_save(array $deposit): void
{
    $db = mysql_pdo();
    if ($db) {
        $stmt = $db->prepare(
            'INSERT INTO rx_deposits
            (id, uid, agent_id, provider, amount, amount_paise, customer_name, mobile, email, category, status,
             order_id, payment_session_id, payment_id, utr, credited, demo_mode, payload_json, created_at, updated_at, paid_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
              status=VALUES(status), order_id=VALUES(order_id), payment_session_id=VALUES(payment_session_id),
              payment_id=VALUES(payment_id), utr=VALUES(utr), credited=VALUES(credited), demo_mode=VALUES(demo_mode),
              payload_json=VALUES(payload_json), updated_at=VALUES(updated_at), paid_at=VALUES(paid_at)'
        );
        $stmt->execute([
            $deposit['id'],
            $deposit['uid'],
            $deposit['agentId'] ?? '',
            $deposit['provider'] ?? '',
            $deposit['amount'] ?? 0,
            $deposit['amountPaise'] ?? 0,
            $deposit['customerName'] ?? '',
            $deposit['mobile'] ?? '',
            $deposit['email'] ?? '',
            $deposit['category'] ?? '',
            $deposit['status'] ?? 'CREATED',
            $deposit['orderId'] ?? null,
            $deposit['paymentSessionId'] ?? null,
            $deposit['paymentId'] ?? null,
            $deposit['utr'] ?? null,
            !empty($deposit['_credited']) ? 1 : 0,
            !empty($deposit['demoMode']) ? 1 : 0,
            json_encode($deposit, JSON_UNESCAPED_SLASHES),
            $deposit['createdAt'] ?? gmdate('c'),
            $deposit['updatedAt'] ?? gmdate('c'),
            $deposit['paidAt'] ?? null,
        ]);
        return;
    }
    mutate_store('payflow_deposits.json', function ($rows) use ($deposit) {
        if (!is_array($rows)) {
            $rows = [];
        }
        foreach ($rows as $i => $row) {
            if (($row['id'] ?? '') === ($deposit['id'] ?? '')) {
                $rows[$i] = $deposit;
                return $rows;
            }
        }
        $rows[] = $deposit;
        return $rows;
    }, []);
}

function payflow_deposit_find(?string $id = null, ?string $orderId = null): ?array
{
    $db = mysql_pdo();
    if ($db) {
        if ($id) {
            $stmt = $db->prepare('SELECT * FROM rx_deposits WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            return $row ? payflow_deposit_row_from_db($row) : null;
        }
        if ($orderId) {
            $stmt = $db->prepare('SELECT * FROM rx_deposits WHERE order_id = ? LIMIT 1');
            $stmt->execute([$orderId]);
            $row = $stmt->fetch();
            return $row ? payflow_deposit_row_from_db($row) : null;
        }
        return null;
    }
    $rows = read_store('payflow_deposits.json', []);
    foreach ($rows as $row) {
        if ($id && ($row['id'] ?? '') === $id) {
            return $row;
        }
        if ($orderId && ($row['orderId'] ?? '') === $orderId) {
            return $row;
        }
    }
    return null;
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
        'kycStatus' => (string) ($agent['kycStatus'] ?? 'pending'),
        'city' => (string) ($agent['city'] ?? ''),
        'notes' => (string) ($agent['notes'] ?? ''),
        'parentUid' => $agent['parentUid'] ?? null,
        'locale' => (string) ($agent['locale'] ?? 'en'),
        'branding' => $agent['branding'] ?? null,
        'hasPin' => !empty($agent['pinHash']),
        'dailyDebitCap' => $agent['dailyDebitCap'] ?? null,
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
    $db = mysql_pdo();
    if ($db) {
        payflow_mysql_bootstrap_from_json();
        if ($uid !== null && $uid !== '') {
            $stmt = $db->prepare('SELECT * FROM rx_agents WHERE uid = ? LIMIT 1');
            $stmt->execute([trim($uid)]);
            $row = $stmt->fetch();
            if ($row) {
                return payflow_agent_row_from_db($row);
            }
        }
        if ($agentId !== null && $agentId !== '') {
            $stmt = $db->prepare('SELECT * FROM rx_agents WHERE agent_id = ? LIMIT 1');
            $stmt->execute([strtoupper(trim($agentId))]);
            $row = $stmt->fetch();
            if ($row) {
                return payflow_agent_row_from_db($row);
            }
        }
        if ($mobile !== null) {
            $digits = preg_replace('/\D+/', '', $mobile);
            if (strlen($digits) >= 10) {
                $tail = substr($digits, -10);
                $stmt = $db->query('SELECT * FROM rx_agents');
                foreach ($stmt->fetchAll() as $row) {
                    $m = preg_replace('/\D+/', '', (string) ($row['mobile'] ?? ''));
                    if ($m !== '' && substr($m, -10) === $tail) {
                        return payflow_agent_row_from_db($row);
                    }
                }
            }
        }
        // Fall through to JSON if MySQL miss (pre-migration retailers)
    }

    $agentIdN = $agentId !== null ? strtoupper(trim($agentId)) : null;
    $uidN = $uid !== null ? trim($uid) : null;
    $digits = $mobile !== null ? preg_replace('/\D+/', '', $mobile) : '';
    foreach (payflow_agents_from_json() as $agent) {
        if ($uidN !== null && $uidN !== '' && ($agent['uid'] ?? '') === $uidN) {
            return $agent;
        }
        if ($agentIdN !== null && $agentIdN !== '' && strtoupper((string) ($agent['agentId'] ?? '')) === $agentIdN) {
            return $agent;
        }
        if ($digits !== '' && strlen($digits) >= 10) {
            $m = preg_replace('/\D+/', '', (string) ($agent['mobile'] ?? ''));
            if ($m !== '' && substr($m, -10) === substr($digits, -10)) {
                return $agent;
            }
        }
    }
    // Last resort: scan MySQL-backed list (already bootstrapped)
    if (!$db) {
        return null;
    }
    foreach (payflow_agents_all() as $agent) {
        if ($uidN !== null && $uidN !== '' && ($agent['uid'] ?? '') === $uidN) {
            return $agent;
        }
        if ($agentIdN !== null && $agentIdN !== '' && strtoupper((string) ($agent['agentId'] ?? '')) === $agentIdN) {
            return $agent;
        }
    }
    return null;
}

function payflow_agents_mutate(callable $mutator): ?array
{
    $result = null;
    $agents = payflow_agents_all();
    $agents = $mutator($agents);
    if (!is_array($agents)) {
        $agents = [];
    }
    foreach ($agents as $agent) {
        if (is_array($agent) && !empty($agent['uid'])) {
            payflow_agent_save($agent);
            $result = $agent;
        }
    }
    return $result;
}

function payflow_agent_touch_login(string $uid): void
{
    $agent = payflow_find_agent(null, $uid);
    if (!$agent) {
        return;
    }
    $agent['lastLoginAt'] = gmdate('c');
    payflow_agent_save($agent);
}

/** @return array<int, array<string, mixed>> */
function payflow_ledger_all(?string $uid = null, int $limit = 200): array
{
    $db = mysql_pdo();
    if ($db) {
        if ($uid !== null && $uid !== '') {
            $stmt = $db->prepare('SELECT * FROM rx_ledger WHERE uid = ? ORDER BY created_at DESC LIMIT ?');
            $stmt->bindValue(1, $uid);
            $stmt->bindValue(2, max(1, $limit), PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $db->prepare('SELECT * FROM rx_ledger ORDER BY created_at DESC LIMIT ?');
            $stmt->bindValue(1, max(1, $limit), PDO::PARAM_INT);
            $stmt->execute();
        }
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $meta = [];
            if (!empty($row['meta_json'])) {
                $decoded = json_decode((string) $row['meta_json'], true);
                if (is_array($decoded)) {
                    $meta = $decoded;
                }
            }
            $out[] = array_merge($meta, [
                'id' => (string) $row['id'],
                'uid' => (string) $row['uid'],
                'type' => (string) $row['entry_type'],
                'amount' => (float) $row['amount'],
                'balance' => (float) $row['balance'],
                'createdAt' => (string) $row['created_at'],
            ]);
        }
        return $out;
    }

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

function payflow_admin_audit(string $action, array $meta = [], string $reason = '', string $receiptId = ''): void
{
    $id = 'aud_' . bin2hex(random_bytes(6));
    $now = gmdate('c');
    $role = function_exists('admin_role') ? admin_role() : 'admin';
    $targetUid = (string) ($meta['uid'] ?? '');
    $db = mysql_pdo();
    if ($db) {
        $stmt = $db->prepare(
            'INSERT INTO rx_admin_audit (id, actor_role, action, target_uid, reason, receipt_id, meta_json, created_at)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $id,
            $role,
            $action,
            $targetUid !== '' ? $targetUid : null,
            $reason,
            $receiptId,
            json_encode($meta, JSON_UNESCAPED_SLASHES),
            $now,
        ]);
    }
    if (function_exists('append_audit')) {
        append_audit($action, array_merge($meta, [
            'reason' => $reason,
            'receiptId' => $receiptId,
            'actorRole' => $role,
        ]));
    }
}

/** @return array<int, array<string, mixed>> */
function payflow_admin_audit_list(int $limit = 100, string $action = ''): array
{
    $db = mysql_pdo();
    if ($db) {
        if ($action !== '') {
            $stmt = $db->prepare('SELECT * FROM rx_admin_audit WHERE action = ? ORDER BY created_at DESC LIMIT ?');
            $stmt->bindValue(1, $action);
            $stmt->bindValue(2, max(1, $limit), PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $db->prepare('SELECT * FROM rx_admin_audit ORDER BY created_at DESC LIMIT ?');
            $stmt->bindValue(1, max(1, $limit), PDO::PARAM_INT);
            $stmt->execute();
        }
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $meta = [];
            if (!empty($row['meta_json'])) {
                $decoded = json_decode((string) $row['meta_json'], true);
                if (is_array($decoded)) {
                    $meta = $decoded;
                }
            }
            $out[] = array_merge($meta, [
                'id' => (string) $row['id'],
                'action' => (string) $row['action'],
                'actorRole' => (string) $row['actor_role'],
                'uid' => (string) ($row['target_uid'] ?? ''),
                'reason' => (string) $row['reason'],
                'receiptId' => (string) $row['receipt_id'],
                'at' => (string) $row['created_at'],
            ]);
        }
        return $out;
    }
    return function_exists('get_audit') ? get_audit($limit) : [];
}

function payflow_commission_for(string $product): array
{
    $db = mysql_pdo();
    if ($db) {
        $stmt = $db->prepare('SELECT * FROM rx_commission_rules WHERE product = ? AND active = 1 LIMIT 1');
        $stmt->execute([$product]);
        $row = $stmt->fetch();
        if ($row) {
            return [
                'product' => $row['product'],
                'feeFlat' => (float) $row['fee_flat'],
                'feePct' => (float) $row['fee_pct'],
                'marginFlat' => (float) $row['margin_flat'],
                'marginPct' => (float) $row['margin_pct'],
            ];
        }
    }
    if ($product === 'bills') {
        return ['product' => 'bills', 'feeFlat' => 5.0, 'feePct' => 0, 'marginFlat' => 0, 'marginPct' => 0];
    }
    return ['product' => $product, 'feeFlat' => 0, 'feePct' => 0, 'marginFlat' => 0, 'marginPct' => 0];
}

function payflow_apply_fee(float $amount, array $rule): float
{
    return round($amount + (float) ($rule['feeFlat'] ?? 0) + ($amount * ((float) ($rule['feePct'] ?? 0) / 100)), 2);
}

function payflow_check_debit_limits(string $uid, float $amount): ?string
{
    $agent = payflow_find_agent(null, $uid);
    $cap = $agent['dailyDebitCap'] ?? null;
    if ($cap === null || $cap <= 0) {
        $cap = defined('DEFAULT_DAILY_DEBIT_CAP') ? (float) DEFAULT_DAILY_DEBIT_CAP : 200000.0;
    }
    $dayStart = (new DateTime('now', new DateTimeZone('Asia/Kolkata')))->format('Y-m-d') . 'T00:00:00+05:30';
    $dayStartGmt = gmdate('c', strtotime($dayStart));
    $spent = 0.0;
    $velocity = 0;
    $windowMin = defined('DEBIT_VELOCITY_WINDOW_MIN') ? (int) DEBIT_VELOCITY_WINDOW_MIN : 60;
    $velocityMax = defined('DEBIT_VELOCITY_MAX') ? (int) DEBIT_VELOCITY_MAX : 40;
    $windowStart = gmdate('c', time() - ($windowMin * 60));

    foreach (payflow_ledger_all($uid, 500) as $row) {
        $created = (string) ($row['createdAt'] ?? '');
        $amt = (float) ($row['amount'] ?? 0);
        if ($amt >= 0) {
            continue;
        }
        if ($created >= $dayStartGmt) {
            $spent += abs($amt);
        }
        if ($created >= $windowStart) {
            $velocity++;
        }
    }
    if ($spent + $amount > $cap) {
        return 'Daily debit limit exceeded (₹' . number_format($cap, 0) . ').';
    }
    if ($velocity >= $velocityMax) {
        return 'Too many debit transactions. Please wait and try again.';
    }
    return null;
}

function payflow_agent_can_transact(array $agent): ?string
{
    $status = (string) ($agent['status'] ?? 'active');
    if ($status === 'disabled' || $status === 'blocked') {
        return 'Retailer account is disabled.';
    }
    $kyc = (string) ($agent['kycStatus'] ?? 'pending');
    if ($kyc === 'blocked') {
        return 'KYC blocked. Contact support.';
    }
    return null;
}
