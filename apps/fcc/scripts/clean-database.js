#!/usr/bin/env node

/**
 * Script to clean all dummy/test data from the database
 * This will DELETE all data but preserve the database structure
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Log file path
const logFile = path.join(__dirname, '..', 'development.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [DATABASE_CLEANUP] ${message}\n`;
  console.log(logMessage);
  
  // Write to development.log
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

async function getTableCounts() {
  log('Getting record counts for all tables...');
  
  const counts = {
    reportData: await prisma.reportData.count(),
    importedReport: await prisma.importedReport.count(),
    generalLedgerEntry: await prisma.generalLedgerEntry.count(),
    accountBalance: await prisma.accountBalance.count(),
    chartOfAccount: await prisma.chartOfAccount.count(),
    report: await prisma.report.count(),
    scheduledReportExecution: await prisma.scheduledReportExecution.count(),
    reportDeliveryLog: await prisma.reportDeliveryLog.count(),
    scheduledReport: await prisma.scheduledReport.count(),
    reportTemplate: await prisma.reportTemplate.count(),
    invoiceLineItem: await prisma.invoiceLineItem.count(),
    invoice: await prisma.invoice.count(),
    contact: await prisma.contact.count(),
    bankAccount: await prisma.bankAccount.count(),
    taxRate: await prisma.taxRate.count(),
    currencyRate: await prisma.currencyRate.count(),
    syncCheckpoint: await prisma.syncCheckpoint.count(),
    syncLog: await prisma.syncLog.count(),
    standardOperatingProcedure: await prisma.standardOperatingProcedure.count(),
    errorLog: await prisma.errorLog.count(),
    auditLog: await prisma.auditLog.count(),
    user: await prisma.user.count()
  };
  
  return counts;
}

async function cleanDatabase() {
  try {
    log('Starting database cleanup...');
    
    // Get initial counts
    const beforeCounts = await getTableCounts();
    log('Initial record counts:');
    Object.entries(beforeCounts).forEach(([table, count]) => {
      if (count > 0) {
        log(`  ${table}: ${count} records`);
      }
    });
    
    // Start transaction for cleanup
    log('\nDeleting data from all tables (preserving User table)...');
    
    // Delete in order to respect foreign key constraints
    // 1. Delete report-related data first
    const reportData = await prisma.reportData.deleteMany({});
    log(`Deleted ${reportData.count} records from ReportData`);
    
    const ledgerEntries = await prisma.generalLedgerEntry.deleteMany({});
    log(`Deleted ${ledgerEntries.count} records from GeneralLedgerEntry`);
    
    const accountBalances = await prisma.accountBalance.deleteMany({});
    log(`Deleted ${accountBalances.count} records from AccountBalance`);
    
    const importedReports = await prisma.importedReport.deleteMany({});
    log(`Deleted ${importedReports.count} records from ImportedReport`);
    
    const chartOfAccounts = await prisma.chartOfAccount.deleteMany({});
    log(`Deleted ${chartOfAccounts.count} records from ChartOfAccount`);
    
    // 2. Delete scheduled report execution data
    const reportDeliveryLogs = await prisma.reportDeliveryLog.deleteMany({});
    log(`Deleted ${reportDeliveryLogs.count} records from ReportDeliveryLog`);
    
    const scheduledReportExecutions = await prisma.scheduledReportExecution.deleteMany({});
    log(`Deleted ${scheduledReportExecutions.count} records from ScheduledReportExecution`);
    
    const scheduledReports = await prisma.scheduledReport.deleteMany({});
    log(`Deleted ${scheduledReports.count} records from ScheduledReport`);
    
    const reportTemplates = await prisma.reportTemplate.deleteMany({});
    log(`Deleted ${reportTemplates.count} records from ReportTemplate`);
    
    const reports = await prisma.report.deleteMany({});
    log(`Deleted ${reports.count} records from Report`);
    
    // 3. Delete invoice-related data
    const invoiceLineItems = await prisma.invoiceLineItem.deleteMany({});
    log(`Deleted ${invoiceLineItems.count} records from InvoiceLineItem`);
    
    const invoices = await prisma.invoice.deleteMany({});
    log(`Deleted ${invoices.count} records from Invoice`);
    
    const contacts = await prisma.contact.deleteMany({});
    log(`Deleted ${contacts.count} records from Contact`);
    
    // 4. Delete other data
    const bankAccounts = await prisma.bankAccount.deleteMany({});
    log(`Deleted ${bankAccounts.count} records from BankAccount`);
    
    const taxRates = await prisma.taxRate.deleteMany({});
    log(`Deleted ${taxRates.count} records from TaxRate`);
    
    const currencyRates = await prisma.currencyRate.deleteMany({});
    log(`Deleted ${currencyRates.count} records from CurrencyRate`);
    
    const syncCheckpoints = await prisma.syncCheckpoint.deleteMany({});
    log(`Deleted ${syncCheckpoints.count} records from SyncCheckpoint`);
    
    const syncLogs = await prisma.syncLog.deleteMany({});
    log(`Deleted ${syncLogs.count} records from SyncLog`);
    
    const sops = await prisma.standardOperatingProcedure.deleteMany({});
    log(`Deleted ${sops.count} records from StandardOperatingProcedure`);
    
    const errorLogs = await prisma.errorLog.deleteMany({});
    log(`Deleted ${errorLogs.count} records from ErrorLog`);
    
    const auditLogs = await prisma.auditLog.deleteMany({});
    log(`Deleted ${auditLogs.count} records from AuditLog`);
    
    // Note: Preserving User table as it contains authentication data
    log('\nPreserving User table (contains authentication data)');
    
    // Get final counts
    const afterCounts = await getTableCounts();
    log('\nFinal record counts:');
    Object.entries(afterCounts).forEach(([table, count]) => {
      if (count > 0) {
        log(`  ${table}: ${count} records`);
      }
    });
    
    log('\nDatabase cleanup completed successfully!');
    
  } catch (error) {
    log(`ERROR during database cleanup: ${error.message}`);
    log(`Full error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database cleanup failed:', error);
    process.exit(1);
  });