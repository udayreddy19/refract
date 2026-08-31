<?php
require_once __DIR__ . '/../config.php';

$entries = [];
if (feature_enabled('publicChangelog')) {
    foreach (get_changelog(50) as $row) {
        if (!empty($row['published'])) {
            $entries[] = $row;
        }
    }
}

json_response(['entries' => $entries]);
