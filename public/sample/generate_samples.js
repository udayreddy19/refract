const fs = require('fs');
const path = require('path');

const sampleDir = __dirname;

const woocommerce = [
  ["Order Number", "Transaction ID", "Order Total", "Status", "Date"],
  ["WC_1001", "ch_stripe_1001", "2499.00", "completed", "2026-07-15 10:00:00"],
  ["WC_1002", "ch_stripe_1002", "3499.00", "completed", "2026-07-15 10:30:00"],
  ["WC_1003", "ch_stripe_1003", "1250.00", "completed", "2026-07-15 11:15:00"],
  ["WC_1004", "", "899.00", "pending", "2026-07-15 12:00:00"], // Overdue / unpaid exception
  ["WC_1005", "ch_stripe_1005", "4500.00", "completed", "2026-07-15 12:30:00"] // Amount mismatch
];

const stripe = [
  ["id", "amount", "fee", "net", "created", "description", "payout_id", "type"],
  ["ch_stripe_1001", "2499.00", "50.00", "2449.00", "2026-07-15 10:05:00", "WC_1001", "po_stripe_1", "charge"],
  ["ch_stripe_1002", "3499.00", "70.00", "3429.00", "2026-07-15 10:35:00", "WC_1002", "po_stripe_1", "charge"],
  ["ch_stripe_1003", "1250.00", "25.00", "1225.00", "2026-07-15 11:20:00", "WC_1003", "po_stripe_1", "charge"],
  ["ch_stripe_1005", "4500.00", "90.00", "4110.00", "2026-07-15 12:35:00", "WC_1005", "po_stripe_1", "charge"] // 4500 gross - 90 fee = 4410 net, but net is 4110 (mismatch!)
];

const cashfree = [
  ["Transaction ID", "Order ID", "Amount", "Service Charge", "Service Tax", "Date", "Settlement Date", "UTR"],
  ["cf_101", "1006", "1500.00", "30.00", "5.40", "2026-07-15 13:00:00", "2026-07-16 14:00:00", "CFUTR991122"],
  ["cf_102", "1007", "2800.00", "56.00", "10.08", "2026-07-15 13:30:00", "2026-07-16 14:00:00", "CFUTR991122"]
];

const payu = [
  ["mihpayid", "txnid", "amount", "service_fee", "service_tax", "addedon", "settled_date", "UTR"],
  ["pu_201", "1008", "999.00", "19.98", "3.60", "2026-07-15 14:00:00", "2026-07-16 15:00:00", "PUUTR445566"],
  ["pu_202", "1009", "1850.00", "37.00", "6.66", "2026-07-15 14:30:00", "2026-07-16 15:00:00", "PUUTR445566"]
];

const shiprocket = [
  ["AWB", "Order ID", "COD Amount", "Shipping Charges", "Tax", "Delivery Date", "Remittance Date", "UTR"],
  ["SR99887766", "1010", "2999.00", "120.00", "21.60", "2026-07-15 15:00:00", "2026-07-17 12:00:00", "SRUTR889900"],
  ["SR99887767", "1011", "4200.00", "150.00", "27.00", "2026-07-15 15:30:00", "2026-07-17 12:00:00", "SRUTR889900"]
];

const amazon = [
  ["Transaction Type", "Order ID", "Amount", "Date Time", "Commission", "Tax", "Settlement ID"],
  ["Order", "403-1111111-1111111", "1299.00", "2026-07-15 16:00:00", "130.00", "23.40", "AMZN_PO_99"],
  ["Order", "403-2222222-2222222", "1899.00", "2026-07-15 16:30:00", "190.00", "34.20", "AMZN_PO_99"],
  ["Refund", "403-3333333-3333333", "-999.00", "2026-07-15 17:00:00", "-100.00", "-18.00", "AMZN_PO_99"]
];

const flipkart = [
  ["Order ID", "Sale Amount", "Commission", "Shipping Charge", "Tax", "Net Settlement Amount", "Settlement Date", "UTR"],
  ["OD1234567890", "1499.00", "150.00", "65.00", "38.70", "1245.30", "2026-07-15 17:30:00", "FKUTR556677"],
  ["OD1234567891", "2499.00", "250.00", "75.00", "58.50", "2115.50", "2026-07-15 18:00:00", "FKUTR556677"]
];

const writeCsv = (name, rows) => {
  const content = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  fs.writeFileSync(path.join(sampleDir, `${name}_sample.csv`), content);
};

writeCsv('woocommerce', woocommerce);
writeCsv('stripe', stripe);
writeCsv('cashfree', cashfree);
writeCsv('payu', payu);
writeCsv('shiprocket', shiprocket);
writeCsv('amazon', amazon);
writeCsv('flipkart', flipkart);

console.log("All sample files generated successfully!");
