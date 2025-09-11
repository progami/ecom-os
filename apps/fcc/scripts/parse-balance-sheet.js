const XLSX = require('xlsx');
const path = require('path');

// Path to the balance sheet file
const filePath = path.join(__dirname, '../data/balance sheet.xlsx');

try {
  // Read the workbook
  const workbook = XLSX.readFile(filePath);
  
  // Get the first sheet name
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON to see the structure
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, // Use array of arrays
    raw: true, // Get raw values
    defval: null // Default value for empty cells
  });
  
  console.log('=== Balance Sheet Data Structure ===\n');
  console.log('Total rows:', jsonData.length);
  console.log('\n=== First 40 rows (showing columns A, B, C) ===\n');
  
  // Print first 40 rows to understand structure
  for (let i = 0; i < Math.min(40, jsonData.length); i++) {
    const row = jsonData[i];
    if (row && row.length > 0) {
      console.log(`Row ${i + 1}:`, {
        A: row[0] || '',
        B: row[1] || '',
        C: row[2] || ''
      });
    }
  }
  
  // Extract specific values based on the structure
  console.log('\n=== Extracting Account Values ===\n');
  
  // Look for specific patterns in the data
  let bankAccounts = [];
  let currentAssets = [];
  let fixedAssets = [];
  let currentLiabilities = [];
  let equity = [];
  let currentSection = null;
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length < 2) continue;
    
    const accountName = row[1]; // Column B
    const value = row[2]; // Column C
    
    // Detect section headers
    if (typeof accountName === 'string') {
      if (accountName.includes('Bank') && !accountName.includes('Total')) {
        currentSection = 'bank';
      } else if (accountName.includes('Current Assets') && !accountName.includes('Total')) {
        currentSection = 'currentAssets';
      } else if (accountName.includes('Fixed Assets') && !accountName.includes('Total')) {
        currentSection = 'fixedAssets';
      } else if (accountName.includes('Current Liabilities') && !accountName.includes('Total')) {
        currentSection = 'currentLiabilities';
      } else if (accountName.includes('Equity') && !accountName.includes('Total')) {
        currentSection = 'equity';
      }
      
      // Store account values if it's not a section header or total
      if (value !== null && value !== undefined && !accountName.includes('Total') && 
          !accountName.includes('Assets') && !accountName.includes('Liabilities') && 
          !accountName.includes('Equity') && accountName.trim() !== '') {
        
        const accountData = {
          row: i + 1,
          name: accountName,
          value: parseFloat(value) || 0
        };
        
        // Add to appropriate section
        if (currentSection === 'bank' || (accountName.includes('Bank') || accountName.includes('Cash'))) {
          bankAccounts.push(accountData);
        } else if (currentSection === 'currentAssets') {
          currentAssets.push(accountData);
        } else if (currentSection === 'fixedAssets') {
          fixedAssets.push(accountData);
        } else if (currentSection === 'currentLiabilities') {
          currentLiabilities.push(accountData);
        } else if (currentSection === 'equity') {
          equity.push(accountData);
        }
      }
    }
  }
  
  // Print extracted accounts
  console.log('\n=== Bank Accounts ===');
  let totalBankValue = 0;
  bankAccounts.forEach(acc => {
    console.log(`${acc.name}: ${acc.value.toFixed(2)}`);
    totalBankValue += acc.value;
  });
  console.log(`Total Bank/Cash: ${totalBankValue.toFixed(2)}`);
  
  console.log('\n=== Current Assets (excluding Bank) ===');
  let totalCurrentAssetsExBank = 0;
  currentAssets.forEach(acc => {
    console.log(`${acc.name}: ${acc.value.toFixed(2)}`);
    totalCurrentAssetsExBank += acc.value;
  });
  console.log(`Total Current Assets (ex Bank): ${totalCurrentAssetsExBank.toFixed(2)}`);
  
  console.log('\n=== Fixed Assets ===');
  let totalFixedAssets = 0;
  fixedAssets.forEach(acc => {
    console.log(`${acc.name}: ${acc.value.toFixed(2)}`);
    totalFixedAssets += acc.value;
  });
  console.log(`Total Fixed Assets: ${totalFixedAssets.toFixed(2)}`);
  
  console.log('\n=== Current Liabilities ===');
  let totalCurrentLiabilities = 0;
  currentLiabilities.forEach(acc => {
    console.log(`${acc.name}: ${acc.value.toFixed(2)}`);
    totalCurrentLiabilities += acc.value;
  });
  console.log(`Total Current Liabilities: ${totalCurrentLiabilities.toFixed(2)}`);
  
  console.log('\n=== Equity ===');
  let totalEquity = 0;
  equity.forEach(acc => {
    console.log(`${acc.name}: ${acc.value.toFixed(2)}`);
    totalEquity += acc.value;
  });
  console.log(`Total Equity: ${totalEquity.toFixed(2)}`);
  
  console.log('\n=== Summary Totals ===');
  console.log(`Total Assets: ${(totalBankValue + totalCurrentAssetsExBank + totalFixedAssets).toFixed(2)}`);
  console.log(`Total Liabilities: ${totalCurrentLiabilities.toFixed(2)}`);
  console.log(`Net Assets: ${((totalBankValue + totalCurrentAssetsExBank + totalFixedAssets) - totalCurrentLiabilities).toFixed(2)}`);
  
  // Look for specific accounts mentioned by the user
  console.log('\n=== Looking for Specific Accounts ===');
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row[1]) {
      const accountName = String(row[1]).toLowerCase();
      if (accountName.includes('inventory') || accountName.includes('stock')) {
        console.log(`Found Inventory at row ${i + 1}: ${row[1]} = ${row[2]}`);
      }
    }
  }
  
} catch (error) {
  console.error('Error reading Excel file:', error);
}