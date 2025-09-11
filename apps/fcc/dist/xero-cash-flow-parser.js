"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeroCashFlowParser = void 0;
var logger_1 = require("@/lib/logger");
var XeroCashFlowParser = /** @class */ (function () {
    function XeroCashFlowParser() {
    }
    /**
     * Parse Xero Cash Flow Statement data
     * Handles both CSV format and pre-formatted object data
     */
    XeroCashFlowParser.parse = function (data) {
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
    XeroCashFlowParser.isPreformattedData = function (data) {
        if (!Array.isArray(data) || data.length === 0)
            return false;
        var firstItem = data[0];
        if (typeof firstItem !== 'object' || Array.isArray(firstItem))
            return false;
        // Check for typical cash flow object properties
        var hasAccountProperties = 'accountName' in firstItem || 'name' in firstItem || 'description' in firstItem;
        var hasAmountProperties = 'amount' in firstItem || 'value' in firstItem || 'cashFlow' in firstItem;
        var hasSectionProperties = 'section' in firstItem || 'category' in firstItem || 'activityType' in firstItem;
        return hasAccountProperties || hasAmountProperties || hasSectionProperties;
    };
    /**
     * Parse pre-formatted object data
     */
    XeroCashFlowParser.parsePreformattedData = function (data) {
        var result = {
            operatingActivities: {
                items: [],
                netCashFromOperating: 0
            },
            investingActivities: {
                items: [],
                netCashFromInvesting: 0
            },
            financingActivities: {
                items: [],
                netCashFromFinancing: 0
            },
            openingBalance: 0,
            closingBalance: 0,
            netCashMovement: 0
        };
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var item = data_1[_i];
            var name_1 = (item.accountName || item.name || item.description || '').toString().trim();
            var amount = this.parseAmount((item.amount || item.value || item.cashFlow || '0').toString());
            var section = (item.section || item.category || item.activityType || '').toString().toLowerCase();
            if (!name_1)
                continue;
            var cashFlowItem = {
                name: name_1,
                amount: amount,
                isSubTotal: name_1.toLowerCase().includes('total') || name_1.toLowerCase().includes('net')
            };
            // Handle special items
            if (name_1.toLowerCase().includes('opening cash') || name_1.toLowerCase().includes('cash at beginning')) {
                result.openingBalance = amount;
            }
            else if (name_1.toLowerCase().includes('closing cash') || name_1.toLowerCase().includes('cash at end')) {
                result.closingBalance = amount;
            }
            else if (name_1.toLowerCase().includes('net cash movement') || name_1.toLowerCase().includes('net increase') ||
                name_1.toLowerCase().includes('net decrease')) {
                result.netCashMovement = amount;
            }
            else if (section.includes('operating') || name_1.toLowerCase().includes('operating activities')) {
                if (name_1.toLowerCase().includes('net cash from operating') || name_1.toLowerCase().includes('total operating')) {
                    result.operatingActivities.netCashFromOperating = amount;
                }
                else {
                    result.operatingActivities.items.push(cashFlowItem);
                }
            }
            else if (section.includes('investing') || name_1.toLowerCase().includes('investing activities')) {
                if (name_1.toLowerCase().includes('net cash from investing') || name_1.toLowerCase().includes('total investing')) {
                    result.investingActivities.netCashFromInvesting = amount;
                }
                else {
                    result.investingActivities.items.push(cashFlowItem);
                }
            }
            else if (section.includes('financing') || name_1.toLowerCase().includes('financing activities')) {
                if (name_1.toLowerCase().includes('net cash from financing') || name_1.toLowerCase().includes('total financing')) {
                    result.financingActivities.netCashFromFinancing = amount;
                }
                else {
                    result.financingActivities.items.push(cashFlowItem);
                }
            }
            else {
                // Try to categorize based on name patterns
                if (name_1.toLowerCase().includes('receipt') || name_1.toLowerCase().includes('payment') ||
                    name_1.toLowerCase().includes('wages') || name_1.toLowerCase().includes('tax')) {
                    result.operatingActivities.items.push(cashFlowItem);
                }
                else if (name_1.toLowerCase().includes('asset') || name_1.toLowerCase().includes('investment') ||
                    name_1.toLowerCase().includes('purchase') || name_1.toLowerCase().includes('sale')) {
                    result.investingActivities.items.push(cashFlowItem);
                }
                else if (name_1.toLowerCase().includes('loan') || name_1.toLowerCase().includes('borrow') ||
                    name_1.toLowerCase().includes('dividend') || name_1.toLowerCase().includes('equity')) {
                    result.financingActivities.items.push(cashFlowItem);
                }
            }
        }
        // Calculate totals if not provided
        if (result.operatingActivities.netCashFromOperating === 0) {
            result.operatingActivities.netCashFromOperating = result.operatingActivities.items
                .reduce(function (sum, item) { return sum + item.amount; }, 0);
        }
        if (result.investingActivities.netCashFromInvesting === 0) {
            result.investingActivities.netCashFromInvesting = result.investingActivities.items
                .reduce(function (sum, item) { return sum + item.amount; }, 0);
        }
        if (result.financingActivities.netCashFromFinancing === 0) {
            result.financingActivities.netCashFromFinancing = result.financingActivities.items
                .reduce(function (sum, item) { return sum + item.amount; }, 0);
        }
        // Calculate missing values
        if (result.netCashMovement === 0) {
            result.netCashMovement = result.operatingActivities.netCashFromOperating +
                result.investingActivities.netCashFromInvesting +
                result.financingActivities.netCashFromFinancing;
        }
        if (result.closingBalance === 0 && result.openingBalance !== 0) {
            result.closingBalance = result.openingBalance + result.netCashMovement;
        }
        logger_1.structuredLogger.info('[XeroCashFlowParser] Parsed pre-formatted cash flow data', {
            operatingCashFlow: result.operatingActivities.netCashFromOperating,
            investingCashFlow: result.investingActivities.netCashFromInvesting,
            financingCashFlow: result.financingActivities.netCashFromFinancing,
            netMovement: result.netCashMovement
        });
        return result;
    };
    /**
     * Parse Xero Cash Flow Statement CSV format
     * Handles various formats including direct/indirect method
     */
    XeroCashFlowParser.parseCSVData = function (csvData) {
        var result = {
            operatingActivities: {
                items: [],
                netCashFromOperating: 0
            },
            investingActivities: {
                items: [],
                netCashFromInvesting: 0
            },
            financingActivities: {
                items: [],
                netCashFromFinancing: 0
            },
            openingBalance: 0,
            closingBalance: 0,
            netCashMovement: 0
        };
        var currentSection = '';
        var skipRows = 0;
        for (var i = 0; i < csvData.length; i++) {
            var row = csvData[i];
            // Skip empty rows
            if (!row || row.length === 0 || row.every(function (cell) { return !cell || cell.trim() === ''; })) {
                continue;
            }
            // Skip header rows
            if (skipRows > 0) {
                skipRows--;
                continue;
            }
            var firstCell = (row[0] || '').trim();
            var lastCell = row[row.length - 1] || '';
            // Identify main sections
            if (firstCell.toLowerCase().includes('operating activities') ||
                firstCell.toLowerCase().includes('cash flows from operating')) {
                currentSection = 'operating';
                continue;
            }
            else if (firstCell.toLowerCase().includes('investing activities') ||
                firstCell.toLowerCase().includes('cash flows from investing')) {
                currentSection = 'investing';
                continue;
            }
            else if (firstCell.toLowerCase().includes('financing activities') ||
                firstCell.toLowerCase().includes('cash flows from financing')) {
                currentSection = 'financing';
                continue;
            }
            // Parse line items
            var item = this.parseCashFlowLine(row);
            if (!item)
                continue;
            // Handle special items
            if (firstCell.toLowerCase().includes('opening cash') ||
                firstCell.toLowerCase().includes('cash at beginning')) {
                result.openingBalance = item.amount;
            }
            else if (firstCell.toLowerCase().includes('closing cash') ||
                firstCell.toLowerCase().includes('cash at end')) {
                result.closingBalance = item.amount;
            }
            else if (firstCell.toLowerCase().includes('net cash from operating') ||
                firstCell.toLowerCase().includes('total operating activities')) {
                result.operatingActivities.netCashFromOperating = item.amount;
            }
            else if (firstCell.toLowerCase().includes('net cash from investing') ||
                firstCell.toLowerCase().includes('total investing activities')) {
                result.investingActivities.netCashFromInvesting = item.amount;
            }
            else if (firstCell.toLowerCase().includes('net cash from financing') ||
                firstCell.toLowerCase().includes('total financing activities')) {
                result.financingActivities.netCashFromFinancing = item.amount;
            }
            else if (firstCell.toLowerCase().includes('net increase') ||
                firstCell.toLowerCase().includes('net decrease') ||
                firstCell.toLowerCase().includes('net cash movement')) {
                result.netCashMovement = item.amount;
            }
            else {
                // Regular line item
                switch (currentSection) {
                    case 'operating':
                        result.operatingActivities.items.push(item);
                        break;
                    case 'investing':
                        result.investingActivities.items.push(item);
                        break;
                    case 'financing':
                        result.financingActivities.items.push(item);
                        break;
                }
            }
        }
        // Calculate missing values
        if (result.netCashMovement === 0) {
            result.netCashMovement = result.operatingActivities.netCashFromOperating +
                result.investingActivities.netCashFromInvesting +
                result.financingActivities.netCashFromFinancing;
        }
        if (result.closingBalance === 0 && result.openingBalance !== 0) {
            result.closingBalance = result.openingBalance + result.netCashMovement;
        }
        logger_1.structuredLogger.info('[XeroCashFlowParser] Parsed cash flow statement', {
            operatingCashFlow: result.operatingActivities.netCashFromOperating,
            investingCashFlow: result.investingActivities.netCashFromInvesting,
            financingCashFlow: result.financingActivities.netCashFromFinancing,
            netMovement: result.netCashMovement
        });
        return result;
    };
    XeroCashFlowParser.parseCashFlowLine = function (row) {
        // Find the description (first non-empty cell)
        var name = '';
        var nameIndex = 0;
        for (var i = 0; i < row.length; i++) {
            if (row[i] && row[i].trim()) {
                name = row[i].trim();
                nameIndex = i;
                break;
            }
        }
        if (!name)
            return null;
        // Find the amount (last numeric cell)
        var amount = 0;
        for (var i = row.length - 1; i > nameIndex; i--) {
            var cellValue = row[i];
            if (cellValue && this.isNumeric(cellValue)) {
                amount = this.parseAmount(cellValue);
                break;
            }
        }
        // Skip if no amount found and not a section header
        if (amount === 0 && !name.toLowerCase().includes('activities') &&
            !name.toLowerCase().includes('cash') && !name.toLowerCase().includes('total')) {
            return null;
        }
        return {
            name: name,
            amount: amount,
            isSubTotal: name.toLowerCase().includes('total') || name.toLowerCase().includes('net')
        };
    };
    XeroCashFlowParser.isNumeric = function (value) {
        if (!value)
            return false;
        // Remove currency symbols, commas, spaces
        var cleaned = value.replace(/[£$€¥,\s]/g, '').trim();
        // Check for parentheses (negative numbers) or regular numbers
        return /^\(?\d+\.?\d*\)?$/.test(cleaned) || /^-?\d+\.?\d*$/.test(cleaned);
    };
    XeroCashFlowParser.parseAmount = function (value) {
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
    XeroCashFlowParser.toImportFormat = function (parsed, periodStart, periodEnd) {
        // Extract specific common items from operating activities
        var findItem = function (items, patterns) {
            var _loop_1 = function (pattern) {
                var item = items.find(function (i) {
                    return i.name.toLowerCase().includes(pattern.toLowerCase());
                });
                if (item)
                    return { value: item.amount };
            };
            for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
                var pattern = patterns_1[_i];
                var state_1 = _loop_1(pattern);
                if (typeof state_1 === "object")
                    return state_1.value;
            }
            return 0;
        };
        var operatingItems = parsed.operatingActivities.items;
        var receiptsFromCustomers = findItem(operatingItems, ['receipts from customers', 'cash receipts', 'sales receipts']);
        var paymentsToSuppliers = findItem(operatingItems, ['payments to suppliers', 'supplier payments', 'purchases']);
        var paymentsToEmployees = findItem(operatingItems, ['payments to employees', 'wages', 'salaries']);
        var interestPaid = findItem(operatingItems, ['interest paid', 'finance costs']);
        var incomeTaxPaid = findItem(operatingItems, ['income tax', 'tax paid', 'corporation tax']);
        var investingItems = parsed.investingActivities.items;
        var purchaseOfAssets = findItem(investingItems, ['purchase', 'acquisition', 'capital expenditure']);
        var saleOfAssets = findItem(investingItems, ['sale', 'disposal', 'proceeds from']);
        var financingItems = parsed.financingActivities.items;
        var proceedsFromBorrowing = findItem(financingItems, ['proceeds', 'loan received', 'borrowing']);
        var repaymentOfBorrowing = findItem(financingItems, ['repayment', 'loan repayment', 'debt payment']);
        var dividendsPaid = findItem(financingItems, ['dividend', 'distribution']);
        return {
            operatingActivities: {
                netCashFromOperating: parsed.operatingActivities.netCashFromOperating,
                receiptsFromCustomers: receiptsFromCustomers,
                paymentsToSuppliers: paymentsToSuppliers,
                paymentsToEmployees: paymentsToEmployees,
                interestPaid: interestPaid,
                incomeTaxPaid: incomeTaxPaid
            },
            investingActivities: {
                netCashFromInvesting: parsed.investingActivities.netCashFromInvesting,
                purchaseOfAssets: purchaseOfAssets,
                saleOfAssets: saleOfAssets
            },
            financingActivities: {
                netCashFromFinancing: parsed.financingActivities.netCashFromFinancing,
                proceedsFromBorrowing: proceedsFromBorrowing,
                repaymentOfBorrowing: repaymentOfBorrowing,
                dividendsPaid: dividendsPaid
            },
            summary: {
                netCashFlow: parsed.netCashMovement,
                openingBalance: parsed.openingBalance,
                closingBalance: parsed.closingBalance,
                operatingCashFlowRatio: parsed.operatingActivities.netCashFromOperating > 0 ?
                    (parsed.operatingActivities.netCashFromOperating / parsed.closingBalance) * 100 : 0
            },
            fromDate: periodStart.toISOString(),
            toDate: periodEnd.toISOString(),
            reportDate: periodEnd.toISOString()
        };
    };
    return XeroCashFlowParser;
}());
exports.XeroCashFlowParser = XeroCashFlowParser;
