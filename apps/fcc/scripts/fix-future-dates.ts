import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFutureDates() {
  console.log('=== FIXING FUTURE DATES IN IMPORTED REPORTS ===\n');
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  console.log(`Current date: ${todayStr}`);
  console.log(`Will fix any periodEnd dates after today\n`);
  
  try {
    // Find all ImportedReports with future periodEnd dates
    const futureReports = await prisma.importedReport.findMany({
      where: {
        periodEnd: {
          gt: today
        }
      },
      orderBy: {
        periodEnd: 'desc'
      }
    });
    
    console.log(`Found ${futureReports.length} reports with future dates:\n`);
    
    for (const report of futureReports) {
      const oldDate = report.periodEnd.toISOString().split('T')[0];
      
      // For balance sheets and other point-in-time reports, 
      // set periodEnd to the last day of the most recent completed month
      let newPeriodEnd: Date;
      
      // If we're in the middle of a month, use the last day of the previous month
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      newPeriodEnd = lastMonth;
      
      // Period start should remain as Jan 1 of the year for balance sheets
      const newPeriodStart = new Date(newPeriodEnd.getFullYear(), 0, 1);
      
      console.log(`Report ID: ${report.id}`);
      console.log(`  Type: ${report.type}`);
      console.log(`  Old Period: ${report.periodStart.toISOString().split('T')[0]} to ${oldDate}`);
      console.log(`  New Period: ${newPeriodStart.toISOString().split('T')[0]} to ${newPeriodEnd.toISOString().split('T')[0]}`);
      
      // Update the report
      await prisma.importedReport.update({
        where: { id: report.id },
        data: {
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd
        }
      });
      
      // Also update any related ReportData entries
      // First check if there's already a report with the new date range
      const existingReportData = await prisma.reportData.findFirst({
        where: {
          reportType: report.type,
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd,
          isActive: true
        }
      });
      
      if (existingReportData) {
        // If there's already data for this period, just delete the future-dated one
        const deletedReportData = await prisma.reportData.deleteMany({
          where: {
            importedReportId: report.id
          }
        });
        console.log(`  ⚠️  Deleted ${deletedReportData.count} ReportData entries (duplicate period exists)`);
      } else {
        // Otherwise update the dates
        try {
          const updatedReportData = await prisma.reportData.updateMany({
            where: {
              importedReportId: report.id
            },
            data: {
              periodStart: newPeriodStart,
              periodEnd: newPeriodEnd
            }
          });
          console.log(`  ✅ Updated ${updatedReportData.count} related ReportData entries`);
        } catch (updateError) {
          // If update fails, likely due to constraint, just delete
          const deletedReportData = await prisma.reportData.deleteMany({
            where: {
              importedReportId: report.id
            }
          });
          console.log(`  ⚠️  Deleted ${deletedReportData.count} ReportData entries (constraint conflict)`);
        }
      }
      
      console.log('');
    }
    
    console.log('\n=== VERIFICATION ===');
    
    // Verify no more future dates exist
    const remainingFuture = await prisma.importedReport.count({
      where: {
        periodEnd: {
          gt: today
        }
      }
    });
    
    if (remainingFuture === 0) {
      console.log('✅ All future dates have been fixed!');
    } else {
      console.log(`⚠️  WARNING: ${remainingFuture} reports still have future dates`);
    }
    
    // Show current date range of reports
    const dateRange = await prisma.importedReport.aggregate({
      _min: {
        periodEnd: true
      },
      _max: {
        periodEnd: true
      }
    });
    
    console.log('\nCurrent date range of all reports:');
    console.log(`  Earliest: ${dateRange._min.periodEnd?.toISOString().split('T')[0] || 'N/A'}`);
    console.log(`  Latest: ${dateRange._max.periodEnd?.toISOString().split('T')[0] || 'N/A'}`);
    
  } catch (error) {
    console.error('Error fixing future dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixFutureDates();