<?php
require_once __DIR__ . '/../config.php';

$session = require_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';
    $runs = get_runs_for_user((string) $session['uid']);
    if ($id !== '') {
        foreach ($runs as $run) {
            if (($run['id'] ?? '') === $id) {
                json_response(['run' => $run]);
            }
        }
        json_response(['error' => 'Run not found.'], 404);
    }
    // Strip heavy payload from list
    $light = array_map(function ($r) {
        $copy = $r;
        unset($copy['payloadB64']);
        return $copy;
    }, $runs);
    json_response(['runs' => $light]);
}

if ($method === 'POST') {
    $body = read_json_body();
    if (isset($body['action']) && $body['action'] === 'delete') {
        $id = isset($body['id']) ? trim((string) $body['id']) : '';
        if ($id === '') {
            json_response(['error' => 'id required.'], 400);
        }
        $uid = (string) $session['uid'];
        mutate_store('runs.json', function ($runs) use ($id, $uid) {
            if (!is_array($runs)) {
                return [];
            }
            return array_values(array_filter($runs, function ($r) use ($id, $uid) {
                if (($r['id'] ?? '') !== $id) {
                    return true;
                }
                return ($r['userId'] ?? '') !== $uid;
            }));
        }, []);
        json_response(['success' => true]);
    }

    if (isset($body['action']) && $body['action'] === 'workflow') {
        $id = isset($body['id']) ? trim((string) $body['id']) : '';
        $workflow = isset($body['workflow']) && is_array($body['workflow']) ? $body['workflow'] : null;
        if ($id === '' || !$workflow) {
            json_response(['error' => 'id and workflow required.'], 400);
        }
        $uid = (string) $session['uid'];
        $bag = ['run' => null, 'error' => null];
        mutate_store('runs.json', function ($runs) use ($id, $uid, $workflow, &$bag) {
            if (!is_array($runs)) {
                return [];
            }
            foreach ($runs as $i => $r) {
                if (($r['id'] ?? '') !== $id || ($r['userId'] ?? '') !== $uid) {
                    continue;
                }
                $clean = [];
                foreach ($workflow as $exId => $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $st = (string) ($row['status'] ?? 'open');
                    if (!in_array($st, ['open', 'fixed', 'ignored', 'assigned'], true)) {
                        $st = 'open';
                    }
                    $clean[(string) $exId] = [
                        'status' => $st,
                        'note' => substr(trim((string) ($row['note'] ?? '')), 0, 240),
                        'assignee' => substr(trim((string) ($row['assignee'] ?? '')), 0, 80),
                        'updatedAt' => gmdate('c'),
                    ];
                }
                $runs[$i]['workflow'] = $clean;
                $bag['run'] = $runs[$i];
                break;
            }
            if (!$bag['run']) {
                $bag['error'] = 'Run not found.';
            }
            return $runs;
        }, []);
        if ($bag['error']) {
            json_response(['error' => $bag['error']], 404);
        }
        json_response(['success' => true, 'run' => $bag['run']]);
    }

    rate_limit_check('runs_save', 30, 60);

    $summary = isset($body['summary']) && is_array($body['summary']) ? $body['summary'] : null;
    if (!$summary) {
        json_response(['error' => 'summary required.'], 400);
    }

    $label = isset($body['label']) ? trim((string) $body['label']) : '';
    $sources = isset($body['sources']) && is_array($body['sources']) ? array_values($body['sources']) : [];
    $exceptionTypes = isset($body['exceptionTypes']) && is_array($body['exceptionTypes']) ? $body['exceptionTypes'] : [];
    $workflow = isset($body['workflow']) && is_array($body['workflow']) ? $body['workflow'] : [];
    $brandId = isset($body['brandId']) ? trim((string) $body['brandId']) : '';
    $payloadB64 = isset($body['payloadB64']) ? (string) $body['payloadB64'] : '';

    // Cap CSV/payload replay size (~600KB base64 ≈ ~450KB raw)
    if ($payloadB64 !== '' && !feature_enabled('csvReplay')) {
        $payloadB64 = '';
    }
    if (strlen($payloadB64) > 600000) {
        json_response(['error' => 'Payload too large to save for replay. Save summary only.'], 413);
    }

    $user = find_user_by_uid((string) $session['uid']);
    if ($brandId === '' && $user) {
        $brandId = (string) ($user['brandId'] ?? '');
    }

    $run = [
        'id' => 'run_' . bin2hex(random_bytes(8)),
        'userId' => $session['uid'],
        'email' => $session['email'] ?? '',
        'label' => $label !== '' ? substr($label, 0, 120) : ('Run ' . gmdate('Y-m-d H:i')),
        'sources' => array_slice(array_map('strval', $sources), 0, 12),
        'brandId' => $brandId !== '' ? $brandId : null,
        'summary' => [
            'totalOrders' => (int) ($summary['totalOrders'] ?? 0),
            'totalPayments' => (int) ($summary['totalPayments'] ?? 0),
            'matchedCount' => (int) ($summary['matchedCount'] ?? 0),
            'exceptionCount' => (int) ($summary['exceptionCount'] ?? 0),
            'autoMatchRate' => (float) ($summary['autoMatchRate'] ?? 0),
            'amountAtRiskPaise' => (int) ($summary['amountAtRiskPaise'] ?? 0),
            'totalNetPaise' => (int) ($summary['totalNetPaise'] ?? 0),
        ],
        'exceptionTypes' => array_slice($exceptionTypes, 0, 40),
        'workflow' => $workflow,
        'hasPayload' => $payloadB64 !== '',
        'payloadB64' => $payloadB64 !== '' ? $payloadB64 : null,
        'createdAt' => gmdate('c'),
    ];

    $uid = (string) $session['uid'];
    mutate_store('runs.json', function ($runs) use ($run) {
        if (!is_array($runs)) {
            $runs = [];
        }
        $runs[] = $run;
        $byUser = [];
        $kept = [];
        for ($i = count($runs) - 1; $i >= 0; $i--) {
            $r = $runs[$i];
            if (!is_array($r)) {
                continue;
            }
            $u = (string) ($r['userId'] ?? '');
            $byUser[$u] = ($byUser[$u] ?? 0) + 1;
            if ($byUser[$u] > 40) {
                continue;
            }
            $kept[] = $r;
            if (count($kept) >= 2000) {
                break;
            }
        }
        return array_reverse($kept);
    }, []);

    track_analytics('run_saved', [
        'exceptionCount' => $run['summary']['exceptionCount'],
        'hasPayload' => $run['hasPayload'],
    ], $uid);

    $user = find_user_by_uid($uid);
    $alert = maybe_send_risk_alert($run, $user ?: null);

    $out = $run;
    unset($out['payloadB64']);
    json_response(['success' => true, 'run' => $out, 'alert' => $alert]);
}

json_response(['error' => 'Method not allowed.'], 405);
