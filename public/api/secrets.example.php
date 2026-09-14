<?php
/**
 * Copy to secrets.php on the server (gitignored).
 * Change ADMIN_PASSWORD before go-live. Never commit secrets.php.
 */
define('GOOGLE_CLIENT_ID', 'your-client-id.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', 'your-client-secret');
define('GOOGLE_REDIRECT_URI', 'https://reconcilex.in/api/google-callback.php');
define('APP_URL', 'https://reconcilex.in');

/** Super-admin (full control). Required. */
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
/** Optional: Dashboard → Webhooks → signing secret for payment.captured */
define('RAZORPAY_WEBHOOK_SECRET', '');

/** Cashfree (BetKing-compatible) — Dashboard → Developers */
define('CASHFREE_APP_ID', 'your-cashfree-app-id');
define('CASHFREE_SECRET_KEY', 'your-cashfree-secret-key');
define('CASHFREE_WEBHOOK_SECRET', ''); // preferred dedicated webhook secret
define('CASHFREE_ENVIRONMENT', 'sandbox'); // sandbox | production
define('CASHFREE_API_VERSION', '2023-08-01');

/** Firebase Web API key — used to verify ID tokens for PayFlow agents */
define('FIREBASE_WEB_API_KEY', '');

/** Optional: Google AI Studio / Gemini API key for richer exception explains */
define('GEMINI_API_KEY', '');
