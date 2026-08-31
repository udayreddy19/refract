<?php
/**
 * Cron: hit hourly with ?key=CRON_SECRET
 * Emails users whose reminderHour matches current IST hour.
 */
require_once __DIR__ . '/../config.php';

$key = isset($_GET['key']) ? (string) $_GET['key'] : '';
$expected = defined('CRON_SECRET') ? CRON_SECRET : '';
if ($expected === '' || !hash_equals($expected, $key)) {
    json_response(['error' => 'Unauthorized.'], 401);
}

$tz = new DateTimeZone('Asia/Kolkata');
$now = new DateTime('now', $tz);
$hour = (int) $now->format('G');
$app = defined('APP_URL') ? APP_URL : 'https://reconcilex.in';

$sent = 0;
$users = get_users();
foreach ($users as $user) {
    $pref = isset($user['reminderHour']) ? (int) $user['reminderHour'] : -1;
    if ($pref !== $hour) {
        continue;
    }
    $email = (string) ($user['email'] ?? '');
    if ($email === '') {
        continue;
    }
    $name = (string) ($user['name'] ?? 'there');
    $ok = send_app_mail(
        $email,
        'ReconcileX daily reminder',
        "Hi {$name},\n\nTime for today's reconciliation.\n\nOpen {$app}/#tool to upload CSVs and run recon.\n\n— ReconcileX\n"
    );
    if ($ok) {
        $sent++;
    }
}

append_audit('cron_remind', ['hour' => $hour, 'sent' => $sent]);

$expired = expire_lapsed_pro_users();
if ($expired > 0) {
    append_audit('cron_expire_pro', ['expired' => $expired]);
}

$digests = 0;
// Send digests once per day at 8 IST
if ($hour === 8) {
    $digests = send_exception_digests();
    if ($digests > 0) {
        append_audit('cron_exception_digest', ['sent' => $digests]);
    }
}

json_response([
    'success' => true,
    'hour' => $hour,
    'sent' => $sent,
    'expiredPro' => $expired,
    'digests' => $digests,
]);
