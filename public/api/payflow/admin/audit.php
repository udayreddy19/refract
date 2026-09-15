<?php
require_once __DIR__ . '/../_bootstrap.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = max(1, min(500, (int) ($_GET['limit'] ?? 100)));
    $action = trim((string) ($_GET['action'] ?? ''));
    json_response([
        'entries' => payflow_admin_audit_list($limit, $action),
        'mysql' => payflow_use_mysql(),
    ]);
}

json_response(['error' => 'Method not allowed.'], 405);
