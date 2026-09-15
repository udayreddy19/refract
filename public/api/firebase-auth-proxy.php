<?php
/**
 * Transparent reverse proxy for Firebase Auth reserved URLs.
 * Serves /__/auth/* and /__/firebase/init.json from the Firebase project
 * so Google Sign-In shows "continue to reconcilex.in" instead of
 * refract-47a33.firebaseapp.com.
 */
declare(strict_types=1);

$firebaseOrigin = 'https://refract-47a33.firebaseapp.com';

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Prefer rewritten path from .htaccess when present
if (!empty($_GET['__fbpath'])) {
    $requestPath = '/' . ltrim((string) $_GET['__fbpath'], '/');
    unset($_GET['__fbpath']);
}

if (
    !str_starts_with($requestPath, '/__/auth') &&
    $requestPath !== '/__/firebase/init.json'
) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found';
    exit;
}

$forwardGet = $_GET;
unset($forwardGet['__fbpath']);
$target = $firebaseOrigin . $requestPath;
if ($forwardGet !== []) {
    $target .= '?' . http_build_query($forwardGet);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$body = null;
if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    $body = file_get_contents('php://input');
}

$headers = [
    'Host: refract-47a33.firebaseapp.com',
    'Accept: ' . ($_SERVER['HTTP_ACCEPT'] ?? '*/*'),
    'Accept-Language: ' . ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? 'en'),
    'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'ReconcileX-Firebase-Auth-Proxy'),
];

if (!empty($_SERVER['CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}
if (!empty($_SERVER['HTTP_CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['HTTP_CONTENT_TYPE'];
}

$ch = curl_init($target);
if ($ch === false) {
    http_response_code(502);
    echo 'Proxy init failed';
    exit;
}

curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_ENCODING => '',
]);

if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Proxy error: ' . $err;
    exit;
}

$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$rawBody = substr($response, $headerSize);

http_response_code($status > 0 ? $status : 502);

$skip = [
    'transfer-encoding',
    'connection',
    'keep-alive',
    'content-length',
    'content-encoding',
    'host',
];

foreach (explode("\r\n", $rawHeaders) as $line) {
    if ($line === '' || str_starts_with($line, 'HTTP/')) {
        continue;
    }
    $pos = strpos($line, ':');
    if ($pos === false) {
        continue;
    }
    $name = substr($line, 0, $pos);
    $value = ltrim(substr($line, $pos + 1));
    if (in_array(strtolower($name), $skip, true)) {
        continue;
    }
    // Keep browser on our domain if Firebase redirects
    if (strtolower($name) === 'location') {
        $value = str_replace($firebaseOrigin, 'https://reconcilex.in', $value);
    }
    header($name . ': ' . $value, false);
}

// init.json may 404 until Hosting is live — synthesize from env-equivalent defaults
if ($requestPath === '/__/firebase/init.json' && ($status === 404 || $rawBody === '')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(200);
    echo json_encode([
        'apiKey' => 'AIzaSyDYyzUIGc-Q9Vvl22N1tve4Vft3RkNM2pI',
        'appId' => '1:342929166762:web:3319ecc40d3a9c87205bd3',
        'authDomain' => 'reconcilex.in',
        'messagingSenderId' => '342929166762',
        'projectId' => 'refract-47a33',
        'storageBucket' => 'refract-47a33.firebasestorage.app',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

echo $rawBody;
