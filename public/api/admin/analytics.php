<?php
require_once __DIR__ . '/../config.php';
require_admin();

$days = isset($_GET['days']) ? (int) $_GET['days'] : 30;
$days = max(1, min(90, $days));

json_response([
    'success' => true,
    'analytics' => get_analytics_summary($days),
    'storage' => [
        'sqlite' => sqlite_available(),
    ],
]);
