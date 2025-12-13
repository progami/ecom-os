"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeroTrialBalanceParser = void 0;
var logger_1 = require("@/lib/logger");
var XeroTrialBalanceParser = /** @class */ (function () {
    function XeroTrialBalanceParser() {
    }
    /**
     * Parse Xero Trial Balance data
     * Handles both CSV format and pre-formatted object data
     */
    XeroTrialBalanceParser.parse = function (data) {
        // Check if data is pre-formatted objects
        if (this.isPreformattedData(data)) {
            return this.parsePreformattedData(data);
        }
        // Otherwise parse as CSV
        return this.parseCSVData(data);
    };
    /**
     * Check if data is pre-formatted objects rather than CSV arrays
     */
    XeroTrialBalanceParser.isPreformattedData = function (data) {
        if (!Array.isArray(data) || data.length === 0)
            return false;
        var firstItem = data[0];
        if (typeof firstItem !== 'object' || Array.isArray(firstItem))
            return false;
        // Check for typical trial balance object properties
        var hasAccountProperties = 'accountName' in firstItem || 'name' in firstItem || 'Account' in firstItem || 'accountCode' in firstItem;
        var hasBalanceProperties = 'debit' in firstItem || 'credit' in firstItem || 'balance' in firstItem || 'Debit' in firstItem || 'Credit' in firstItem;
        return hasAccountProperties || hasBalanceProperties;
    };
    /**
     * Parse pre-formatted object data
     */
    XeroTrialBalanceParser.parsePreformattedData = function (data) {
        var result = {
            accounts: [],
            totals: {
                totalDebits: 0,
                totalCredits: 0,
                balanceDifference: 0,
                isBalanced: false
            }
        };
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var item = data_1[_i];
            var accountName = (item.accountName || item.name || item.Account || '').toString().trim();
            var accountCode = (item.accountCode || item.code || item.Code || item.AccountCode || '').toString().trim();
            var accountType = (item.accountType || item.type || item.Type || item.AccountType || '').toString().trim();
            var debit = this.parseAmount((item.debit || item.Debit || '0').toString());
            var credit = this.parseAmount((item.credit || item.Credit || '0').toString());
            var balance = this.parseAmount((item.balance || item.Balance || '0').toString());
            if (!accountName)
                continue;
            // Calculate balance if not provided
            if (balance === 0 && (debit > 0 || credit > 0)) {
                balance = debit - credit;
            }
            var account = {
                code: accountCode || "ACC-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9)),
                name: accountName,
                accountType: accountType,
                debit: debit,
                credit: credit,
                balance: balance,
                ytdMovement: this.parseAmount((item.ytdMovement || item.YTDMovement || '0').toString())
            };
            result.accounts.push(account);
            result.totals.totalDebits += debit;
            result.totals.totalCredits += credit;
        }
        // Calculate balance difference
        result.totals.balanceDifference = Math.abs(result.totals.totalDebits - result.totals.totalCredits);
        result.totals.isBalanced = result.totals.balanceDifference < 0.01; // Allow for small rounding differences
        logger_1.structuredLogger.info('[XeroTrialBalanceParser] Parsed pre-formatted trial balance data', {
            accountCount: result.accounts.length,
            totalDebits: result.totals.totalDebits,
            totalCredits: result.totals.totalCredits,
            isBalanced: result.totals.isBalanced
        });
        return result;
    };
    /**
     * Parse Xero Trial Balance CSV format
     * Handles various column layouts and account structures
     */
    XeroTrialBalanceParser.parseCSVData = function (csvData) {
        var result = {
            accounts: [],
            totals: {
                totalDebits: 0,
                totalCredits: 0,
                balanceDifference: 0,
                isBalanced: false
            }
        };
        // Find header row
        var headerRowIndex = -1;
        var headers = [];
        for (var i = 0; i < Math.min(10, csvData.length); i++) {
            var row = csvData[i];
            if (row && row.length > 0) {
                // Check if this row contains header-like values
                var hasAccountHeader = row.some(function (cell) {
                    return cell && (cell.toLowerCase().includes('account') ||
                        cell.toLowerCase().includes('description'));
                });
                var hasAmountHeader = row.some(function (cell) {
                    return cell && (cell.toLowerCase().includes('debit') ||
                        cell.toLowerCase().includes('credit') ||
                        cell.toLowerCase().includes('balance'));
                });
                if (hasAccountHeader && hasAmountHeader) {
                    headerRowIndex = i;
                    headers = row.map(function (h) { return (h || '').toLowerCase().trim(); });
                    break;
                }
            }
        }
        if (headerRowIndex === -1) {
            logger_1.structuredLogger.warn('[XeroTrialBalanceParser] Could not find header row');
            return result;
        }
        // Identify column indices
        var columnMap = this.identifyColumns(headers);
        // Parse data rows
        for (var i = headerRowIndex + 1; i < csvData.length; i++) {
            var row = csvData[i];
            // Skip empty rows
            if (!row || row.length === 0 || row.every(function (cell) { return !cell || cell.trim() === ''; })) {
                continue;
            }
            // Skip total rows
            var firstCell = (row[0] || '').trim().toLowerCase();
            if (firstCell.includes('total') || firstCell.includes('net movement')) {
                continue;
            }
            var account = this.parseAccountRow(row, columnMap);
            if (account && (account.debit > 0 || account.credit > 0 || account.balance !== 0)) {
                result.accounts.push(account);
                result.totals.totalDebits += account.debit;
                result.totals.totalCredits += account.credit;
            }
        }
        // Calculate balance difference
        result.totals.balanceDifference = Math.abs(result.totals.totalDebits - result.totals.totalCredits);
        result.totals.isBalanced = result.totals.balanceDifference < 0.01; // Allow for small rounding differences
        logger_1.structuredLogger.info('[XeroTrialBalanceParser] Parsed trial balance', {
            accountCount: result.accounts.length,
            totalDebits: result.totals.totalDebits,
            totalCredits: result.totals.totalCredits,
            isBalanced: result.totals.isBalanced
        });
        return result;
    };
    XeroTrialBalanceParser.identifyColumns = function (headers) {
        var columnMap = {
            code: -1,
            name: -1,
            type: -1,
            debit: -1,
            credit: -1,
            balance: -1,
            ytdMovement: -1
        };
        headers.forEach(function (header, index) {
            if (header.includes('code') || header.includes('number')) {
                columnMap.code = index;
            }
            else if (header.includes('name') || header.includes('description') || header === 'account') {
                columnMap.name = index;
            }
            else if (header.includes('type') || header.includes('category')) {
                columnMap.type = index;
            }
            else if (header.includes('debit') || header === 'dr') {
                columnMap.debit = index;
            }
            else if (header.includes('credit') || header === 'cr') {
                columnMap.credit = index;
            }
            else if (header.includes('ytd') || header.includes('movement')) {
                columnMap.ytdMovement = index;
            }
            else if (header.includes('balance') || header.includes('net')) {
                columnMap.balance = index;
            }
        });
        // If no separate debit/credit columns, the balance column might contain both
        if (columnMap.debit === -1 && columnMap.credit === -1 && columnMap.balance !== -1) {
            // We'll handle this in parseAccountRow
        }
        return columnMap;
    };
    XeroTrialBalanceParser.parseAccountRow = function (row, columnMap) {
        // Extract account code and name
        var code = '';
        var name = '';
        if (columnMap.code !== -1 && row[columnMap.code]) {
            code = row[columnMap.code].trim();
        }
        if (columnMap.name !== -1 && row[columnMap.name]) {
            name = row[columnMap.name].trim();
        }
        else if (!code && row[0]) {
            // If no name column identified, use first non-empty column
            name = row[0].trim();
        }
        // If still no name, try to find it
        if (!name) {
            for (var i = 0; i < row.length; i++) {
                var cell = row[i];
                if (cell && cell.trim() && !this.isNumeric(cell)) {
                    name = cell.trim();
                    break;
                }
            }
        }
        if (!name)
            return null;
        // Extract account type
        var accountType = '';
        if (columnMap.type !== -1 && row[columnMap.type]) {
            accountType = row[columnMap.type].trim();
        }
        // Extract amounts
        var debit = 0;
        var credit = 0;
        var balance = 0;
        if (columnMap.debit !== -1 && row[columnMap.debit]) {
            debit = this.parseAmount(row[columnMap.debit]);
        }
        if (columnMap.credit !== -1 && row[columnMap.credit]) {
            credit = this.parseAmount(row[columnMap.credit]);
        }
        if (columnMap.balance !== -1 && row[columnMap.balance]) {
            balance = this.parseAmount(row[columnMap.balance]);
            // If no separate debit/credit columns, use balance
            if (columnMap.debit === -1 && columnMap.credit === -1) {
                if (balance > 0) {
                    debit = balance;
                }
                else if (balance < 0) {
                    credit = Math.abs(balance);
                }
            }
        }
        // Extract YTD movement if available
        var ytdMovement = 0;
        if (columnMap.ytdMovement !== -1 && row[columnMap.ytdMovement]) {
            ytdMovement = this.parseAmount(row[columnMap.ytdMovement]);
        }
        // Calculate balance if not provided
        if (balance === 0 && (debit > 0 || credit > 0)) {
            balance = debit - credit;
        }
        return {
            code: code || "ACC-".concat(Date.now()),
            name: name,
            accountType: accountType,
            debit: debit,
            credit: credit,
            balance: balance,
            ytdMovement: ytdMovement
        };
    };
    XeroTrialBalanceParser.isNumeric = function (value) {
        if (!value)
            return false;
        // Remove currency symbols, commas, spaces
        var cleaned = value.replace(/[£$€¥,\s]/g, '').trim();
        // Check for parentheses (negative numbers) or regular numbers
        return /^\(?\d+\.?\d*\)?$/.test(cleaned) || /^-?\d+\.?\d*$/.test(cleaned);
    };
    XeroTrialBalanceParser.parseAmount = function (value) {
        if (!value)
            return 0;
        // Remove currency symbols, commas, spaces
        var cleaned = value.replace(/[£$€¥,\s]/g, '').trim();
        // Handle negative values in parentheses
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
            cleaned = '-' + cleaned.slice(1, -1);
        }
        var parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    };
    /**
     * Convert parsed structure to database format
     */
    XeroTrialBalanceParser.toImportFormat = function (parsed, reportDate) {
        // Group accounts by type
        var accountsByType = {};
        parsed.accounts.forEach(function (account) {
            var type = account.accountType || 'Unknown';
            if (!accountsByType[type]) {
                accountsByType[type] = [];
            }
            accountsByType[type].push({
                accountId: account.code,
                accountCode: account.code,
                accountName: account.name,
                accountType: type,
                debit: account.debit,
                credit: account.credit,
                balance: account.balance,
                isActive: true
            });
        });
        // Create summary by account type
        var accountTypes = Object.entries(accountsByType).map(function (_a) {
            var type = _a[0], accounts = _a[1];
            var typeDebits = accounts.reduce(function (sum, acc) { return sum + acc.debit; }, 0);
            var typeCredits = accounts.reduce(function (sum, acc) { return sum + acc.credit; }, 0);
            return {
                type: type,
                debits: typeDebits,
                credits: typeCredits,
                count: accounts.length
            };
        });
        // Calculate largest debit and credit
        var largestDebit = 0;
        var largestCredit = 0;
        parsed.accounts.forEach(function (account) {
            if (account.debit > largestDebit)
                largestDebit = account.debit;
            if (account.credit > largestCredit)
                largestCredit = account.credit;
        });
        return {
            accounts: Object.values(accountsByType).flat(),
            totals: parsed.totals,
            summary: {
                totalAccounts: parsed.accounts.length,
                activeAccounts: parsed.accounts.length,
                inactiveAccounts: 0,
                largestDebit: largestDebit,
                largestCredit: largestCredit
            },
            accountTypes: accountTypes,
            reportDate: reportDate.toISOString(),
            source: 'import',
            fetchedAt: new Date().toISOString()
        };
    };
    return XeroTrialBalanceParser;
}());
exports.XeroTrialBalanceParser = XeroTrialBalanceParser;
