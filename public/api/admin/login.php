<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

if (!admin_password_configured()) {
    json_response(['error' => 'Admin password is not configured on the server.'], 503);
}

$body = read_json_body();
$password = isset($body['password']) ? (string) $body['password'] : '';
$role = resolve_admin_role_from_password($password);

if ($role === null) {
    json_response(['error' => 'Invalid admin password.'], 401);
}

$_SESSION['admin'] = [
    'authenticated' => true,
    'role' => $role,
    'loggedInAt' => gmdate('c'),
];

append_audit('admin_login', ['role' => $role]);

json_response([
    'success' => true,
    'admin' => [
        'authenticated' => true,
        'role' => $role,
        'loggedInAt' => $_SESSION['admin']['loggedInAt'],
    ],
]);
