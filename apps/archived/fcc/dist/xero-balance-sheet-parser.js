"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeroBalanceSheetParser = void 0;
const logger_1 = require("@/lib/logger");
class XeroBalanceSheetParser {
    /**
     * Parse Xero Balance Sheet data
     * Handles both raw CSV format (string[][]) and pre-formatted object data
     * @param data - The data to parse
     * @param targetDate - Optional target date to find the correct column (e.g., '30 Jun 2025')
     */
    static parse(data, targetDate) {
        // Check if data is pre-formatted objects
        if (this.isPreformattedData(data)) {
            return this.parsePreformattedData(data);
        }
        // Otherwise, parse as raw CSV data
        return this.parseCSVData(data, targetDate);
    }
    /**
     * Check if the data is pre-formatted objects rather than raw CSV
     */
    static isPreformattedData(data) {
        if (!data || data.length === 0)
            return false;
        // Check if first row is an object with expected properties
        const firstRow = data[0];
        return typeof firstRow === 'object' && !Array.isArray(firstRow) &&
            (firstRow.hasOwnProperty('Account') ||
                firstRow.hasOwnProperty('AccountName') ||
                firstRow.hasOwnProperty('accountName') ||
                firstRow.hasOwnProperty('name'));
    }
    /**
     * Parse pre-formatted object data
     */
    static parsePreformattedData(data) {
        const result = {
            assets: {
                fixed: [],
                current: [],
                totalFixed: 0,
                totalCurrent: 0,
                totalAssets: 0
            },
            liabilities: {
                current: [],
                nonCurrent: [],
                totalCurrent: 0,
                totalNonCurrent: 0,
                totalLiabilities: 0
            },
            equity: {
                accounts: [],
                totalEquity: 0
            },
            netAssets: 0
        };
        // Process each account
        data.forEach(row => {
            const accountName = row.Account || row.AccountName || row.accountName || row.name || '';
            const accountCode = row.AccountCode || row.accountCode || row.code || '';
            const accountType = row.AccountType || row.accountType || row.type || '';
            const balance = this.parseAmount(String(row.Balance || row.balance || row.Amount || row.amount || 0));
            if (!accountName || balance === 0)
                return;
            const account = {
                name: accountName,
                code: accountCode,
                balance: balance
            };
            // Categorize based on account type or name patterns
            const lowerType = accountType.toLowerCase();
            const lowerName = accountName.toLowerCase();
            if (lowerType.includes('fixed') || lowerType.includes('noncurrent asset') ||
                lowerName.includes('property') || lowerName.includes('equipment')) {
                result.assets.fixed.push(account);
                result.assets.totalFixed += balance;
            }
            else if (lowerType.includes('current asset') || lowerType.includes('bank') ||
                lowerType.includes('cash') || lowerName.includes('receivable')) {
                result.assets.current.push(account);
                result.assets.totalCurrent += balance;
            }
            else if (lowerType.includes('current liability') || lowerName.includes('payable') ||
                lowerName.includes('creditor')) {
                result.liabilities.current.push(account);
                result.liabilities.totalCurrent += balance;
            }
            else if (lowerType.includes('noncurrent liability') || lowerType.includes('long term')) {
                result.liabilities.nonCurrent.push(account);
                result.liabilities.totalNonCurrent += balance;
            }
            else if (lowerType.includes('equity') || lowerType.includes('capital')) {
                result.equity.accounts.push(account);
                result.equity.totalEquity += balance;
            }
        });
        // Calculate totals
        result.assets.totalAssets = result.assets.totalFixed + result.assets.totalCurrent;
        result.liabilities.totalLiabilities = result.liabilities.totalCurrent + result.liabilities.totalNonCurrent;
        result.equity.totalEquity = result.equity.totalEquity || (result.assets.totalAssets - result.liabilities.totalLiabilities);
        result.netAssets = result.assets.totalAssets - result.liabilities.totalLiabilities;
        logger_1.structuredLogger.info('[XeroBalanceSheetParser] Parsed pre-formatted data', {
            totalAssets: result.assets.totalAssets,
            totalLiabilities: result.liabilities.totalLiabilities,
            netAssets: result.netAssets,
            accountCounts: {
                fixedAssets: result.assets.fixed.length,
                currentAssets: result.assets.current.length,
                currentLiabilities: result.liabilities.current.length,
                equity: result.equity.accounts.length
            }
        });
        return result;
    }
    /**
     * Parse raw CSV data (original implementation)
     */
    static parseCSVData(csvData, targetDate) {
        const result = {
            assets: {
                fixed: [],
                current: [],
                totalFixed: 0,
                totalCurrent: 0,
                totalAssets: 0
            },
            liabilities: {
                current: [],
                nonCurrent: [],
                totalCurrent: 0,
                totalNonCurrent: 0,
                totalLiabilities: 0
            },
            equity: {
                accounts: [],
                totalEquity: 0
            },
            netAssets: 0
        };
        let currentSection = '';
        let currentSubSection = '';
        let skipRows = 0;
        let dateColumnIndex = null;
        // Find the date column index if targetDate is provided
        if (targetDate && csvData.length > 0) {
            dateColumnIndex = this.findDateColumnIndex(csvData, targetDate);
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Date column detection', {
                targetDate,
                dateColumnIndex,
                headers: csvData[0]
            });
        }
        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
                continue;
            }
            // Skip header rows
            if (skipRows > 0) {
                skipRows--;
                continue;
            }
            const firstCell = (row[0] || '').trim();
            const lastCell = row[row.length - 1] || '';
            // Identify main sections
            if (firstCell === 'Fixed Assets' || firstCell === 'Non-Current Assets') {
                currentSection = 'fixed-assets';
                currentSubSection = '';
                continue;
            }
            else if (firstCell === 'Current Assets') {
                currentSection = 'current-assets';
                currentSubSection = '';
                continue;
            }
            else if (firstCell.includes('Creditors') || firstCell === 'Current Liabilities') {
                currentSection = 'current-liabilities';
                currentSubSection = '';
                continue;
            }
            else if (firstCell === 'Non-Current Liabilities' || firstCell === 'Long Term Liabilities') {
                currentSection = 'non-current-liabilities';
                currentSubSection = '';
                continue;
            }
            else if (firstCell === 'Capital and Reserves' || firstCell === 'Equity') {
                currentSection = 'equity';
                currentSubSection = '';
                continue;
            }
            // Handle subsections
            if (firstCell && !this.isNumeric(lastCell) && !firstCell.startsWith('Total') && !firstCell.startsWith('Net')) {
                currentSubSection = firstCell;
                continue;
            }
            // Parse account lines
            const account = this.parseAccountLine(row, dateColumnIndex);
            if (!account)
                continue;
            // Assign to appropriate section
            if (firstCell.startsWith('Total Fixed Assets')) {
                result.assets.totalFixed = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total fixed assets', {
                    value: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell.startsWith('Total Current Assets')) {
                result.assets.totalCurrent = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total current assets', {
                    value: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell.startsWith('Total Assets')) {
                result.assets.totalAssets = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total assets', {
                    value: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell.includes('Total Creditors') || firstCell.startsWith('Total Current Liabilities')) {
                result.liabilities.totalCurrent = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total current liabilities', {
                    originalValue: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell.startsWith('Total Non-Current Liabilities')) {
                result.liabilities.totalNonCurrent = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total non-current liabilities', {
                    originalValue: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell.startsWith('Total Liabilities')) {
                result.liabilities.totalLiabilities = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total liabilities', {
                    originalValue: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell.startsWith('Total Capital and Reserves') || firstCell.startsWith('Total Equity')) {
                result.equity.totalEquity = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found total equity', {
                    value: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else if (firstCell === 'Net Assets' || firstCell === 'Net Worth') {
                result.netAssets = account.balance;
                logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found net assets', {
                    value: account.balance,
                    willRecalculate: account.balance === 0
                });
            }
            else {
                // Regular account line
                account.parentCategory = currentSubSection;
                switch (currentSection) {
                    case 'fixed-assets':
                        result.assets.fixed.push(account);
                        break;
                    case 'current-assets':
                        result.assets.current.push(account);
                        break;
                    case 'current-liabilities':
                        // Store liabilities with their original values (negative)
                        result.liabilities.current.push(account);
                        break;
                    case 'non-current-liabilities':
                        // Store liabilities with their original values (negative)
                        result.liabilities.nonCurrent.push(account);
                        break;
                    case 'equity':
                        result.equity.accounts.push(account);
                        break;
                }
            }
        }
        // Calculate totals from individual accounts if totals are 0 or missing
        // Fixed Assets Total
        if (result.assets.totalFixed === 0 && result.assets.fixed.length > 0) {
            result.assets.totalFixed = result.assets.fixed
                .filter(a => !a.isSubTotal)
                .reduce((sum, account) => sum + account.balance, 0);
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated fixed assets total from accounts', {
                calculatedTotal: result.assets.totalFixed,
                accountCount: result.assets.fixed.length
            });
        }
        // Current Assets Total
        if (result.assets.totalCurrent === 0 && result.assets.current.length > 0) {
            result.assets.totalCurrent = result.assets.current
                .filter(a => !a.isSubTotal)
                .reduce((sum, account) => sum + account.balance, 0);
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated current assets total from accounts', {
                calculatedTotal: result.assets.totalCurrent,
                accountCount: result.assets.current.length
            });
        }
        // Current Liabilities Total
        if (result.liabilities.totalCurrent === 0 && result.liabilities.current.length > 0) {
            result.liabilities.totalCurrent = result.liabilities.current
                .filter(a => !a.isSubTotal)
                .reduce((sum, account) => sum + account.balance, 0);
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated current liabilities total from accounts', {
                calculatedTotal: result.liabilities.totalCurrent,
                accountCount: result.liabilities.current.length,
                accounts: result.liabilities.current.map(a => ({ name: a.name, balance: a.balance }))
            });
        }
        // Non-Current Liabilities Total
        if (result.liabilities.totalNonCurrent === 0 && result.liabilities.nonCurrent.length > 0) {
            result.liabilities.totalNonCurrent = result.liabilities.nonCurrent
                .filter(a => !a.isSubTotal)
                .reduce((sum, account) => sum + account.balance, 0);
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated non-current liabilities total from accounts', {
                calculatedTotal: result.liabilities.totalNonCurrent,
                accountCount: result.liabilities.nonCurrent.length,
                accounts: result.liabilities.nonCurrent.map(a => ({ name: a.name, balance: a.balance }))
            });
        }
        // Equity Total
        if (result.equity.totalEquity === 0 && result.equity.accounts.length > 0) {
            result.equity.totalEquity = result.equity.accounts
                .filter(a => !a.isSubTotal)
                .reduce((sum, account) => sum + account.balance, 0);
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated equity total from accounts', {
                calculatedTotal: result.equity.totalEquity,
                accountCount: result.equity.accounts.length
            });
        }
        // Calculate higher-level totals
        if (result.assets.totalAssets === 0) {
            result.assets.totalAssets = result.assets.totalFixed + result.assets.totalCurrent;
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated total assets', {
                totalAssets: result.assets.totalAssets,
                fixed: result.assets.totalFixed,
                current: result.assets.totalCurrent
            });
        }
        if (result.liabilities.totalLiabilities === 0) {
            result.liabilities.totalLiabilities = result.liabilities.totalCurrent + result.liabilities.totalNonCurrent;
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated total liabilities', {
                totalLiabilities: result.liabilities.totalLiabilities,
                current: result.liabilities.totalCurrent,
                nonCurrent: result.liabilities.totalNonCurrent
            });
        }
        if (result.netAssets === 0) {
            result.netAssets = result.assets.totalAssets - result.liabilities.totalLiabilities;
            logger_1.structuredLogger.info('[XeroBalanceSheetParser] Calculated net assets', {
                netAssets: result.netAssets,
                totalAssets: result.assets.totalAssets,
                totalLiabilities: result.liabilities.totalLiabilities
            });
        }
        logger_1.structuredLogger.info('[XeroBalanceSheetParser] Parsed CSV balance sheet', {
            totalAssets: result.assets.totalAssets,
            totalLiabilities: result.liabilities.totalLiabilities,
            netAssets: result.netAssets,
            accountCounts: {
                fixedAssets: result.assets.fixed.length,
                currentAssets: result.assets.current.length,
                currentLiabilities: result.liabilities.current.length,
                equity: result.equity.accounts.length
            }
        });
        return result;
    }
    static parseAccountLine(row, dateColumnIndex = null) {
        // Find the account name (first non-empty cell)
        let accountName = '';
        let nameIndex = 0;
        for (let i = 0; i < row.length; i++) {
            if (row[i] && row[i].trim()) {
                accountName = row[i].trim();
                nameIndex = i;
                break;
            }
        }
        if (!accountName)
            return null;
        let balance = 0;
        if (dateColumnIndex !== null && dateColumnIndex < row.length) {
            // Use the specific date column
            const cellValue = row[dateColumnIndex];
            if (cellValue) {
                // Always parse the value, even if it looks like 0.00
                balance = this.parseAmount(cellValue);
                logger_1.structuredLogger.debug('[XeroBalanceSheetParser] Parsing account with date column', {
                    accountName,
                    dateColumnIndex,
                    cellValue,
                    parsedBalance: balance
                });
            }
        }
        else {
            // Fall back to finding the last numeric cell
            for (let i = row.length - 1; i > nameIndex; i--) {
                const cellValue = row[i];
                if (cellValue && this.isNumeric(cellValue)) {
                    balance = this.parseAmount(cellValue);
                    break;
                }
            }
        }
        // Don't skip total lines even if they show 0.00 - we'll calculate them later
        // For regular accounts, only skip if truly no value
        if (!accountName.toLowerCase().includes('total') && balance === 0 && dateColumnIndex === null) {
            return null;
        }
        return {
            name: accountName,
            balance,
            isSubTotal: accountName.toLowerCase().includes('total')
        };
    }
    /**
     * Find the column index for a specific date
     * @param csvData - The CSV data array
     * @param targetDate - The date to search for (e.g., '30 Jun 2025')
     * @returns The column index if found, null otherwise
     */
    static findDateColumnIndex(csvData, targetDate) {
        if (!csvData || csvData.length === 0)
            return null;
        // Look for the date in the first several rows (headers might be on row 3 or 4)
        for (let rowIndex = 0; rowIndex < Math.min(10, csvData.length); rowIndex++) {
            const row = csvData[rowIndex];
            if (!row)
                continue;
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cell = row[colIndex];
                if (!cell)
                    continue;
                // Convert cell to string and clean it
                const cellStr = String(cell);
                const cleanedCell = cellStr.trim().replace(/\s+/g, ' ');
                // Check for exact match or similar patterns
                if (cleanedCell === targetDate ||
                    cleanedCell.includes(targetDate) ||
                    this.normalizeDateString(cleanedCell) === this.normalizeDateString(targetDate)) {
                    logger_1.structuredLogger.info('[XeroBalanceSheetParser] Found target date column', {
                        targetDate,
                        foundCell: cleanedCell,
                        rowIndex,
                        colIndex
                    });
                    return colIndex;
                }
            }
        }
        logger_1.structuredLogger.warn('[XeroBalanceSheetParser] Could not find target date column', {
            targetDate,
            searchedRows: Math.min(10, csvData.length),
            firstFewRows: csvData.slice(0, 5).map(row => row.slice(0, 5))
        });
        return null;
    }
    /**
     * Normalize date strings for comparison
     * Converts various date formats to a standard format
     */
    static normalizeDateString(dateStr) {
        if (!dateStr)
            return '';
        // Convert to string first
        const strValue = String(dateStr);
        // Remove extra spaces and convert to lowercase for comparison
        const normalized = strValue.trim().toLowerCase().replace(/\s+/g, ' ');
        // Handle common date format variations
        return normalized
            .replace(/(\d+)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, '$1 $2')
            .replace(/(january|february|march|april|may|june|july|august|september|october|november|december)/i, (match) => {
            const monthMap = {
                'january': 'jan', 'february': 'feb', 'march': 'mar', 'april': 'apr',
                'may': 'may', 'june': 'jun', 'july': 'jul', 'august': 'aug',
                'september': 'sep', 'october': 'oct', 'november': 'nov', 'december': 'dec'
            };
            return monthMap[match.toLowerCase()] || match;
        });
    }
    static isNumeric(value) {
        if (!value)
            return false;
        // Convert to string first
        const strValue = String(value).trim();
        if (!strValue)
            return false;
        // Remove currency symbols, commas, spaces, and [FX] markers
        const cleaned = strValue.replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '').trim();
        // Check for various numeric patterns:
        // - Regular numbers: 123, 123.45
        // - Negative numbers in parentheses: (123), (123.45)
        // - Zero values: 0, 0.00, (0.00)
        return /^(\(?\d+\.?\d*\)?|0+\.?0*)$/.test(cleaned);
    }
    static parseAmount(value) {
        if (!value)
            return 0;
        // Convert to string and trim
        const strValue = String(value).trim();
        if (!strValue || strValue === '')
            return 0;
        // Remove currency symbols, commas, spaces, and [FX] markers
        let cleaned = strValue.replace(/[£$€¥,\s]/g, '').replace(/\[FX\]/g, '').trim();
        // Handle negative values in parentheses
        const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
        if (isNegative) {
            cleaned = '-' + cleaned.slice(1, -1);
        }
        const parsed = parseFloat(cleaned);
        const result = isNaN(parsed) ? 0 : parsed;
        // Log parsing of negative values or unusual values
        if (isNegative || (result !== 0 && Math.abs(result) > 0.01)) {
            logger_1.structuredLogger.debug('[XeroBalanceSheetParser] Parsed amount', {
                original: strValue,
                cleaned,
                isNegative,
                result
            });
        }
        return result;
    }
    /**
     * Convert parsed structure to database format
     */
    static toImportFormat(parsed, reportDate) {
        // Find specific accounts by name patterns
        const findAccount = (accounts, patterns) => {
            let total = 0;
            // Check each account against all patterns
            accounts.forEach(account => {
                const accountNameLower = account.name.toLowerCase();
                for (const pattern of patterns) {
                    if (accountNameLower.includes(pattern.toLowerCase())) {
                        total += account.balance;
                        logger_1.structuredLogger.debug('[XeroBalanceSheetParser] Found matching account', {
                            pattern,
                            accountName: account.name,
                            balance: account.balance,
                            runningTotal: total
                        });
                        break; // Only count each account once
                    }
                }
            });
            return total;
        };
        // Extract specific values from current assets
        const cash = findAccount(parsed.assets.current, ['cash', 'bank', 'lloyds', 'wise', 'payoneer']);
        logger_1.structuredLogger.info('[XeroBalanceSheetParser] Cash detection', {
            totalCash: cash,
            currentAssets: parsed.assets.current.map(a => ({ name: a.name, balance: a.balance }))
        });
        const receivables = findAccount(parsed.assets.current, ['debtor', 'receivable', 'targon']);
        const inventory = findAccount(parsed.assets.current, ['inventory', 'stock']);
        const prepaid = findAccount(parsed.assets.current, ['prepaid', 'prepayment']);
        // Extract specific values from current liabilities  
        const payables = findAccount(parsed.liabilities.current, ['payable', 'creditor']);
        const vat = findAccount(parsed.liabilities.current, ['vat', 'gst', 'tax']);
        // Extract equity components
        const capital = findAccount(parsed.equity.accounts, ['capital', 'share']);
        const retained = findAccount(parsed.equity.accounts, ['retained', 'earnings']);
        return {
            assets: {
                current: {
                    total: parsed.assets.totalCurrent,
                    cash,
                    accountsReceivable: receivables,
                    inventory,
                    prepaidExpenses: prepaid,
                    otherCurrentAssets: parsed.assets.totalCurrent - cash - receivables - inventory - prepaid
                },
                nonCurrent: {
                    total: parsed.assets.totalFixed,
                    propertyPlantEquipment: parsed.assets.totalFixed,
                    intangibleAssets: 0,
                    investments: 0,
                    otherNonCurrentAssets: 0
                },
                total: parsed.assets.totalAssets
            },
            liabilities: {
                current: {
                    total: parsed.liabilities.totalCurrent,
                    accountsPayable: payables,
                    shortTermDebt: 0,
                    accruedExpenses: vat,
                    deferredRevenue: 0,
                    otherCurrentLiabilities: parsed.liabilities.totalCurrent - payables - vat
                },
                nonCurrent: {
                    total: parsed.liabilities.totalNonCurrent,
                    longTermDebt: 0,
                    deferredTaxLiabilities: 0,
                    otherNonCurrentLiabilities: parsed.liabilities.totalNonCurrent
                },
                total: parsed.liabilities.totalLiabilities
            },
            equity: {
                total: parsed.equity.totalEquity,
                commonStock: capital,
                retainedEarnings: retained,
                otherEquity: parsed.equity.totalEquity - capital - retained
            },
            summary: {
                totalAssets: parsed.assets.totalAssets,
                totalLiabilities: parsed.liabilities.totalLiabilities,
                totalEquity: parsed.equity.totalEquity,
                netAssets: parsed.netAssets,
                currentRatio: parsed.liabilities.totalCurrent > 0 ?
                    parsed.assets.totalCurrent / parsed.liabilities.totalCurrent : 0,
                debtToEquityRatio: parsed.equity.totalEquity > 0 ?
                    parsed.liabilities.totalLiabilities / parsed.equity.totalEquity : 0,
                workingCapital: parsed.assets.totalCurrent - parsed.liabilities.totalCurrent
            },
            reportDate: reportDate.toISOString()
        };
    }
}
exports.XeroBalanceSheetParser = XeroBalanceSheetParser;
