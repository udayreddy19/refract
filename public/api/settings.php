<?php
require_once __DIR__ . '/../config.php';

$settings = get_settings();
$flags = get_feature_flags();
$ann = $settings['announcement'] ?? ['enabled' => false, 'message' => '', 'level' => 'info'];

$changelog = [];
if (!empty($flags['publicChangelog'])) {
    foreach (get_changelog(20) as $row) {
        if (!empty($row['published'])) {
            $changelog[] = $row;
        }
    }
}

json_response([
    'settings' => [
        'upiId' => $settings['upiId'],
        'qrPath' => $settings['qrPath'],
        'payeeName' => $settings['payeeName'] ?? 'ReconcileX',
        'plans' => $settings['plans'],
        'razorpayEnabled' => razorpay_is_configured(),
        'razorpayKeyId' => razorpay_is_configured() ? RAZORPAY_KEY_ID : '',
        'gstin' => $settings['gstin'] ?? '',
        'matchRules' => get_match_rules(),
        'featureFlags' => [
            'sampleDemo' => !empty($flags['sampleDemo']),
            'trialCodes' => !empty($flags['trialCodes']),
            'agencyBrands' => !empty($flags['agencyBrands']),
            'csvReplay' => !empty($flags['csvReplay']),
            'publicChangelog' => !empty($flags['publicChangelog']),
            'maintenanceMode' => !empty($flags['maintenanceMode']),
        ],
        'announcement' => $ann,
    ],
    'changelog' => $changelog,
]);
