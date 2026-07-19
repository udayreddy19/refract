const XLSX = require('xlsx');

// Create workbook
const wb = XLSX.utils.book_new();

// Summary sheet
const summaryData = [
  ["Settled — Reconciliation Report", ""],
  ["Generated", "2024-01-11 14:32:00"],
  ["", ""],
  ["SUMMARY", ""],
  ["Total Orders", 12],
  ["Matched", 10],
  ["Exceptions", 2],
  ["Auto-match Rate", "83.3%"],
  ["Total Gross (₹)", "93596.00"],
  ["Total Fees (₹)", "1870.92"],
  ["Total Net (₹)", "90947.08"],
  ["Amount at Risk (₹)", "8750.00"],
  ["", ""],
  ["FEE AUDIT", ""],
  ["Charged Fees (₹)", "1870.92"],
  ["Expected Fees (₹)", "1871.92"],
  ["Overcharge (₹)", "0.00"],
];
const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
wsSummary['!cols'] = [{wch: 30}, {wch: 20}];
XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

// Exceptions sheet
const exData = [
  ["Order/Ref", "Type", "Severity", "Amount (₹)", "Description"],
  ["order_NfB3PO6qUtAv1c", "Settled, No Order", "HIGH", "5500.00", "Payment settled but no matching Shopify order found"],
  ["#1008", "Paid, Not Settled", "HIGH", "3250.00", "Order paid but settlement not found in Razorpay"],
];
const wsEx = XLSX.utils.aoa_to_sheet(exData);
wsEx['!cols'] = [{wch: 25}, {wch: 25}, {wch: 12}, {wch: 15}, {wch: 50}];
XLSX.utils.book_append_sheet(wb, wsEx, "Exceptions");

// Matched sheet
const matchData = [
  ["Order No", "Payment ID", "Match Type", "Gross (₹)", "Fee+Tax (₹)", "Net (₹)", "Settled At"],
  ["#1001", "pay_NbX9KL3mQpWr7y", "Exact ID", "4999.00", "117.97", "4881.03", "2024-01-07"],
  ["#1002", "pay_NcY0ML4nRqXs8z", "Exact ID", "12500.00", "295.00", "12205.00", "2024-01-07"],
  ["#1003", "pay_NdZ1NM5oSrYt9a", "Exact ID", "2199.00", "51.90", "2147.10", "2024-01-07"],
  ["#1004", "pay_NeA2ON6pTsZu0b", "Exact ID", "8750.00", "206.50", "8543.50", "2024-01-07"],
  ["#1005", "pay_NfB3PO7qUtAv1c", "Exact ID", "3499.00", "82.57", "3416.43", "2024-01-08"],
  ["#1006", "pay_NgC4QP8rVuBw2d", "Exact ID", "6200.00", "146.32", "6053.68", "2024-01-08"],
  ["#1007", "pay_NhD5RQ9sWvCx3e", "Exact ID", "9999.00", "235.97", "9763.03", "2024-01-08"],
  ["#1009", "pay_NjF7TS1uYxEz5g", "Exact ID", "1899.00", "44.81", "1854.19", "2024-01-09"],
  ["#1010", "pay_NkG8UT2vZyFa6h", "Exact ID", "15000.00", "442.50", "14557.50", "2024-01-09"],
  ["#1011", "pay_NlH9VU3wAzGb7i", "Exact ID", "4250.00", "100.30", "4149.70", "2024-01-09"],
];
const wsMatch = XLSX.utils.aoa_to_sheet(matchData);
wsMatch['!cols'] = [{wch: 12}, {wch: 20}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 12}, {wch: 15}];
XLSX.utils.book_append_sheet(wb, wsMatch, "Matched Orders");

XLSX.writeFile(wb, 'settled_example_output.xlsx');
console.log('✓ Example Excel file created');
