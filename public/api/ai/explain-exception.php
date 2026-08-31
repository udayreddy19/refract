<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

rate_limit_check('ai_explain', 30, 60);
$body = read_json_body();
$ex = isset($body['exception']) && is_array($body['exception']) ? $body['exception'] : $body;
if (empty($ex['type']) && empty($ex['description'])) {
    json_response(['error' => 'exception payload required.'], 400);
}

$local = build_exception_explain_local($ex);
$useAi = !isset($body['useAi']) || !empty($body['useAi']);
$explain = $useAi ? gemini_enrich_exception_explain($local, $ex) : $local;

json_response([
    'success' => true,
    'explain' => $explain,
    'aiConfigured' => gemini_is_configured(),
]);
