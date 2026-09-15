<?php
/**
 * ServerByt MySQL connection + ReconcileX schema bootstrap.
 * When MYSQL_DSN (or host/db/user) is set in secrets.php, payflow data uses MySQL.
 */

function mysql_is_configured(): bool
{
    if (defined('MYSQL_DSN') && MYSQL_DSN !== '') {
        return true;
    }
    return defined('MYSQL_HOST') && MYSQL_HOST !== ''
        && defined('MYSQL_DATABASE') && MYSQL_DATABASE !== ''
        && defined('MYSQL_USER') && MYSQL_USER !== '';
}

function mysql_pdo(): ?PDO
{
    static $pdo = false;
    if ($pdo !== false) {
        return $pdo instanceof PDO ? $pdo : null;
    }
    if (!mysql_is_configured() || !class_exists('PDO') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
        $pdo = null;
        return null;
    }
    try {
        if (defined('MYSQL_DSN') && MYSQL_DSN !== '') {
            $dsn = MYSQL_DSN;
        } else {
            $host = MYSQL_HOST;
            $port = defined('MYSQL_PORT') && MYSQL_PORT !== '' ? (string) MYSQL_PORT : '3306';
            $db = MYSQL_DATABASE;
            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
        }
        $user = defined('MYSQL_USER') ? MYSQL_USER : '';
        $pass = defined('MYSQL_PASSWORD') ? MYSQL_PASSWORD : '';
        $instance = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        mysql_ensure_schema($instance);
        $pdo = $instance;
        return $instance;
    } catch (Throwable $e) {
        error_log('ReconcileX MySQL connect failed: ' . $e->getMessage());
        $pdo = null;
        return null;
    }
}

function mysql_ensure_schema(PDO $db): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $db->exec("CREATE TABLE IF NOT EXISTS rx_agents (
        uid VARCHAR(64) PRIMARY KEY,
        agent_id VARCHAR(32) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL DEFAULT '',
        mobile VARCHAR(20) NOT NULL DEFAULT '',
        passcode VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        kyc_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        city VARCHAR(120) NOT NULL DEFAULT '',
        notes TEXT,
        parent_uid VARCHAR(64) NULL,
        pin_hash VARCHAR(255) NULL,
        daily_debit_cap DECIMAL(14,2) NULL,
        locale VARCHAR(8) NOT NULL DEFAULT 'en',
        branding_json JSON NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        last_login_at VARCHAR(40) NULL,
        INDEX idx_agents_status (status),
        INDEX idx_agents_parent (parent_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_wallets (
        uid VARCHAR(64) PRIMARY KEY,
        balance DECIMAL(14,2) NOT NULL DEFAULT 0,
        updated_at VARCHAR(40) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_ledger (
        id VARCHAR(64) PRIMARY KEY,
        uid VARCHAR(64) NOT NULL,
        entry_type VARCHAR(64) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        balance DECIMAL(14,2) NOT NULL,
        meta_json JSON NULL,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_ledger_uid_created (uid, created_at),
        INDEX idx_ledger_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_deposits (
        id VARCHAR(64) PRIMARY KEY,
        uid VARCHAR(64) NOT NULL,
        agent_id VARCHAR(32) NOT NULL DEFAULT '',
        provider VARCHAR(32) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        amount_paise INT NOT NULL,
        customer_name VARCHAR(191) NOT NULL DEFAULT '',
        mobile VARCHAR(20) NOT NULL DEFAULT '',
        email VARCHAR(191) NOT NULL DEFAULT '',
        category VARCHAR(120) NOT NULL DEFAULT '',
        status VARCHAR(40) NOT NULL,
        order_id VARCHAR(128) NULL,
        payment_session_id VARCHAR(191) NULL,
        payment_id VARCHAR(128) NULL,
        utr VARCHAR(128) NULL,
        credited TINYINT(1) NOT NULL DEFAULT 0,
        demo_mode TINYINT(1) NOT NULL DEFAULT 0,
        payload_json JSON NULL,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        paid_at VARCHAR(40) NULL,
        INDEX idx_deposits_order (order_id),
        INDEX idx_deposits_uid (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_admin_audit (
        id VARCHAR(64) PRIMARY KEY,
        actor_role VARCHAR(32) NOT NULL DEFAULT 'admin',
        action VARCHAR(80) NOT NULL,
        target_uid VARCHAR(64) NULL,
        reason VARCHAR(500) NOT NULL DEFAULT '',
        receipt_id VARCHAR(128) NOT NULL DEFAULT '',
        meta_json JSON NULL,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_audit_created (created_at),
        INDEX idx_audit_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_favorites (
        id VARCHAR(64) PRIMARY KEY,
        uid VARCHAR(64) NOT NULL,
        category_id VARCHAR(64) NOT NULL,
        category_name VARCHAR(120) NOT NULL DEFAULT '',
        consumer_number VARCHAR(120) NOT NULL DEFAULT '',
        customer_name VARCHAR(191) NOT NULL DEFAULT '',
        mobile VARCHAR(20) NOT NULL DEFAULT '',
        last_amount DECIMAL(14,2) NULL,
        use_count INT NOT NULL DEFAULT 1,
        updated_at VARCHAR(40) NOT NULL,
        UNIQUE KEY uq_fav (uid, category_id, consumer_number),
        INDEX idx_fav_uid (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_commission_rules (
        id VARCHAR(64) PRIMARY KEY,
        product VARCHAR(40) NOT NULL,
        fee_flat DECIMAL(14,2) NOT NULL DEFAULT 0,
        fee_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
        margin_flat DECIMAL(14,2) NOT NULL DEFAULT 0,
        margin_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        updated_at VARCHAR(40) NOT NULL,
        UNIQUE KEY uq_product (product)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_settlements (
        id VARCHAR(64) PRIMARY KEY,
        uid VARCHAR(64) NOT NULL,
        day_ist VARCHAR(10) NOT NULL,
        opening_balance DECIMAL(14,2) NOT NULL,
        closing_balance DECIMAL(14,2) NOT NULL,
        credits DECIMAL(14,2) NOT NULL DEFAULT 0,
        debits DECIMAL(14,2) NOT NULL DEFAULT 0,
        created_at VARCHAR(40) NOT NULL,
        UNIQUE KEY uq_uid_day (uid, day_ist),
        INDEX idx_settle_day (day_ist)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rx_disputes (
        id VARCHAR(64) PRIMARY KEY,
        uid VARCHAR(64) NOT NULL,
        agent_id VARCHAR(32) NOT NULL DEFAULT '',
        utr VARCHAR(128) NOT NULL,
        amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        status VARCHAR(40) NOT NULL DEFAULT 'open',
        notes TEXT,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        INDEX idx_dispute_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Seed default commission rules if empty
    $count = (int) $db->query('SELECT COUNT(*) FROM rx_commission_rules')->fetchColumn();
    if ($count === 0) {
        $now = gmdate('c');
        $stmt = $db->prepare(
            'INSERT INTO rx_commission_rules (id, product, fee_flat, fee_pct, margin_flat, margin_pct, active, updated_at)
             VALUES (?,?,?,?,?,?,1,?)'
        );
        $stmt->execute(['cm_bills', 'bills', 5.0, 0, 0, 0, $now]);
        $stmt->execute(['cm_qr', 'qr', 0, 0, 0, 0, $now]);
        $stmt->execute(['cm_topup', 'topup', 0, 0, 0, 0, $now]);
    }

    $done = true;
}
