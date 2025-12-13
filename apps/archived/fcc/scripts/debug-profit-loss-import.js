// Script to help debug Profit & Loss import issues

console.log(`
=== Profit & Loss Import Debugging Guide ===

The issue: Import Details modal shows "4 records" but no actual data (all values are 0).

Root cause: The imported data only contains summary totals, not detailed line items.

Possible reasons:
1. The CSV file format doesn't match Xero's standard Profit & Loss format
2. The file might be a summary report instead of a detailed report
3. The file might have been pre-processed before import

To fix this issue:

1. Check the original CSV file format:
   - It should have a structure like:
     Account,Amount
     Income
     Sales,10000.00
     Other Revenue,500.00
     Total Income,10500.00
     ... etc

2. Re-export from Xero with these settings:
   - Report: Profit and Loss
   - Period: Select your desired period
   - Compare with: None (single period)
   - Show Accounts: All
   - Export as: CSV

3. The parser expects:
   - Header rows with report title and period
   - Section headers (Income, Expenses, etc.)
   - Account lines with amounts
   - Total lines

4. Import the new file via the Import Data button

Debug info from database:
- Raw data stored: {"totalRevenue":0,"totalExpenses":0,"netProfit":0,...}
- This indicates the parser received data in an unexpected format
- The "4 records" likely means 4 CSV rows were parsed but not in the expected structure
`);

// Add example of expected vs actual format
console.log(`
Expected CSV format example:
-------------------------
Profit & Loss
Your Company Name
1 January 2025 to 31 January 2025

Account,Jan-25

Income
Sales,15000.00
Service Revenue,5000.00
Total Income,20000.00

Expenses
Rent,2000.00
Salaries,8000.00
Total Expenses,10000.00

Net Profit,10000.00

What might have been imported instead:
------------------------------------
Total Revenue,0
Total Expenses,0
Net Profit,0
Gross Profit,0

(This would explain 4 records with all zero values)
`);