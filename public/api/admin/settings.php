<?php
require_once __DIR__ . '/../config.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_response(['settings' => get_settings()]);
}

if ($method === 'POST' || $method === 'PATCH') {
    require_admin_role(['super', 'billing']);
    $body = read_json_body();
    $current = get_settings();

    if (isset($body['upiId'])) {
        $current['upiId'] = trim((string) $body['upiId']);
    }
    if (isset($body['qrPath'])) {
        $current['qrPath'] = trim((string) $body['qrPath']);
    }
    if (isset($body['payeeName'])) {
        $current['payeeName'] = trim((string) $body['payeeName']);
    }
    if (isset($body['gstin'])) {
        $current['gstin'] = trim((string) $body['gstin']);
    }
    if (isset($body['gstRate'])) {
        $current['gstRate'] = (float) $body['gstRate'];
    }
    if (isset($body['billingAddress'])) {
        $current['billingAddress'] = trim((string) $body['billingAddress']);
    }
    if (isset($body['plans']) && is_array($body['plans'])) {
        foreach (['monthly', 'quarterly', 'annual'] as $plan) {
            if (!isset($body['plans'][$plan]) || !is_array($body['plans'][$plan])) {
                continue;
            }
            if (isset($body['plans'][$plan]['label'])) {
                $current['plans'][$plan]['label'] = trim((string) $body['plans'][$plan]['label']);
            }
            if (isset($body['plans'][$plan]['amount'])) {
                $current['plans'][$plan]['amount'] = (int) $body['plans'][$plan]['amount'];
            }
        }
    }

    $current['updatedAt'] = gmdate('c');
    write_store('settings.json', $current);
    json_response(['success' => true, 'settings' => $current]);
}

json_response(['error' => 'Method not allowed.'], 405);
