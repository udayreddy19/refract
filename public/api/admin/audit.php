<?php
require_once __DIR__ . '/../config.php';
require_admin();

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
json_response(['events' => get_audit($limit)]);
