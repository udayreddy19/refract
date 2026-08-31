<?php
require_once __DIR__ . '/../config.php';
require_admin_role(['super', 'billing']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

if (empty($_FILES['qr']) || !is_uploaded_file($_FILES['qr']['tmp_name'])) {
    json_response(['error' => 'Upload a QR image file (qr).'], 400);
}

$file = $_FILES['qr'];
$ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
    json_response(['error' => 'Only jpg, png, webp, gif allowed.'], 400);
}
if (($file['size'] ?? 0) > 2 * 1024 * 1024) {
    json_response(['error' => 'Max file size is 2MB.'], 400);
}

$uploadDir = dirname(__DIR__, 2) . '/uploads';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$filename = 'upi_qr_' . date('Ymd_His') . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
$dest = $uploadDir . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    json_response(['error' => 'Failed to save upload.'], 500);
}

$publicPath = '/uploads/' . $filename;
$settings = get_settings();
$settings['qrPath'] = $publicPath;
$settings['updatedAt'] = gmdate('c');
write_store('settings.json', $settings);
append_audit('settings_qr_upload', ['qrPath' => $publicPath]);

json_response(['success' => true, 'qrPath' => $publicPath, 'settings' => $settings]);
