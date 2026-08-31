<?php
require_once __DIR__ . '/../config.php';

if (!is_admin_authenticated()) {
    json_response(['authenticated' => false, 'admin' => null], 401);
}

json_response([
    'authenticated' => true,
    'admin' => [
        'authenticated' => true,
        'role' => admin_role(),
        'loggedInAt' => $_SESSION['admin']['loggedInAt'] ?? null,
    ],
    'permissions' => [
        'canMutateUsers' => admin_role() === 'super',
        'canReviewPayments' => in_array(admin_role(), ['super', 'billing'], true),
        'canEditSettings' => in_array(admin_role(), ['super', 'billing'], true),
        'canControl' => admin_role() === 'super',
        'canViewAudit' => true,
        'canViewAnalytics' => true,
    ],
]);
