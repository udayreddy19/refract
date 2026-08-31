<?php
require_once __DIR__ . '/config.php';

function redirect_app(string $path = '/', string $query = ''): void
{
    $path = sanitize_oauth_return_path($path);
    $url = rtrim(APP_URL, '/') . $path;
    if ($query !== '') {
        $url .= (strpos($url, '?') === false ? '?' : '&') . ltrim($query, '?&');
    }
    header('Location: ' . $url, true, 302);
    exit;
}

function redirect_home(string $query = ''): void
{
    redirect_app('/', $query);
}

if (!google_is_configured()) {
    redirect_home('auth_error=' . rawurlencode('Google sign-in is not configured.'));
}

if (isset($_GET['error'])) {
    redirect_home('auth_error=' . rawurlencode((string) $_GET['error']));
}

$state = isset($_GET['state']) ? (string) $_GET['state'] : '';
$code = isset($_GET['code']) ? (string) $_GET['code'] : '';
$expected = isset($_SESSION['oauth_state']) ? (string) $_SESSION['oauth_state'] : '';
unset($_SESSION['oauth_state']);

if ($code === '' || $state === '' || $expected === '' || !hash_equals($expected, $state)) {
    redirect_home('auth_error=' . rawurlencode('Invalid Google sign-in response. Please try again.'));
}

$tokenPayload = http_build_query([
    'code' => $code,
    'client_id' => GOOGLE_CLIENT_ID,
    'client_secret' => GOOGLE_CLIENT_SECRET,
    'redirect_uri' => GOOGLE_REDIRECT_URI,
    'grant_type' => 'authorization_code',
]);

$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $tokenPayload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_TIMEOUT => 20,
]);
$tokenRaw = curl_exec($ch);
$tokenErr = curl_error($ch);
$tokenCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($tokenRaw === false || $tokenCode >= 400) {
    redirect_home('auth_error=' . rawurlencode($tokenErr !== '' ? $tokenErr : 'Failed to exchange Google auth code.'));
}

$tokenData = json_decode($tokenRaw, true);
$accessToken = is_array($tokenData) ? ($tokenData['access_token'] ?? '') : '';
if ($accessToken === '') {
    redirect_home('auth_error=' . rawurlencode('Google did not return an access token.'));
}

$ch = curl_init('https://www.googleapis.com/oauth2/v3/userinfo');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    CURLOPT_TIMEOUT => 20,
]);
$profileRaw = curl_exec($ch);
$profileErr = curl_error($ch);
$profileCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($profileRaw === false || $profileCode >= 400) {
    redirect_home('auth_error=' . rawurlencode($profileErr !== '' ? $profileErr : 'Failed to load Google profile.'));
}

$profile = json_decode($profileRaw, true);
if (!is_array($profile) || empty($profile['sub']) || empty($profile['email'])) {
    redirect_home('auth_error=' . rawurlencode('Google profile was incomplete.'));
}

$name = trim((string) ($profile['name'] ?? ''));
if ($name === '') {
    $name = explode('@', (string) $profile['email'])[0];
}

$uid = 'google_' . $profile['sub'];
$now = gmdate('c');

$stored = upsert_user([
    'uid' => $uid,
    'name' => $name,
    'email' => strtolower((string) $profile['email']),
    'avatar' => get_initials($name),
    'photoURL' => $profile['picture'] ?? null,
    'lastLoginAt' => $now,
    'status' => 'active',
]);

set_user_session([
    'uid' => $stored['uid'],
    'name' => $stored['name'],
    'email' => $stored['email'],
    'avatar' => $stored['avatar'],
    'isPro' => !empty($stored['isPro']),
    'selectedPlan' => $stored['plan'] ?? null,
    'utrValue' => $stored['utrValue'] ?? null,
    'photoURL' => $stored['photoURL'] ?? null,
]);

$returnTo = isset($_SESSION['oauth_return']) ? (string) $_SESSION['oauth_return'] : '/';
unset($_SESSION['oauth_return']);
redirect_app($returnTo, 'signed_in=1');
