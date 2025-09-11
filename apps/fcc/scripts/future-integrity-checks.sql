-- Future Database Integrity Checks
-- These queries should be run once the database contains actual data

-- 1. FOREIGN KEY INTEGRITY CHECKS
-- ==============================================

-- Check for orphaned invoices (invoices without valid contacts)
SELECT 'Orphaned Invoices' as check_type, COUNT(*) as issue_count
FROM Invoice i
LEFT JOIN Contact c ON i.contactId = c.xeroContactId
WHERE c.xeroContactId IS NULL;

-- Check for orphaned bank transactions (transactions without valid bank accounts)  
SELECT 'Orphaned Bank Transactions' as check_type, COUNT(*) as issue_count
FROM BankTransaction bt
LEFT JOIN BankAccount ba ON bt.bankAccountId = ba.id
WHERE ba.id IS NULL;

-- Check for orphaned invoice line items
SELECT 'Orphaned Invoice Line Items' as check_type, COUNT(*) as issue_count
FROM InvoiceLineItem ili
LEFT JOIN Invoice i ON ili.invoiceId = i.id
WHERE i.id IS NULL;

-- Check for orphaned transaction line items
SELECT 'Orphaned Transaction Line Items' as check_type, COUNT(*) as issue_count
FROM LineItem li
LEFT JOIN BankTransaction bt ON li.transactionId = bt.id
WHERE bt.id IS NULL;

-- Check for invalid GL account references
SELECT 'Invalid GL Account References' as check_type, COUNT(DISTINCT ili.accountCode) as issue_count
FROM InvoiceLineItem ili
LEFT JOIN GLAccount gla ON ili.accountCode = gla.code
WHERE gla.code IS NULL AND ili.accountCode IS NOT NULL;

-- 2. DATA CONSISTENCY CHECKS
-- ==============================================

-- Check invoice totals vs line item sums (tolerance of 0.01)
SELECT 'Invoice Total Mismatches' as check_type, COUNT(*) as issue_count
FROM (
    SELECT 
        i.id,
        i.subTotal as invoice_subtotal,
        i.total as invoice_total,
        COALESCE(SUM(ili.lineAmount), 0) as calculated_subtotal,
        COALESCE(SUM(ili.lineAmount + ili.taxAmount), 0) as calculated_total
    FROM Invoice i
    LEFT JOIN InvoiceLineItem ili ON i.id = ili.invoiceId
    GROUP BY i.id, i.subTotal, i.total
    HAVING 
        ABS(i.subTotal - COALESCE(SUM(ili.lineAmount), 0)) > 0.01 OR
        ABS(i.total - COALESCE(SUM(ili.lineAmount + ili.taxAmount), 0)) > 0.01
);

-- Check bank transaction totals vs line item sums
SELECT 'Bank Transaction Total Mismatches' as check_type, COUNT(*) as issue_count
FROM (
    SELECT 
        bt.id,
        bt.total as transaction_total,
        COALESCE(SUM(li.lineAmount), 0) as calculated_total
    FROM BankTransaction bt
    LEFT JOIN LineItem li ON bt.id = li.transactionId
    GROUP BY bt.id, bt.total
    HAVING ABS(bt.total - COALESCE(SUM(li.lineAmount), 0)) > 0.01
);

-- Check invoice amount due calculations
SELECT 'Incorrect Amount Due Calculations' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE ABS(amountDue - (total - amountPaid - amountCredited)) > 0.01;

-- Check for status inconsistencies
SELECT 'Status Inconsistencies' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE 
    (status = 'PAID' AND amountDue > 0.01) OR
    (status = 'PAID' AND fullyPaidOnDate IS NULL) OR
    (status != 'PAID' AND amountDue <= 0.01 AND total > 0) OR
    (status = 'AUTHORISED' AND amountPaid >= total);

-- 3. MISSING DATA CHECKS
-- ==============================================

-- Check for invoices with missing required fields
SELECT 'Invoices Missing Required Fields' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE contactId IS NULL OR date IS NULL OR status IS NULL OR type IS NULL;

-- Check for invoices without line items (but with non-zero totals)
SELECT 'Invoices Without Line Items' as check_type, COUNT(*) as issue_count
FROM Invoice i
LEFT JOIN InvoiceLineItem ili ON i.id = ili.invoiceId
WHERE ili.id IS NULL AND i.total != 0;

-- Check for contacts without names
SELECT 'Contacts Without Names' as check_type, COUNT(*) as issue_count
FROM Contact
WHERE name IS NULL OR name = '';

-- Check for contacts without type designation
SELECT 'Contacts Without Type' as check_type, COUNT(*) as issue_count
FROM Contact
WHERE isSupplier = 0 AND isCustomer = 0;

-- 4. CONSTRAINT VIOLATION CHECKS
-- ==============================================

-- Check for duplicate Xero IDs
SELECT 'Duplicate Xero Invoice IDs' as check_type, COUNT(*) - COUNT(DISTINCT xeroInvoiceId) as issue_count
FROM Invoice;

-- Check for duplicate Xero Contact IDs
SELECT 'Duplicate Xero Contact IDs' as check_type, COUNT(*) - COUNT(DISTINCT xeroContactId) as issue_count
FROM Contact;

-- Check for duplicate Xero Transaction IDs
SELECT 'Duplicate Xero Transaction IDs' as check_type, COUNT(*) - COUNT(DISTINCT xeroTransactionId) as issue_count
FROM BankTransaction;

-- Check for invalid invoice types
SELECT 'Invalid Invoice Types' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE type NOT IN ('ACCREC', 'ACCPAY');

-- Check for invalid invoice statuses
SELECT 'Invalid Invoice Statuses' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE status NOT IN ('DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED');

-- Check for problematic negative values
SELECT 'Negative Sales Invoice Totals' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE total < 0 AND type = 'ACCREC';

-- Check for negative amounts paid
SELECT 'Negative Amounts Paid' as check_type, COUNT(*) as issue_count
FROM Invoice
WHERE amountPaid < 0;

-- 5. CROSS-TABLE CONSISTENCY CHECKS
-- ==============================================

-- Compare Invoice vs SyncedInvoice data
SELECT 'Invoice vs SyncedInvoice Mismatches' as check_type, COUNT(*) as issue_count
FROM Invoice i
INNER JOIN SyncedInvoice si ON i.xeroInvoiceId = si.id
WHERE 
    ABS(i.total - si.total) > 0.01 OR
    ABS(i.amountDue - si.amountDue) > 0.01 OR
    i.status != si.status;

-- Check for invoices missing from SyncedInvoice
SELECT 'Invoices Missing from SyncedInvoice' as check_type, COUNT(*) as issue_count
FROM Invoice i
LEFT JOIN SyncedInvoice si ON i.xeroInvoiceId = si.id
WHERE si.id IS NULL;

-- Check for sync records missing from main Invoice table
SELECT 'SyncedInvoices Missing from Invoice Table' as check_type, COUNT(*) as issue_count
FROM SyncedInvoice si
LEFT JOIN Invoice i ON si.id = i.xeroInvoiceId
WHERE i.xeroInvoiceId IS NULL;

-- 6. DATA QUALITY SUMMARY
-- ==============================================

-- Overall data quality metrics
SELECT 
    'DATA_QUALITY_SUMMARY' as summary_type,
    (SELECT COUNT(*) FROM Invoice) as total_invoices,
    (SELECT COUNT(*) FROM Contact) as total_contacts,
    (SELECT COUNT(*) FROM BankTransaction) as total_transactions,
    (SELECT COUNT(*) FROM InvoiceLineItem) as total_invoice_line_items,
    (SELECT COUNT(*) FROM LineItem) as total_transaction_line_items,
    (SELECT SUM(total) FROM Invoice WHERE type = 'ACCREC') as total_sales_amount,
    (SELECT SUM(total) FROM Invoice WHERE type = 'ACCPAY') as total_purchase_amount,
    (SELECT COUNT(*) FROM Invoice WHERE status = 'PAID') as paid_invoices,
    (SELECT COUNT(*) FROM Invoice WHERE status = 'AUTHORISED') as authorized_invoices,
    (SELECT COUNT(*) FROM BankTransaction WHERE isReconciled = 1) as reconciled_transactions;

-- Date range analysis
SELECT 
    'DATE_RANGES' as summary_type,
    (SELECT MIN(date) FROM Invoice) as earliest_invoice_date,
    (SELECT MAX(date) FROM Invoice) as latest_invoice_date,
    (SELECT MIN(date) FROM BankTransaction) as earliest_transaction_date,
    (SELECT MAX(date) FROM BankTransaction) as latest_transaction_date;

-- Account code usage summary
SELECT 
    'ACCOUNT_CODE_USAGE' as summary_type,
    accountCode,
    COUNT(*) as usage_count,
    SUM(lineAmount) as total_amount
FROM (
    SELECT accountCode, lineAmount FROM InvoiceLineItem
    UNION ALL
    SELECT accountCode, lineAmount FROM LineItem
) all_line_items
WHERE accountCode IS NOT NULL
GROUP BY accountCode
ORDER BY usage_count DESC
LIMIT 10;