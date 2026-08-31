<?php
require_once __DIR__ . '/../config.php';

$sessionUser = require_user();
$payments = get_payments();
$mine = array_values(array_filter($payments, function ($p) use ($sessionUser) {
    return ($p['userId'] ?? '') === ($sessionUser['uid'] ?? '');
}));

usort($mine, function ($a, $b) {
    return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
});

json_response(['payments' => $mine]);
