<?php
require_once __DIR__ . '/config.php';

if (!google_is_configured()) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Google sign-in is not configured on the server.';
    exit;
}

$returnTo = isset($_GET['returnTo']) ? (string) $_GET['returnTo'] : '/';
$_SESSION['oauth_return'] = sanitize_oauth_return_path($returnTo);

$state = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;

$params = http_build_query([
    'client_id' => GOOGLE_CLIENT_ID,
    'redirect_uri' => GOOGLE_REDIRECT_URI,
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'access_type' => 'online',
    'include_granted_scopes' => 'true',
    'prompt' => 'select_account',
    'state' => $state,
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params, true, 302);
exit;
