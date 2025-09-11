const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { XeroBalanceSheetParser } = require('../dist/lib/parsers/xero-balance-sheet-parser');

const prisma = new PrismaClient();

async function importBalanceSheet(filePath, periodStart, periodEnd, description) {
  console.log(`\nImporting ${description}...`);
  
  try {
    // Read the Excel file
    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to array format
    const data = xlsx.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      blankrows: true
    });
    
    console.log(`- Read ${data.length} rows from Excel file`);
    
    // Format the target date for parser
    const targetDate = formatDateForXeroColumn(new Date(periodEnd));
    console.log(`- Target date for parser: ${targetDate}`);
    
    // Parse the data
    const parsed = XeroBalanceSheetParser.parse(data, targetDate);
    const processedData = XeroBalanceSheetParser.toImportFormat(parsed, new Date(periodEnd));
    
    console.log(`- Parsed data summary:`);
    console.log(`  Total Assets: ${processedData.totalAssets?.toLocaleString()}`);
    console.log(`  Total Liabilities: ${processedData.totalLiabilities?.toLocaleString()}`);
    console.log(`  Net Assets: ${processedData.netAssets?.toLocaleString()}`);
    
    // Create import record
    const importedReport = await prisma.importedReport.create({
      data: {
        type: 'BALANCE_SHEET',
        source: 'excel',
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        importedBy: 'manual-script',
        fileName: path.basename(filePath),
        fileSize: buffer.length,
        rawData: JSON.stringify(data),
        status: 'completed',
        recordCount: data.length,
        processedData: JSON.stringify(processedData)
      }
    });
    
    console.log(`- Created import record: ${importedReport.id}`);
    
    // Store the report data
    const reportData = await prisma.reportData.create({
      data: {
        reportType: 'BALANCE_SHEET',
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        data: JSON.stringify(processedData),
        importedReportId: importedReport.id,
        isActive: true
      }
    });
    
    console.log(`- Created report data: ${reportData.id}`);
    console.log(`✓ Import successful!`);
    
    return { importedReport, reportData };
    
  } catch (error) {
    console.error(`✗ Import failed:`, error.message);
    throw error;
  }
}

function formatDateForXeroColumn(date) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}

async function main() {
  console.log('Manual Balance Sheet Import\n');
  
  try {
    // Import June 2025 balance sheet
    await importBalanceSheet(
      path.join(__dirname, '..', 'data', 'balance sheet.xlsx'),
      '2025-01-01',
      '2025-06-30',
      'June 2025 Balance Sheet'
    );
    
    // Import May 2025 balance sheet
    await importBalanceSheet(
      path.join(__dirname, '..', 'data', 'balance-sheet_2025-05-31.xlsx'),
      '2025-01-01',
      '2025-05-31',
      'May 2025 Balance Sheet'
    );
    
    console.log('\n✅ All imports completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Visit http://localhost:3000/reports/detailed-reports/balance-sheet');
    console.log('3. Click "View Imports" to see the imported data');
    
  } catch (error) {
    console.error('\n❌ Import process failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();