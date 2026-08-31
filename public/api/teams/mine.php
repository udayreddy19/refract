<?php
require_once __DIR__ . '/../config.php';

$session = require_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $teamId = '';
    $user = find_user_by_uid((string) $session['uid']);
    if ($user) {
        $teamId = (string) ($user['teamId'] ?? '');
    }
    $team = $teamId !== '' ? find_team($teamId) : null;
    $members = [];
    if ($team) {
        foreach (get_users() as $u) {
            if (($u['teamId'] ?? '') === ($team['id'] ?? '')) {
                $members[] = [
                    'uid' => $u['uid'],
                    'name' => $u['name'] ?? '',
                    'email' => $u['email'] ?? '',
                    'isOwner' => ($u['uid'] ?? '') === ($team['ownerUid'] ?? ''),
                ];
            }
        }
    }
    json_response([
        'team' => $team,
        'members' => $members,
        'teamPro' => $user ? team_grants_pro($user) : false,
    ]);
}

if ($method !== 'POST') {
    json_response(['error' => 'Method not allowed.'], 405);
}

rate_limit_check('teams', 20, 60);
$body = read_json_body();
$action = isset($body['action']) ? (string) $body['action'] : '';

if ($action === 'create') {
    $name = isset($body['name']) ? trim((string) $body['name']) : '';
    if ($name === '' || strlen($name) < 2) {
        json_response(['error' => 'Team name is required.'], 400);
    }
    $user = find_user_by_uid((string) $session['uid']);
    if ($user && !empty($user['teamId'])) {
        json_response(['error' => 'Leave your current team before creating another.'], 409);
    }

    $team = [
        'id' => 'team_' . bin2hex(random_bytes(6)),
        'name' => $name,
        'ownerUid' => $session['uid'],
        'inviteCode' => strtoupper(bin2hex(random_bytes(3))),
        'createdAt' => gmdate('c'),
    ];

    mutate_store('teams.json', function ($teams) use ($team) {
        if (!is_array($teams)) {
            $teams = [];
        }
        $teams[] = $team;
        return $teams;
    }, []);

    update_user((string) $session['uid'], [
        'teamId' => $team['id'],
        'teamName' => $name,
        'teamRole' => 'owner',
    ]);

    append_audit('team_create', ['teamId' => $team['id'], 'userId' => $session['uid']]);
    json_response(['success' => true, 'team' => $team]);
}

if ($action === 'join') {
    $code = isset($body['inviteCode']) ? strtoupper(trim((string) $body['inviteCode'])) : '';
    if ($code === '') {
        json_response(['error' => 'Invite code required.'], 400);
    }
    $team = find_team_by_code($code);
    if (!$team) {
        json_response(['error' => 'Invalid invite code.'], 404);
    }
    $user = find_user_by_uid((string) $session['uid']);
    if ($user && !empty($user['teamId']) && ($user['teamId'] ?? '') === ($team['id'] ?? '')) {
        json_response(['success' => true, 'team' => $team, 'message' => 'Already on this team.']);
    }
    if ($user && !empty($user['teamId'])) {
        json_response(['error' => 'Leave your current team before joining another.'], 409);
    }

    update_user((string) $session['uid'], [
        'teamId' => $team['id'],
        'teamName' => $team['name'] ?? '',
        'teamRole' => 'member',
    ]);

    // Inherit Pro session if owner is Pro
    if (team_grants_pro(array_merge($user ?: [], ['teamId' => $team['id']]))) {
        set_user_session(array_merge($session, [
            'isPro' => true,
            'paymentStatus' => 'approved',
        ]));
    }

    append_audit('team_join', ['teamId' => $team['id'], 'userId' => $session['uid']]);
    json_response(['success' => true, 'team' => $team]);
}

if ($action === 'leave') {
    $user = find_user_by_uid((string) $session['uid']);
    $teamId = (string) ($user['teamId'] ?? '');
    if ($teamId === '') {
        json_response(['success' => true]);
    }
    $team = find_team($teamId);
    if ($team && ($team['ownerUid'] ?? '') === ($session['uid'] ?? '')) {
        // Owner leaving dissolves team membership for all
        mutate_store('users.json', function ($users) use ($teamId) {
            if (!is_array($users)) {
                return [];
            }
            foreach ($users as $i => $u) {
                if (($u['teamId'] ?? '') === $teamId) {
                    $users[$i]['teamId'] = null;
                    $users[$i]['teamName'] = '';
                    $users[$i]['teamRole'] = null;
                }
            }
            return $users;
        }, []);
        mutate_store('teams.json', function ($teams) use ($teamId) {
            if (!is_array($teams)) {
                return [];
            }
            return array_values(array_filter($teams, function ($t) use ($teamId) {
                return ($t['id'] ?? '') !== $teamId;
            }));
        }, []);
    } else {
        update_user((string) $session['uid'], [
            'teamId' => null,
            'teamName' => '',
            'teamRole' => null,
        ]);
    }
    append_audit('team_leave', ['teamId' => $teamId, 'userId' => $session['uid']]);
    json_response(['success' => true]);
}

json_response(['error' => 'Unknown action.'], 400);
