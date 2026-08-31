<?php
/**
 * Admin control plane — feature flags, match rules, trial codes, changelog, brands, announcement.
 */
require_once __DIR__ . '/../config.php';
require_admin_role(['super']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_response([
        'settings' => get_settings(),
        'featureFlags' => get_feature_flags(),
        'matchRules' => get_match_rules(),
        'announcement' => get_settings()['announcement'] ?? ['enabled' => false, 'message' => '', 'level' => 'info'],
        'alerts' => get_alert_settings(),
        'trialCodes' => get_trial_codes(),
        'changelog' => get_changelog(100),
        'brands' => get_brands(),
        'aiConfigured' => gemini_is_configured(),
        'adminRolesConfigured' => [
            'super' => admin_password_configured(),
            'billing' => defined('ADMIN_BILLING_PASSWORD') && ADMIN_BILLING_PASSWORD !== '',
            'viewer' => defined('ADMIN_VIEWER_PASSWORD') && ADMIN_VIEWER_PASSWORD !== '',
        ],
    ]);
}

if ($method !== 'POST' && $method !== 'PATCH') {
    json_response(['error' => 'Method not allowed.'], 405);
}

$body = read_json_body();
$action = isset($body['action']) ? (string) $body['action'] : '';

if ($action === 'save_flags') {
    $flags = isset($body['featureFlags']) && is_array($body['featureFlags']) ? $body['featureFlags'] : null;
    if (!$flags) {
        json_response(['error' => 'featureFlags required.'], 400);
    }
    $current = get_settings();
    $merged = $current['featureFlags'] ?? [];
    foreach ($flags as $k => $v) {
        $merged[$k] = !empty($v);
    }
    $current['featureFlags'] = $merged;
    $current['updatedAt'] = gmdate('c');
    write_store('settings.json', $current);
    append_audit('admin_flags', ['flags' => $merged]);
    json_response(['success' => true, 'featureFlags' => $merged]);
}

if ($action === 'save_match_rules') {
    $rules = isset($body['matchRules']) && is_array($body['matchRules']) ? $body['matchRules'] : null;
    if (!$rules) {
        json_response(['error' => 'matchRules required.'], 400);
    }
    $current = get_settings();
    $current['matchRules'] = [
        'settlementWindowDays' => max(1, min(30, (int) ($rules['settlementWindowDays'] ?? 5))),
        'amountTolerancePaise' => max(0, min(10000, (int) ($rules['amountTolerancePaise'] ?? 100))),
        'feePct' => max(0, min(0.2, (float) ($rules['feePct'] ?? 0.02))),
        'feeAnomalyFactor' => max(1, min(2, (float) ($rules['feeAnomalyFactor'] ?? 1.05))),
        'fuzzyWindowDays' => max(1, min(14, (int) ($rules['fuzzyWindowDays'] ?? 3))),
    ];
    $current['updatedAt'] = gmdate('c');
    write_store('settings.json', $current);
    append_audit('admin_match_rules', ['rules' => $current['matchRules']]);
    json_response(['success' => true, 'matchRules' => $current['matchRules']]);
}

if ($action === 'save_announcement') {
    $ann = isset($body['announcement']) && is_array($body['announcement']) ? $body['announcement'] : [];
    $current = get_settings();
    $current['announcement'] = [
        'enabled' => !empty($ann['enabled']),
        'message' => substr(trim((string) ($ann['message'] ?? '')), 0, 500),
        'level' => in_array(($ann['level'] ?? ''), ['info', 'warn', 'critical'], true) ? $ann['level'] : 'info',
    ];
    $current['updatedAt'] = gmdate('c');
    write_store('settings.json', $current);
    append_audit('admin_announcement', $current['announcement']);
    json_response(['success' => true, 'announcement' => $current['announcement']]);
}

if ($action === 'save_alerts') {
    $alerts = isset($body['alerts']) && is_array($body['alerts']) ? $body['alerts'] : [];
    $current = get_settings();
    $hook = trim((string) ($alerts['slackWebhook'] ?? ''));
    if ($hook !== '' && strpos($hook, 'https://hooks.slack.com/') !== 0) {
        json_response(['error' => 'Slack webhook must start with https://hooks.slack.com/'], 400);
    }
    $current['alerts'] = [
        'enabled' => !empty($alerts['enabled']),
        'thresholdInr' => max(0, (int) ($alerts['thresholdInr'] ?? 10000)),
        'email' => substr(trim((string) ($alerts['email'] ?? '')), 0, 120),
        'slackWebhook' => substr($hook, 0, 250),
    ];
    $current['updatedAt'] = gmdate('c');
    write_store('settings.json', $current);
    append_audit('admin_alerts', ['thresholdInr' => $current['alerts']['thresholdInr'], 'enabled' => $current['alerts']['enabled']]);
    json_response(['success' => true, 'alerts' => $current['alerts']]);
}

if ($action === 'create_trial_code') {
    $code = strtoupper(trim((string) ($body['code'] ?? '')));
    if ($code === '') {
        $code = 'RX' . strtoupper(bin2hex(random_bytes(3)));
    }
    $days = max(1, min(90, (int) ($body['days'] ?? 7)));
    $maxUses = max(1, min(10000, (int) ($body['maxUses'] ?? 50)));
    $row = [
        'code' => $code,
        'days' => $days,
        'maxUses' => $maxUses,
        'used' => 0,
        'active' => true,
        'createdAt' => gmdate('c'),
        'note' => substr(trim((string) ($body['note'] ?? '')), 0, 120),
    ];
    mutate_store('trial_codes.json', function ($rows) use ($row, $code) {
        if (!is_array($rows)) {
            $rows = [];
        }
        foreach ($rows as $r) {
            if (strtoupper((string) ($r['code'] ?? '')) === $code) {
                return $rows; // keep existing
            }
        }
        $rows[] = $row;
        return $rows;
    }, []);
    append_audit('trial_code_create', ['code' => $code]);
    json_response(['success' => true, 'code' => $row, 'trialCodes' => get_trial_codes()]);
}

if ($action === 'toggle_trial_code') {
    $code = strtoupper(trim((string) ($body['code'] ?? '')));
    $active = !empty($body['active']);
    mutate_store('trial_codes.json', function ($rows) use ($code, $active) {
        if (!is_array($rows)) {
            return [];
        }
        foreach ($rows as $i => $r) {
            if (strtoupper((string) ($r['code'] ?? '')) === $code) {
                $rows[$i]['active'] = $active;
            }
        }
        return $rows;
    }, []);
    json_response(['success' => true, 'trialCodes' => get_trial_codes()]);
}

if ($action === 'add_changelog') {
    $title = trim((string) ($body['title'] ?? ''));
    $bodyText = trim((string) ($body['body'] ?? ''));
    if ($title === '') {
        json_response(['error' => 'title required.'], 400);
    }
    $entry = [
        'id' => 'cl_' . bin2hex(random_bytes(5)),
        'title' => substr($title, 0, 120),
        'body' => substr($bodyText, 0, 2000),
        'at' => gmdate('c'),
        'published' => !isset($body['published']) || !empty($body['published']),
    ];
    mutate_store('changelog.json', function ($rows) use ($entry) {
        if (!is_array($rows)) {
            $rows = [];
        }
        array_unshift($rows, $entry);
        return array_slice($rows, 0, 100);
    }, []);
    append_audit('changelog_add', ['id' => $entry['id']]);
    json_response(['success' => true, 'entry' => $entry, 'changelog' => get_changelog(100)]);
}

if ($action === 'delete_changelog') {
    $id = trim((string) ($body['id'] ?? ''));
    mutate_store('changelog.json', function ($rows) use ($id) {
        if (!is_array($rows)) {
            return [];
        }
        return array_values(array_filter($rows, function ($r) use ($id) {
            return ($r['id'] ?? '') !== $id;
        }));
    }, []);
    json_response(['success' => true, 'changelog' => get_changelog(100)]);
}

if ($action === 'create_brand') {
    $name = trim((string) ($body['name'] ?? ''));
    $ownerUid = trim((string) ($body['ownerUid'] ?? ''));
    if ($name === '' || $ownerUid === '') {
        json_response(['error' => 'name and ownerUid required.'], 400);
    }
    $brand = [
        'id' => 'brand_' . bin2hex(random_bytes(5)),
        'name' => substr($name, 0, 80),
        'ownerUid' => $ownerUid,
        'createdAt' => gmdate('c'),
    ];
    mutate_store('brands.json', function ($rows) use ($brand) {
        if (!is_array($rows)) {
            $rows = [];
        }
        $rows[] = $brand;
        return $rows;
    }, []);
    update_user($ownerUid, [
        'brandId' => $brand['id'],
        'brandName' => $brand['name'],
    ]);
    append_audit('brand_create', ['brandId' => $brand['id'], 'ownerUid' => $ownerUid]);
    json_response(['success' => true, 'brand' => $brand, 'brands' => get_brands()]);
}

if ($action === 'delete_brand') {
    $id = trim((string) ($body['id'] ?? ''));
    mutate_store('brands.json', function ($rows) use ($id) {
        if (!is_array($rows)) {
            return [];
        }
        return array_values(array_filter($rows, function ($r) use ($id) {
            return ($r['id'] ?? '') !== $id;
        }));
    }, []);
    mutate_store('users.json', function ($users) use ($id) {
        if (!is_array($users)) {
            return [];
        }
        foreach ($users as $i => $u) {
            if (($u['brandId'] ?? '') === $id) {
                $users[$i]['brandId'] = null;
                $users[$i]['brandName'] = '';
            }
        }
        return $users;
    }, []);
    json_response(['success' => true, 'brands' => get_brands()]);
}

if ($action === 'grant_trial_user') {
    $uid = trim((string) ($body['uid'] ?? ''));
    $days = (int) ($body['days'] ?? 7);
    if ($uid === '') {
        json_response(['error' => 'uid required.'], 400);
    }
    $user = grant_trial_pro($uid, $days, (string) ($body['note'] ?? 'admin'));
    if (!$user) {
        json_response(['error' => 'User not found.'], 404);
    }
    json_response(['success' => true, 'user' => $user]);
}

json_response(['error' => 'Unknown action.'], 400);
