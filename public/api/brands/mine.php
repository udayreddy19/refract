<?php
require_once __DIR__ . '/../config.php';

$session = require_user();
if (!feature_enabled('agencyBrands')) {
    json_response(['error' => 'Agency brands are disabled.'], 403);
}

$method = $_SERVER['REQUEST_METHOD'];
$user = find_user_by_uid((string) $session['uid']);

if ($method === 'GET') {
    $mine = [];
    foreach (get_brands() as $b) {
        if (($b['ownerUid'] ?? '') === ($session['uid'] ?? '') || ($user['brandId'] ?? '') === ($b['id'] ?? '')) {
            $mine[] = $b;
        }
    }
    // Also list brands owned
    json_response([
        'brands' => $mine,
        'activeBrandId' => $user['brandId'] ?? null,
        'activeBrandName' => $user['brandName'] ?? '',
    ]);
}

if ($method !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

rate_limit_check('brands', 20, 60);
$body = read_json_body();
$action = (string) ($body['action'] ?? '');

if ($action === 'create') {
    $name = trim((string) ($body['name'] ?? ''));
    if (strlen($name) < 2) {
        json_response(['error' => 'Brand name required.'], 400);
    }
    $brand = [
        'id' => 'brand_' . bin2hex(random_bytes(5)),
        'name' => substr($name, 0, 80),
        'ownerUid' => $session['uid'],
        'createdAt' => gmdate('c'),
    ];
    mutate_store('brands.json', function ($rows) use ($brand) {
        if (!is_array($rows)) {
            $rows = [];
        }
        $rows[] = $brand;
        return $rows;
    }, []);
    update_user((string) $session['uid'], [
        'brandId' => $brand['id'],
        'brandName' => $brand['name'],
    ]);
    json_response(['success' => true, 'brand' => $brand]);
}

if ($action === 'switch') {
    $id = trim((string) ($body['brandId'] ?? ''));
    if ($id === '') {
        update_user((string) $session['uid'], ['brandId' => null, 'brandName' => '']);
        json_response(['success' => true, 'brandId' => null]);
    }
    $brand = find_brand($id);
    if (!$brand) {
        json_response(['error' => 'Brand not found.'], 404);
    }
    if (($brand['ownerUid'] ?? '') !== ($session['uid'] ?? '') && ($user['brandId'] ?? '') !== $id) {
        // Allow switch if owner or already assigned by admin
        if (($brand['ownerUid'] ?? '') !== ($session['uid'] ?? '')) {
            json_response(['error' => 'Not allowed to switch to this brand.'], 403);
        }
    }
    update_user((string) $session['uid'], [
        'brandId' => $brand['id'],
        'brandName' => $brand['name'],
    ]);
    json_response(['success' => true, 'brand' => $brand]);
}

json_response(['error' => 'Unknown action.'], 400);
