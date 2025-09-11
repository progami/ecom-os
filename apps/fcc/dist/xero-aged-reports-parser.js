"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XeroAgedReportsParser = void 0;
var logger_1 = require("@/lib/logger");
var XeroAgedReportsParser = /** @class */ (function () {
    function XeroAgedReportsParser() {
    }
    /**
     * Parse Xero Aged Payables/Receivables data
     * Handles both CSV format and pre-formatted object data
     */
    XeroAgedReportsParser.parse = function (data, reportType) {
        if (reportType === void 0) { reportType = 'payables'; }
        // Check if data is pre-formatted objects
        if (this.isPreformattedData(data)) {
            return this.parsePreformattedData(data, reportType);
        }
        // Otherwise parse as CSV
        return this.parseCSVData(data, reportType);
    };
    /**
     * Check if data is pre-formatted objects rather than CSV arrays
     */
    XeroAgedReportsParser.isPreformattedData = function (data) {
        if (!Array.isArray(data) || data.length === 0)
            return false;
        var firstItem = data[0];
        if (typeof firstItem !== 'object' || Array.isArray(firstItem))
            return false;
        // Check for typical aged report object properties
        var hasContactProperties = 'contactName' in firstItem || 'contact' in firstItem || 'Contact' in firstItem ||
            'supplierName' in firstItem || 'customerName' in firstItem;
        var hasAgingProperties = 'current' in firstItem || 'Current' in firstItem ||
            'days1to30' in firstItem || 'days31to60' in firstItem ||
            'totalOutstanding' in firstItem || 'total' in firstItem;
        return hasContactProperties || hasAgingProperties;
    };
    /**
     * Parse pre-formatted object data
     */
    XeroAgedReportsParser.parsePreformattedData = function (data, reportType) {
        var result = {
            contacts: [],
            totals: {
                current: 0,
                days1to30: 0,
                days31to60: 0,
                days61to90: 0,
                days91Plus: 0,
                totalOutstanding: 0
            }
        };
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var item = data_1[_i];
            var contactName = (item.contactName || item.contact || item.Contact ||
                item.supplierName || item.customerName || '').toString().trim();
            if (!contactName || contactName.toLowerCase().includes('total'))
                continue;
            var current = this.parseAmount((item.current || item.Current || item['0-30'] || '0').toString());
            var days1to30 = this.parseAmount((item.days1to30 || item['1-30'] || item['31-60'] || item['Month 1'] || '0').toString());
            var days31to60 = this.parseAmount((item.days31to60 || item['31-60'] || item['61-90'] || item['Month 2'] || '0').toString());
            var days61to90 = this.parseAmount((item.days61to90 || item['61-90'] || item['91-120'] || item['Month 3'] || '0').toString());
            var days91Plus = this.parseAmount((item.days91Plus || item['91+'] || item['>90'] || item['Over 90'] || item['Month 4'] || '0').toString());
            var totalOutstanding = this.parseAmount((item.totalOutstanding || item.total || item.Total || '0').toString());
            // Calculate total if not provided
            if (totalOutstanding === 0) {
                totalOutstanding = current + days1to30 + days31to60 + days61to90 + days91Plus;
            }
            // Skip if all amounts are zero
            if (totalOutstanding === 0 && current === 0 && days1to30 === 0 &&
                days31to60 === 0 && days61to90 === 0 && days91Plus === 0) {
                continue;
            }
            var contact = {
                contactName: contactName,
                contactId: item.contactId || item.id || "contact-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9)),
                current: current,
                days1to30: days1to30,
                days31to60: days31to60,
                days61to90: days61to90,
                days91Plus: days91Plus,
                totalOutstanding: totalOutstanding
            };
            result.contacts.push(contact);
            // Add to totals
            result.totals.current += current;
            result.totals.days1to30 += days1to30;
            result.totals.days31to60 += days31to60;
            result.totals.days61to90 += days61to90;
            result.totals.days91Plus += days91Plus;
            result.totals.totalOutstanding += totalOutstanding;
        }
        logger_1.structuredLogger.info("[XeroAgedReportsParser] Parsed pre-formatted aged ".concat(reportType, " data"), {
            contactCount: result.contacts.length,
            totalOutstanding: result.totals.totalOutstanding,
            current: result.totals.current,
            overdue: result.totals.totalOutstanding - result.totals.current
        });
        return result;
    };
    /**
     * Parse Xero Aged Payables/Receivables CSV format
     * Handles various column layouts and summaries
     */
    XeroAgedReportsParser.parseCSVData = function (csvData, reportType) {
        if (reportType === void 0) { reportType = 'payables'; }
        var result = {
            contacts: [],
            totals: {
                current: 0,
                days1to30: 0,
                days31to60: 0,
                days61to90: 0,
                days91Plus: 0,
                totalOutstanding: 0
            }
        };
        // Find header row
        var headerRowIndex = -1;
        var headers = [];
        for (var i = 0; i < Math.min(10, csvData.length); i++) {
            var row = csvData[i];
            if (row && row.length > 0) {
                // Check if this row contains aging headers
                var hasContactHeader = row.some(function (cell) {
                    return cell && (cell.toLowerCase().includes('contact') ||
                        cell.toLowerCase().includes('supplier') ||
                        cell.toLowerCase().includes('customer') ||
                        cell.toLowerCase().includes('vendor'));
                });
                var hasAgingHeader = row.some(function (cell) {
                    return cell && (cell.toLowerCase().includes('current') ||
                        cell.toLowerCase().includes('days') ||
                        cell.toLowerCase().includes('month'));
                });
                if (hasContactHeader || hasAgingHeader) {
                    headerRowIndex = i;
                    headers = row.map(function (h) { return (h || '').toLowerCase().trim(); });
                    break;
                }
            }
        }
        if (headerRowIndex === -1) {
            logger_1.structuredLogger.warn('[XeroAgedReportsParser] Could not find header row');
            return result;
        }
        // Identify column indices
        var columnMap = this.identifyColumns(headers);
        // Parse data rows
        var skipNextRow = false;
        for (var i = headerRowIndex + 1; i < csvData.length; i++) {
            if (skipNextRow) {
                skipNextRow = false;
                continue;
            }
            var row = csvData[i];
            // Skip empty rows
            if (!row || row.length === 0 || row.every(function (cell) { return !cell || cell.trim() === ''; })) {
                continue;
            }
            // Check if this is a total row
            var firstCell = (row[0] || '').trim().toLowerCase();
            if (firstCell.includes('total') || firstCell === 'grand total') {
                // Extract totals if this is the grand total row
                if (firstCell === 'total' || firstCell === 'grand total') {
                    var totals = this.parseContactRow(row, columnMap);
                    if (totals) {
                        result.totals = {
                            current: totals.current,
                            days1to30: totals.days1to30,
                            days31to60: totals.days31to60,
                            days61to90: totals.days61to90,
                            days91Plus: totals.days91Plus,
                            totalOutstanding: totals.totalOutstanding
                        };
                    }
                }
                continue;
            }
            // Skip date range headers (e.g., "As at 30 June 2025")
            if (firstCell.includes('as at') || firstCell.includes('as of')) {
                continue;
            }
            var contact = this.parseContactRow(row, columnMap);
            if (contact && contact.totalOutstanding !== 0) {
                result.contacts.push(contact);
            }
        }
        // Calculate totals if not found
        if (result.totals.totalOutstanding === 0 && result.contacts.length > 0) {
            result.contacts.forEach(function (contact) {
                result.totals.current += contact.current;
                result.totals.days1to30 += contact.days1to30;
                result.totals.days31to60 += contact.days31to60;
                result.totals.days61to90 += contact.days61to90;
                result.totals.days91Plus += contact.days91Plus;
                result.totals.totalOutstanding += contact.totalOutstanding;
            });
        }
        logger_1.structuredLogger.info("[XeroAgedReportsParser] Parsed aged ".concat(reportType), {
            contactCount: result.contacts.length,
            totalOutstanding: result.totals.totalOutstanding,
            current: result.totals.current,
            overdue: result.totals.totalOutstanding - result.totals.current
        });
        return result;
    };
    XeroAgedReportsParser.identifyColumns = function (headers) {
        var columnMap = {
            contact: -1,
            current: -1,
            days1to30: -1,
            days31to60: -1,
            days61to90: -1,
            days91Plus: -1,
            total: -1
        };
        headers.forEach(function (header, index) {
            if (header.includes('contact') || header.includes('supplier') ||
                header.includes('customer') || header.includes('vendor') ||
                header.includes('name')) {
                columnMap.contact = index;
            }
            else if (header === 'current' || header.includes('not yet due') ||
                header.includes('0 days')) {
                columnMap.current = index;
            }
            else if (header.includes('1-30') || header.includes('1 - 30') ||
                header === 'month 1' || header.includes('30 days')) {
                columnMap.days1to30 = index;
            }
            else if (header.includes('31-60') || header.includes('31 - 60') ||
                header === 'month 2' || header.includes('60 days')) {
                columnMap.days31to60 = index;
            }
            else if (header.includes('61-90') || header.includes('61 - 90') ||
                header === 'month 3' || header.includes('90 days')) {
                columnMap.days61to90 = index;
            }
            else if (header.includes('91+') || header.includes('> 90') ||
                header.includes('older') || header === 'month 4' ||
                header.includes('over 90')) {
                columnMap.days91Plus = index;
            }
            else if (header === 'total' || header.includes('total due') ||
                header.includes('balance')) {
                columnMap.total = index;
            }
        });
        return columnMap;
    };
    XeroAgedReportsParser.parseContactRow = function (row, columnMap) {
        // Extract contact name
        var contactName = '';
        if (columnMap.contact !== -1 && row[columnMap.contact]) {
            contactName = row[columnMap.contact].trim();
        }
        else if (row[0]) {
            // Use first non-empty column if contact column not identified
            contactName = row[0].trim();
        }
        if (!contactName)
            return null;
        // Extract amounts
        var current = columnMap.current !== -1 ? this.parseAmount(row[columnMap.current]) : 0;
        var days1to30 = columnMap.days1to30 !== -1 ? this.parseAmount(row[columnMap.days1to30]) : 0;
        var days31to60 = columnMap.days31to60 !== -1 ? this.parseAmount(row[columnMap.days31to60]) : 0;
        var days61to90 = columnMap.days61to90 !== -1 ? this.parseAmount(row[columnMap.days61to90]) : 0;
        var days91Plus = columnMap.days91Plus !== -1 ? this.parseAmount(row[columnMap.days91Plus]) : 0;
        // Get total from column or calculate
        var totalOutstanding = 0;
        if (columnMap.total !== -1 && row[columnMap.total]) {
            totalOutstanding = this.parseAmount(row[columnMap.total]);
        }
        else {
            totalOutstanding = current + days1to30 + days31to60 + days61to90 + days91Plus;
        }
        // Skip if all amounts are zero
        if (totalOutstanding === 0 && current === 0 && days1to30 === 0 &&
            days31to60 === 0 && days61to90 === 0 && days91Plus === 0) {
            return null;
        }
        return {
            contactName: contactName,
            contactId: "contact-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9)),
            current: current,
            days1to30: days1to30,
            days31to60: days31to60,
            days61to90: days61to90,
            days91Plus: days91Plus,
            totalOutstanding: totalOutstanding
        };
    };
    XeroAgedReportsParser.parseAmount = function (value) {
        if (!value)
            return 0;
        // Remove currency symbols, commas, spaces
        var cleaned = value.replace(/[£$€¥,\s]/g, '').trim();
        // Handle negative values in parentheses
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
            cleaned = '-' + cleaned.slice(1, -1);
        }
        // Handle dash or hyphen as zero
        if (cleaned === '-' || cleaned === '–' || cleaned === '—') {
            return 0;
        }
        var parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    };
    /**
     * Convert parsed structure to database format
     */
    XeroAgedReportsParser.toImportFormat = function (parsed, asAtDate, reportType) {
        if (reportType === void 0) { reportType = 'payables'; }
        var totalOutstanding = parsed.totals.totalOutstanding;
        var totalOverdue = parsed.totals.days1to30 + parsed.totals.days31to60 +
            parsed.totals.days61to90 + parsed.totals.days91Plus;
        var criticalAmount = parsed.totals.days61to90 + parsed.totals.days91Plus;
        return {
            totalOutstanding: totalOutstanding,
            current: parsed.totals.current,
            days1to30: parsed.totals.days1to30,
            days31to60: parsed.totals.days31to60,
            days61to90: parsed.totals.days61to90,
            days91Plus: parsed.totals.days91Plus,
            contacts: parsed.contacts.map(function (contact, index) { return ({
                contactId: contact.contactId || "contact-".concat(index + 1),
                contactName: contact.contactName,
                totalOutstanding: contact.totalOutstanding,
                current: contact.current,
                days1to30: contact.days1to30,
                days31to60: contact.days31to60,
                days61to90: contact.days61to90,
                days91Plus: contact.days91Plus
            }); }),
            summary: {
                totalOutstanding: totalOutstanding,
                percentageCurrent: totalOutstanding > 0 ? (parsed.totals.current / totalOutstanding) * 100 : 0,
                percentageOverdue: totalOutstanding > 0 ? (totalOverdue / totalOutstanding) * 100 : 0,
                criticalAmount: criticalAmount,
                criticalPercentage: totalOutstanding > 0 ? (criticalAmount / totalOutstanding) * 100 : 0
            },
            reportDate: asAtDate.toISOString(),
            fromDate: asAtDate.toISOString(),
            toDate: asAtDate.toISOString()
        };
    };
    return XeroAgedReportsParser;
}());
exports.XeroAgedReportsParser = XeroAgedReportsParser;
