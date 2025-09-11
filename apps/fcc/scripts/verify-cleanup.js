#!/usr/bin/env node

/**
 * Script to verify database cleanup
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyCleanup() {
  try {
    console.log('Verifying database cleanup...\n');
    
    // Check all tables that should be empty
    const tables = [
      { name: 'ReportData', model: prisma.reportData },
      { name: 'ImportedReport', model: prisma.importedReport },
      { name: 'GeneralLedgerEntry', model: prisma.generalLedgerEntry },
      { name: 'AccountBalance', model: prisma.accountBalance },
      { name: 'ChartOfAccount', model: prisma.chartOfAccount },
      { name: 'Report', model: prisma.report },
      { name: 'ScheduledReportExecution', model: prisma.scheduledReportExecution },
      { name: 'ReportDeliveryLog', model: prisma.reportDeliveryLog },
      { name: 'ScheduledReport', model: prisma.scheduledReport },
      { name: 'ReportTemplate', model: prisma.reportTemplate },
      { name: 'InvoiceLineItem', model: prisma.invoiceLineItem },
      { name: 'Invoice', model: prisma.invoice },
      { name: 'Contact', model: prisma.contact },
      { name: 'BankAccount', model: prisma.bankAccount },
      { name: 'TaxRate', model: prisma.taxRate },
      { name: 'CurrencyRate', model: prisma.currencyRate },
      { name: 'SyncCheckpoint', model: prisma.syncCheckpoint },
      { name: 'SyncLog', model: prisma.syncLog },
      { name: 'StandardOperatingProcedure', model: prisma.standardOperatingProcedure },
      { name: 'ErrorLog', model: prisma.errorLog },
      { name: 'AuditLog', model: prisma.auditLog }
    ];
    
    let allEmpty = true;
    
    for (const table of tables) {
      const count = await table.model.count();
      if (count > 0) {
        console.log(`❌ ${table.name}: ${count} records (should be 0)`);
        allEmpty = false;
      } else {
        console.log(`✅ ${table.name}: ${count} records`);
      }
    }
    
    // Check User table (should have data)
    const userCount = await prisma.user.count();
    console.log(`\n📌 User table: ${userCount} records (preserved)`);
    
    if (allEmpty) {
      console.log('\n✅ All test data has been successfully deleted!');
      console.log('✅ Database structure is preserved.');
      console.log('✅ User authentication data is preserved.');
    } else {
      console.log('\n⚠️  Some tables still contain data.');
    }
    
  } catch (error) {
    console.error('Error verifying cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyCleanup();