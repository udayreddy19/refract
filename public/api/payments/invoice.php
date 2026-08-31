<?php
/**
 * GST tax invoice (HTML, print-to-PDF).
 */
require_once __DIR__ . '/../config.php';

$id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';
if ($id === '') {
    http_response_code(400);
    echo 'Missing invoice id.';
    exit;
}

$payment = null;
foreach (get_payments() as $row) {
    if (($row['id'] ?? '') === $id) {
        $payment = $row;
        break;
    }
}

if (!$payment) {
    http_response_code(404);
    echo 'Invoice not found.';
    exit;
}

$session = current_user_session();
$isOwner = $session && ($session['uid'] ?? '') === ($payment['userId'] ?? '');
if (!$isOwner && !is_admin_authenticated()) {
    http_response_code(401);
    echo 'Sign in required.';
    exit;
}

if (!in_array(($payment['status'] ?? ''), ['approved', 'refunded'], true)) {
    http_response_code(400);
    echo 'Invoice available after payment approval.';
    exit;
}

$settings = get_settings();
$breakdown = invoice_breakdown((int) ($payment['amount'] ?? 0));
$gstin = (string) ($settings['gstin'] ?? '');
$payee = htmlspecialchars((string) ($settings['payeeName'] ?? 'ReconcileX'), ENT_QUOTES, 'UTF-8');
$addr = nl2br(htmlspecialchars((string) ($settings['billingAddress'] ?? 'India'), ENT_QUOTES, 'UTF-8'));
$buyer = htmlspecialchars((string) ($payment['name'] ?? $payment['email'] ?? 'Customer'), ENT_QUOTES, 'UTF-8');
$email = htmlspecialchars((string) ($payment['email'] ?? ''), ENT_QUOTES, 'UTF-8');
$plan = htmlspecialchars((string) ($payment['plan'] ?? ''), ENT_QUOTES, 'UTF-8');
$ref = htmlspecialchars((string) ($payment['razorpayPaymentId'] ?? $payment['utr'] ?? $payment['id'] ?? ''), ENT_QUOTES, 'UTF-8');
$date = htmlspecialchars((string) ($payment['reviewedAt'] ?? $payment['createdAt'] ?? gmdate('c')), ENT_QUOTES, 'UTF-8');
$inv = htmlspecialchars($id, ENT_QUOTES, 'UTF-8');

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice <?= $inv ?></title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 40px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #555; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px 6px; text-align: left; font-size: 14px; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .totals td { border: none; }
    .right { text-align: right; }
    .actions { margin-top: 28px; }
    @media print { .actions { display: none; } body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Tax Invoice</h1>
  <p class="muted"><?= $payee ?><?= $gstin !== '' ? ' · GSTIN ' . htmlspecialchars($gstin, ENT_QUOTES, 'UTF-8') : '' ?></p>
  <p class="muted"><?= $addr ?></p>

  <p><strong>Invoice:</strong> <?= $inv ?><br />
  <strong>Date:</strong> <?= $date ?><br />
  <strong>Bill to:</strong> <?= $buyer ?> &lt;<?= $email ?>&gt;<br />
  <strong>Payment ref:</strong> <?= $ref ?></p>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>ReconcileX Pro — <?= $plan ?> subscription</td>
        <td class="right"><?= number_format($breakdown['taxable'], 2) ?></td>
      </tr>
      <tr>
        <td>CGST (<?= number_format($breakdown['gstRate'] / 2, 2) ?>%)</td>
        <td class="right"><?= number_format($breakdown['cgst'], 2) ?></td>
      </tr>
      <tr>
        <td>SGST (<?= number_format($breakdown['gstRate'] / 2, 2) ?>%)</td>
        <td class="right"><?= number_format($breakdown['sgst'], 2) ?></td>
      </tr>
      <tr class="totals">
        <td><strong>Total</strong></td>
        <td class="right"><strong><?= number_format($breakdown['total'], 2) ?></strong></td>
      </tr>
    </tbody>
  </table>

  <p class="muted">This is a computer-generated invoice. Print to PDF from your browser.</p>
  <div class="actions">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>
</body>
</html>
