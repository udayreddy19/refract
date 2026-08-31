<?php
require_once __DIR__ . '/config.php';

clear_user_session();

if (isset($_GET['redirect'])) {
    header('Location: ' . rtrim(APP_URL, '/') . '/', true, 302);
    exit;
}

json_response(['success' => true]);
