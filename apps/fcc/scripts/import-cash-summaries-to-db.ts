#!/usr/bin/env ts-node

import { prisma } from '../lib/prisma';
import { structuredLogger } from '../lib/logger';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

async function importCashSummariesToDatabase() {
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  try {
    console.log('=== Importing Cash Summaries to Database ===\n');

    // Get the data directory
    const dataDir = path.join(process.cwd(), 'data', 'cash-summaries');
    if (!fs.existsSync(dataDir)) {
      throw new Error(`Data directory not found: ${dataDir}`);
    }

    // Get all cash summary files
    const files = fs.readdirSync(dataDir)
      .filter(file => file.startsWith('cash-summary-') && file.endsWith('.json'))
      .sort();

    console.log(`Found ${files.length} cash summary files to import\n`);

    // Get user for importedBy
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null }
      }
    });

    if (!user) {
      throw new Error('No user with Xero connection found');
    }

    // Process each file
    for (const file of files) {
      try {
        const filePath = path.join(dataDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`Importing ${data.month}...`);

        // Create ImportedReport record
        const importedReport = await prisma.importedReport.create({
          data: {
            type: 'CASH_FLOW',
            source: 'API',
            periodStart: new Date(data.monthStart),
            periodEnd: new Date(data.monthEnd),
            importedBy: 'System Import',
            status: 'COMPLETED',
            recordCount: data.accounts?.length || 0,
            fileName: file,
            processedData: JSON.stringify(data),
            metadata: JSON.stringify({
              fileName: file,
              month: data.month,
              totalMovement: data.totalCashMovement,
              accountCount: data.accounts?.length || 0,
              fetchedAt: data.fetchedAt
            })
          }
        });

        // Check if ReportData already exists for this period
        const existingReportData = await prisma.reportData.findFirst({
          where: {
            reportType: 'CASH_FLOW',
            periodStart: new Date(data.monthStart),
            periodEnd: new Date(data.monthEnd),
            isActive: true
          }
        });

        if (existingReportData) {
          // Update existing record
          await prisma.reportData.update({
            where: { id: existingReportData.id },
            data: {
              data: JSON.stringify({
              detailedCashSummary: {
                reportName: data.reportName,
                fromDate: data.fromDate,
                toDate: data.toDate,
                accounts: data.accounts,
                totalCashMovement: data.totalCashMovement,
                openingBalance: data.openingBalance,
                closingBalance: data.closingBalance
              },
              // Include basic cash flow structure for compatibility
              operatingActivities: {
                netCashFromOperating: data.totalCashMovement,
                receiptsFromCustomers: data.accounts.reduce((sum: number, acc: any) => sum + acc.cashReceived, 0),
                paymentsToSuppliers: data.accounts.reduce((sum: number, acc: any) => sum + acc.cashSpent, 0),
                paymentsToEmployees: 0,
                interestPaid: 0,
                incomeTaxPaid: 0,
                otherOperating: 0
              },
              investingActivities: {
                netCashFromInvesting: 0,
                purchaseOfAssets: 0,
                saleOfAssets: 0,
                otherInvesting: 0
              },
              financingActivities: {
                netCashFromFinancing: 0,
                proceedsFromBorrowing: 0,
                repaymentOfBorrowing: 0,
                dividendsPaid: 0,
                otherFinancing: 0
              },
              summary: {
                netCashFlow: data.totalCashMovement,
                openingBalance: data.openingBalance,
                closingBalance: data.closingBalance,
                cashFlowRatio: 0,
                operatingCashFlowRatio: 0
              },
              monthlyTrends: [],
              reportDate: new Date().toISOString(),
              fromDate: data.fromDate,
              toDate: data.toDate,
              fetchedAt: data.fetchedAt,
              source: 'xero_bank_summary',
              currency: 'GBP'
            }),
            summary: `Cash Summary for ${data.month}: Opening ${data.openingBalance}, Movement ${data.totalCashMovement}, Closing ${data.closingBalance}`,
            version: existingReportData.version + 1,
            importedReportId: importedReport.id,
            updatedAt: new Date()
            }
          });
          
          console.log(`✓ Updated existing report for ${data.month}`);
        } else {
          // Create new ReportData record
          await prisma.reportData.create({
            data: {
              reportType: 'CASH_FLOW',
              periodStart: new Date(data.monthStart),
              periodEnd: new Date(data.monthEnd),
              data: JSON.stringify({
                detailedCashSummary: {
                  reportName: data.reportName,
                  fromDate: data.fromDate,
                  toDate: data.toDate,
                  accounts: data.accounts,
                  totalCashMovement: data.totalCashMovement,
                  openingBalance: data.openingBalance,
                  closingBalance: data.closingBalance
                },
                // Include basic cash flow structure for compatibility
                operatingActivities: {
                  netCashFromOperating: data.totalCashMovement,
                  receiptsFromCustomers: data.accounts.reduce((sum: number, acc: any) => sum + acc.cashReceived, 0),
                  paymentsToSuppliers: data.accounts.reduce((sum: number, acc: any) => sum + acc.cashSpent, 0),
                  paymentsToEmployees: 0,
                  interestPaid: 0,
                  incomeTaxPaid: 0,
                  otherOperating: 0
                },
                investingActivities: {
                  netCashFromInvesting: 0,
                  purchaseOfAssets: 0,
                  saleOfAssets: 0,
                  otherInvesting: 0
                },
                financingActivities: {
                  netCashFromFinancing: 0,
                  proceedsFromBorrowing: 0,
                  repaymentOfBorrowing: 0,
                  dividendsPaid: 0,
                  otherFinancing: 0
                },
                summary: {
                  netCashFlow: data.totalCashMovement,
                  openingBalance: data.openingBalance,
                  closingBalance: data.closingBalance,
                  cashFlowRatio: 0,
                  operatingCashFlowRatio: 0
                },
                monthlyTrends: [],
                reportDate: new Date().toISOString(),
                fromDate: data.fromDate,
                toDate: data.toDate,
                fetchedAt: data.fetchedAt,
                source: 'xero_bank_summary',
                currency: 'GBP'
              }),
              summary: `Cash Summary for ${data.month}: Opening ${data.openingBalance}, Movement ${data.totalCashMovement}, Closing ${data.closingBalance}`,
              version: 1,
              isActive: true,
              importedReportId: importedReport.id
            }
          });
          
          console.log(`✓ Created new report for ${data.month}`);
        }

        console.log(`✓ Imported ${data.month} successfully`);
        successCount++;

      } catch (error: any) {
        console.error(`✗ Failed to import ${file}:`, error.message);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log('\n=== Import Summary ===');
    console.log(`Total files processed: ${files.length}`);
    console.log(`Successful imports: ${successCount}`);
    console.log(`Failed imports: ${errorCount}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  importCashSummariesToDatabase()
    .then(() => {
      console.log('\n=== Import completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}