<?php
require_once __DIR__ . '/../config.php';

unset($_SESSION['admin']);
json_response(['success' => true]);
