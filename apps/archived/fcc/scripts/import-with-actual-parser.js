const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

// Simplified version of XeroBalanceSheetParser logic
function parseXeroBalanceSheet(data, targetDateColumn) {
  const result = {
    assets: {
      currentAssets: [],
      nonCurrentAssets: [],
      totalAssets: 0
    },
    liabilities: {
      currentLiabilities: [],
      nonCurrentLiabilities: [],
      totalLiabilities: 0
    },
    equity: {
      accounts: [],
      totalEquity: 0
    },
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    netAssets: 0,
    currentAssets: 0,
    currentLiabilities: 0,
    nonCurrentAssets: 0,
    nonCurrentLiabilities: 0,
    workingCapital: 0,
    currentRatio: 0,
    quickRatio: 0,
    debtToEquityRatio: 0,
    equityRatio: 0
  };

  // Find the date column index
  let dateColumnIndex = 2; // Default to column 2 based on observed data
  
  // Parse rows
  let currentSection = '';
  let isIndented = false;
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    // Get account name (either column 0 or 1 depending on indentation)
    const col0 = row[0]?.toString().trim() || '';
    const col1 = row[1]?.toString().trim() || '';
    const valueStr = row[dateColumnIndex]?.toString().trim() || '';
    
    // Parse value
    const value = valueStr ? parseFloat(valueStr.replace(/[,£$()]/g, '').replace(/^\((.+)\)$/, '-$1')) || 0 : 0;
    
    // Determine account name and indentation
    let accountName = '';
    if (col0 && !col1) {
      // Section header
      accountName = col0;
      isIndented = false;
    } else if (!col0 && col1) {
      // Indented item
      accountName = col1;
      isIndented = true;
    } else if (col0 && col1) {
      // Could be either, check context
      accountName = col1;
      isIndented = true;
    }
    
    // Skip empty rows
    if (!accountName) continue;
    
    // Detect sections
    const lowerName = accountName.toLowerCase();
    
    if (lowerName === 'fixed assets' || lowerName === 'non-current assets') {
      currentSection = 'nonCurrentAssets';
      continue;
    } else if (lowerName === 'current assets') {
      currentSection = 'currentAssets';
      continue;
    } else if (lowerName === 'current liabilities') {
      currentSection = 'currentLiabilities';
      continue;
    } else if (lowerName === 'non-current liabilities' || lowerName === 'long term liabilities') {
      currentSection = 'nonCurrentLiabilities';
      continue;
    } else if (lowerName.includes('equity') || lowerName.includes('capital')) {
      currentSection = 'equity';
      continue;
    }
    
    // Skip totals and certain summary lines
    if (lowerName.includes('total') || lowerName.includes('net assets')) continue;
    
    // Only process indented items with values
    if (isIndented && value !== 0) {
      const account = {
        accountId: `account-${i}`,
        accountName: accountName,
        accountCode: '',
        balance: value
      };
      
      switch (currentSection) {
        case 'currentAssets':
          result.assets.currentAssets.push(account);
          result.currentAssets += Math.abs(value);
          result.totalAssets += Math.abs(value);
          break;
        case 'nonCurrentAssets':
          result.assets.nonCurrentAssets.push(account);
          result.nonCurrentAssets += Math.abs(value);
          result.totalAssets += Math.abs(value);
          break;
        case 'currentLiabilities':
          result.liabilities.currentLiabilities.push({ ...account, balance: -Math.abs(value) });
          result.currentLiabilities += Math.abs(value);
          result.totalLiabilities += Math.abs(value);
          break;
        case 'nonCurrentLiabilities':
          result.liabilities.nonCurrentLiabilities.push({ ...account, balance: -Math.abs(value) });
          result.nonCurrentLiabilities += Math.abs(value);
          result.totalLiabilities += Math.abs(value);
          break;
        case 'equity':
          result.equity.accounts.push(account);
          result.totalEquity += value;
          break;
      }
    }
  }
  
  // Calculate summary values
  result.assets.totalAssets = result.totalAssets;
  result.liabilities.totalLiabilities = result.totalLiabilities;
  result.equity.totalEquity = result.totalEquity;
  result.netAssets = result.totalAssets - result.totalLiabilities;
  result.workingCapital = result.currentAssets - result.currentLiabilities;
  result.currentRatio = result.currentLiabilities > 0 ? result.currentAssets / result.currentLiabilities : 0;
  result.quickRatio = result.currentRatio * 0.8; // Approximation
  result.debtToEquityRatio = result.totalEquity > 0 ? result.totalLiabilities / result.totalEquity : 0;
  result.equityRatio = result.totalAssets > 0 ? (result.totalEquity / result.totalAssets) * 100 : 0;
  
  // Add summary
  result.summary = {
    netAssets: result.netAssets,
    workingCapital: result.workingCapital,
    currentRatio: result.currentRatio,
    quickRatio: result.quickRatio,
    debtToEquityRatio: result.debtToEquityRatio,
    equityRatio: result.equityRatio
  };
  
  return result;
}

async function importBalanceSheet(filePath, periodStart, periodEnd, description) {
  console.log(`\nImporting ${description}...`);
  
  try {
    // Read Excel file
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
    
    // Parse the balance sheet
    const processedData = parseXeroBalanceSheet(data, 2);
    
    console.log(`- Parsed balance sheet:`);
    console.log(`  Current Assets: £${processedData.currentAssets.toLocaleString()}`);
    console.log(`  Non-Current Assets: £${processedData.nonCurrentAssets.toLocaleString()}`);
    console.log(`  Total Assets: £${processedData.totalAssets.toLocaleString()}`);
    console.log(`  Current Liabilities: £${processedData.currentLiabilities.toLocaleString()}`);
    console.log(`  Non-Current Liabilities: £${processedData.nonCurrentLiabilities.toLocaleString()}`);
    console.log(`  Total Liabilities: £${processedData.totalLiabilities.toLocaleString()}`);
    console.log(`  Equity: £${processedData.totalEquity.toLocaleString()}`);
    console.log(`  Net Assets: £${processedData.netAssets.toLocaleString()}`);
    
    // Create import record
    const importedReport = await prisma.importedReport.create({
      data: {
        type: 'BALANCE_SHEET',
        source: 'excel',
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        importedBy: 'ajarrar@trademanenterprise.com',
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

async function main() {
  console.log('Balance Sheet Import with Proper Parser\n');
  
  try {
    // Clean up first
    console.log('Cleaning up existing imports...');
    await prisma.reportData.deleteMany({ where: { reportType: 'BALANCE_SHEET' } });
    await prisma.importedReport.deleteMany({ where: { type: 'BALANCE_SHEET' } });
    console.log('✓ Cleanup complete\n');
    
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
    console.log('\nSummary of imported data:');
    
    // Verify the imports
    const imports = await prisma.importedReport.findMany({
      where: { type: 'BALANCE_SHEET' },
      orderBy: { periodEnd: 'desc' }
    });
    
    for (const imp of imports) {
      const data = JSON.parse(imp.processedData);
      console.log(`\n${imp.fileName}:`);
      console.log(`  Period: ${new Date(imp.periodEnd).toLocaleDateString()}`);
      console.log(`  Total Assets: £${data.totalAssets?.toLocaleString()}`);
      console.log(`  Net Assets: £${data.netAssets?.toLocaleString()}`);
    }
    
    console.log('\nNext steps:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Visit http://localhost:3000/reports/detailed-reports/balance-sheet');
    console.log('3. Click "View Imports" to see the unified history');
    console.log('4. Test switching between imported data and API data');
    
  } catch (error) {
    console.error('\n❌ Import process failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();