<?php
/**
 * Copy to secrets.php on the server (gitignored).
 * Change ADMIN_PASSWORD before go-live. Never commit secrets.php.
 */
define('APP_ENV', 'production'); // use 'local' only on development machines
define('PAYFLOW_ALLOW_DEMO', '0'); // never enable on production

define('GOOGLE_CLIENT_ID', 'your-client-id.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', 'your-client-secret');
define('GOOGLE_REDIRECT_URI', 'https://reconcilex.in/api/google-callback.php');
define('APP_URL', 'https://reconcilex.in');

/** Super-admin (full control). Required for /admin — min 12 chars, not a placeholder. */
define('ADMIN_PASSWORD', 'change-me-to-a-long-random-password');
/** Optional role passwords — leave blank to disable that role login */
define('ADMIN_BILLING_PASSWORD', '');
define('ADMIN_VIEWER_PASSWORD', '');

define('MAIL_FROM', 'noreply@reconcilex.in');
/** Used by /api/cron/remind.php?key=... (hourly cron recommended) */
define('CRON_SECRET', 'change-me-cron-secret');

/** Razorpay Dashboard → API Keys (use live keys on production) */
define('RAZORPAY_KEY_ID', 'rzp_live_xxxxxxxx');
define('RAZORPAY_KEY_SECRET', 'your-razorpay-key-secret');
/** Required in production for webhooks */
define('RAZORPAY_WEBHOOK_SECRET', '');

/** Cashfree — Dashboard → Developers */
define('CASHFREE_APP_ID', 'your-cashfree-app-id');
define('CASHFREE_SECRET_KEY', 'your-cashfree-secret-key');
define('CASHFREE_WEBHOOK_SECRET', ''); // required in production
define('CASHFREE_ENVIRONMENT', 'production'); // or sandbox
define('CASHFREE_API_VERSION', '2023-08-01');

define('FIREBASE_WEB_API_KEY', '');

/** ServerByt MySQL (Databases panel). Required for durable agents/wallets. */
define('MYSQL_HOST', 'localhost');
define('MYSQL_PORT', '3306');
define('MYSQL_DATABASE', 'your_database_name');
define('MYSQL_USER', 'your_database_user');
define('MYSQL_PASSWORD', 'your_database_password');
// Or set a full DSN instead of the fields above:
// define('MYSQL_DSN', 'mysql:host=localhost;port=3306;dbname=your_db;charset=utf8mb4');

/** Optional WhatsApp deep-link alerts (1 = enable) */
define('WHATSAPP_ALERTS_ENABLED', '0');
define('LOW_BALANCE_THRESHOLD', '500');
define('DEFAULT_DAILY_DEBIT_CAP', '200000');
define('DEBIT_VELOCITY_MAX', '40');
define('DEBIT_VELOCITY_WINDOW_MIN', '60');
