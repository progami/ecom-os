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
  
  console.log('=== Balance Sheet Data Analysis ===\n');
  
  // Initialize categories
  let fixedAssets = [];
  let bankAccounts = [];
  let currentAssets = [];
  let currentLiabilities = [];
  let equity = [];
  
  // Track which section we're in
  let currentSection = null;
  let inSubSection = false;
  
  // Process each row
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length < 2) continue;
    
    const colA = row[0] || '';
    const colB = row[1] || '';
    const colC = row[2];
    
    // Section detection based on column A
    if (colA === 'Fixed Assets') {
      currentSection = 'fixedAssets';
      inSubSection = false;
      continue;
    } else if (colA === 'Current Assets') {
      currentSection = 'currentAssets';
      inSubSection = false;
      continue;
    } else if (colA === 'Creditors: amounts falling due within one year') {
      currentSection = 'currentLiabilities';
      inSubSection = false;
      continue;
    } else if (colA === 'Capital and Reserves') {
      currentSection = 'equity';
      inSubSection = false;
      continue;
    } else if (colA.includes('Total')) {
      // Skip total rows
      continue;
    }
    
    // Sub-section detection based on column B
    if (colB === 'Cash at bank and in hand') {
      inSubSection = 'bank';
      continue;
    } else if (colB.includes('Total')) {
      // Skip total lines
      inSubSection = false;
      continue;
    }
    
    // Extract account data if we have a value in column C
    if (colB && colC !== null && colC !== undefined && colC !== '') {
      const accountData = {
        row: i + 1,
        name: colB,
        value: parseFloat(colC) || 0
      };
      
      // Categorize based on current section and subsection
      if (currentSection === 'fixedAssets') {
        fixedAssets.push(accountData);
      } else if (currentSection === 'currentAssets') {
        if (inSubSection === 'bank') {
          bankAccounts.push(accountData);
        } else {
          currentAssets.push(accountData);
        }
      } else if (currentSection === 'currentLiabilities') {
        currentLiabilities.push(accountData);
      } else if (currentSection === 'equity') {
        equity.push(accountData);
      }
    }
  }
  
  // Calculate totals
  console.log('=== Fixed Assets ===');
  let totalFixedAssets = 0;
  fixedAssets.forEach(acc => {
    console.log(`Row ${acc.row}: ${acc.name} = ${acc.value.toFixed(2)}`);
    totalFixedAssets += acc.value;
  });
  console.log(`Total Fixed Assets: ${totalFixedAssets.toFixed(2)}`);
  
  console.log('\n=== Bank Accounts (Cash at bank and in hand) ===');
  let totalCash = 0;
  bankAccounts.forEach(acc => {
    console.log(`Row ${acc.row}: ${acc.name} = ${acc.value.toFixed(2)}`);
    totalCash += acc.value;
  });
  console.log(`Total Cash: ${totalCash.toFixed(2)}`);
  
  console.log('\n=== Other Current Assets ===');
  let totalOtherCurrentAssets = 0;
  currentAssets.forEach(acc => {
    console.log(`Row ${acc.row}: ${acc.name} = ${acc.value.toFixed(2)}`);
    totalOtherCurrentAssets += acc.value;
  });
  console.log(`Total Other Current Assets: ${totalOtherCurrentAssets.toFixed(2)}`);
  console.log(`Total Current Assets (Cash + Other): ${(totalCash + totalOtherCurrentAssets).toFixed(2)}`);
  
  console.log('\n=== Current Liabilities ===');
  let totalCurrentLiabilities = 0;
  currentLiabilities.forEach(acc => {
    console.log(`Row ${acc.row}: ${acc.name} = ${acc.value.toFixed(2)}`);
    totalCurrentLiabilities += acc.value;
  });
  console.log(`Total Current Liabilities: ${totalCurrentLiabilities.toFixed(2)}`);
  
  console.log('\n=== Equity ===');
  let totalEquity = 0;
  equity.forEach(acc => {
    console.log(`Row ${acc.row}: ${acc.name} = ${acc.value.toFixed(2)}`);
    totalEquity += acc.value;
  });
  console.log(`Total Equity: ${totalEquity.toFixed(2)}`);
  
  // Summary calculations
  const totalAssets = totalFixedAssets + totalCash + totalOtherCurrentAssets;
  const netAssets = totalAssets - totalCurrentLiabilities;
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total Fixed Assets: ${totalFixedAssets.toFixed(2)}`);
  console.log(`Total Current Assets: ${(totalCash + totalOtherCurrentAssets).toFixed(2)}`);
  console.log(`  - Cash: ${totalCash.toFixed(2)}`);
  console.log(`  - Other Current Assets: ${totalOtherCurrentAssets.toFixed(2)}`);
  console.log(`Total Assets: ${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ${totalCurrentLiabilities.toFixed(2)}`);
  console.log(`Net Assets: ${netAssets.toFixed(2)}`);
  console.log(`Total Equity: ${totalEquity.toFixed(2)}`);
  
  // Look for specific accounts
  console.log('\n=== Specific Account Values ===');
  const allAccounts = [...fixedAssets, ...bankAccounts, ...currentAssets, ...currentLiabilities, ...equity];
  
  // Find inventory
  const inventory = allAccounts.find(acc => acc.name.toLowerCase().includes('inventory'));
  if (inventory) {
    console.log(`Inventory: ${inventory.value.toFixed(2)}`);
  }
  
  // Expected values from API
  console.log('\n=== Comparison with Expected API Values ===');
  console.log(`Expected Total Assets: 262012.02 | Actual: ${totalAssets.toFixed(2)}`);
  console.log(`Expected Total Liabilities: 68131.02 | Actual: ${totalCurrentLiabilities.toFixed(2)}`);
  console.log(`Expected Net Assets: 193881.00 | Actual: ${netAssets.toFixed(2)}`);
  console.log(`Expected Cash: 179272.78 | Actual: ${totalCash.toFixed(2)}`);
  console.log(`Expected Inventory: 79082.28 | Actual: ${inventory ? inventory.value.toFixed(2) : 'Not found'}`);
  
} catch (error) {
  console.error('Error reading Excel file:', error);
}