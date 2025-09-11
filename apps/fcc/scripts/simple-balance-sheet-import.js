const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

// Simple balance sheet parser
function parseBalanceSheet(data, targetDate) {
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
    equityRatio: 0,
    summary: {}
  };

  // Find the column with our target date
  let dateColumn = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      for (let j = 0; j < row.length; j++) {
        if (row[j] && row[j].toString().trim() === targetDate) {
          dateColumn = j;
          console.log(`Found date column at index ${j} in row ${i}`);
          break;
        }
      }
    }
    if (dateColumn >= 0) break;
  }

  // If we didn't find the exact date, use the last numeric column
  if (dateColumn < 0) {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (Array.isArray(row)) {
        for (let j = row.length - 1; j >= 0; j--) {
          if (row[j] && !isNaN(parseFloat(row[j].toString().replace(/[,£$]/g, '')))) {
            dateColumn = j;
            break;
          }
        }
      }
      if (dateColumn >= 0) break;
    }
  }

  console.log(`Using column ${dateColumn} for balance sheet values`);

  // Parse the data rows
  let currentSection = '';
  let currentSubsection = '';
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const accountName = row[0]?.toString().trim() || '';
    const value = dateColumn >= 0 && row[dateColumn] ? 
      parseFloat(row[dateColumn].toString().replace(/[,£$()]/g, '').replace(/^\((.+)\)$/, '-$1')) || 0 : 0;
    
    // Detect sections - check for Fixed Assets first
    if (accountName.toLowerCase() === 'fixed assets' || accountName.toLowerCase() === 'current assets') {
      currentSection = 'assets';
      currentSubsection = accountName.toLowerCase() === 'current assets' ? 'currentAssets' : 'nonCurrentAssets';
      continue;
    } else if (accountName.toLowerCase() === 'current liabilities') {
      currentSection = 'liabilities';
      currentSubsection = 'currentLiabilities';
      continue;
    } else if (accountName.toLowerCase() === 'non-current liabilities' || accountName.toLowerCase() === 'long term liabilities') {
      currentSection = 'liabilities';
      currentSubsection = 'nonCurrentLiabilities';
      continue;
    } else if (accountName.toUpperCase() === 'EQUITY' || accountName.toUpperCase().includes('CAPITAL')) {
      currentSection = 'equity';
      continue;
    }
    
    // Detect subsections
    if (accountName.toLowerCase().includes('current asset')) {
      currentSubsection = 'currentAssets';
      continue;
    } else if (accountName.toLowerCase().includes('non-current asset') || accountName.toLowerCase().includes('noncurrent asset')) {
      currentSubsection = 'nonCurrentAssets';
      continue;
    } else if (accountName.toLowerCase().includes('current liabilit')) {
      currentSubsection = 'currentLiabilities';
      continue;
    } else if (accountName.toLowerCase().includes('non-current liabilit') || accountName.toLowerCase().includes('noncurrent liabilit')) {
      currentSubsection = 'nonCurrentLiabilities';
      continue;
    }
    
    // Skip empty rows and totals
    if (!accountName || accountName.toLowerCase().includes('total')) continue;
    
    // Only process if we have a value
    if (value === 0) continue;
    
    // Add account to appropriate section
    const account = {
      accountId: `account-${i}`,
      accountName: accountName,
      balance: value
    };
    
    console.log(`Processing: ${accountName} = ${value} (section: ${currentSection}, subsection: ${currentSubsection})`);
    
    if (currentSection === 'assets') {
      if (currentSubsection === 'currentAssets') {
        result.assets.currentAssets.push(account);
        result.currentAssets += value;
      } else if (currentSubsection === 'nonCurrentAssets') {
        result.assets.nonCurrentAssets.push(account);
        result.nonCurrentAssets += value;
      }
      result.totalAssets += value;
    } else if (currentSection === 'liabilities') {
      if (currentSubsection === 'currentLiabilities') {
        result.liabilities.currentLiabilities.push(account);
        result.currentLiabilities += Math.abs(value);
      } else if (currentSubsection === 'nonCurrentLiabilities') {
        result.liabilities.nonCurrentLiabilities.push(account);
        result.nonCurrentLiabilities += Math.abs(value);
      }
      result.totalLiabilities += Math.abs(value);
    } else if (currentSection === 'equity') {
      result.equity.accounts.push(account);
      result.totalEquity += value;
    }
  }
  
  // Calculate summary metrics
  result.assets.totalAssets = result.totalAssets;
  result.liabilities.totalLiabilities = result.totalLiabilities;
  result.equity.totalEquity = result.totalEquity;
  result.netAssets = result.totalAssets - result.totalLiabilities;
  result.workingCapital = result.currentAssets - result.currentLiabilities;
  result.currentRatio = result.currentLiabilities > 0 ? result.currentAssets / result.currentLiabilities : 0;
  result.quickRatio = result.currentRatio; // Simplified
  result.debtToEquityRatio = result.totalEquity > 0 ? result.totalLiabilities / result.totalEquity : 0;
  result.equityRatio = result.totalAssets > 0 ? (result.totalEquity / result.totalAssets) * 100 : 0;
  
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
    
    // Format the target date - for June 30, the file uses "30 Jun 2025"
    // Use UTC to avoid timezone issues
    const endDate = new Date(periodEnd + 'T00:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Extract the day from the original string to avoid timezone issues
    const day = parseInt(periodEnd.split('-')[2]);
    const monthIndex = parseInt(periodEnd.split('-')[1]) - 1;
    const year = parseInt(periodEnd.split('-')[0]);
    const targetDate = `${day} ${monthNames[monthIndex]} ${year}`;
    console.log(`- Looking for date column: ${targetDate}`);
    
    // Parse the data
    const processedData = parseBalanceSheet(data, targetDate);
    
    console.log(`- Parsed data summary:`);
    console.log(`  Total Assets: £${processedData.totalAssets?.toLocaleString()}`);
    console.log(`  Total Liabilities: £${processedData.totalLiabilities?.toLocaleString()}`);
    console.log(`  Net Assets: £${processedData.netAssets?.toLocaleString()}`);
    
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
  console.log('Simple Balance Sheet Import\n');
  
  try {
    // Import June 2025 balance sheet
    await importBalanceSheet(
      path.join(__dirname, '..', 'data', 'balance sheet.xlsx'),
      '2025-01-01',
      '2025-06-30',
      'June 2025 Balance Sheet'
    );
    
    // Import May 2025 balance sheet (note: file is dated 31 May)
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