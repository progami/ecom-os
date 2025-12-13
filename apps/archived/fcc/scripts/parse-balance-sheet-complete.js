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
  
  console.log('=== Complete Balance Sheet Data ===\n');
  console.log('Total rows in file:', jsonData.length);
  
  // Print ALL rows to see complete structure
  console.log('\n=== All Rows with Values ===\n');
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row.length > 0) {
      // Check if any cell in the row has a value
      const hasValue = row.some(cell => cell !== null && cell !== undefined && cell !== '');
      if (hasValue) {
        console.log(`Row ${i + 1}:`, {
          A: row[0] || '',
          B: row[1] || '',
          C: row[2] !== null && row[2] !== undefined ? row[2] : ''
        });
      }
    }
  }
  
  // Now let's look for any hidden or formula-calculated totals
  console.log('\n=== Looking for Formula Results ===\n');
  
  // Get all cells from the worksheet
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({r: R, c: C});
      const cell = worksheet[cellAddress];
      
      if (cell && cell.f) { // If cell has a formula
        console.log(`Cell ${cellAddress} has formula: ${cell.f}, value: ${cell.v}`);
      }
    }
  }
  
  // Check for any additional sheets
  console.log('\n=== Workbook Information ===');
  console.log('Number of sheets:', workbook.SheetNames.length);
  console.log('Sheet names:', workbook.SheetNames);
  
  // Look specifically at rows that might contain totals
  console.log('\n=== Rows with "Total" in them ===');
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row.length > 0) {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (rowStr.includes('total')) {
        console.log(`Row ${i + 1}:`, row);
      }
    }
  }
  
  // Extract values more carefully, including edge cases
  console.log('\n=== Detailed Value Extraction ===\n');
  
  let allValues = [];
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row.length >= 3 && row[2] !== null && row[2] !== undefined && row[2] !== '') {
      const value = parseFloat(row[2]);
      if (!isNaN(value) && value !== 0) {
        allValues.push({
          row: i + 1,
          colB: row[1] || '',
          value: value
        });
      }
    }
  }
  
  console.log('All non-zero values found:');
  allValues.forEach(item => {
    console.log(`Row ${item.row}: ${item.colB} = ${item.value}`);
  });
  
  // Calculate totals based on accounting rules
  console.log('\n=== Calculated Totals Based on Values ===');
  
  // Sum all positive values in certain ranges
  let assetValues = allValues.filter(item => 
    (item.row >= 9 && item.row <= 28) && item.value > 0
  );
  let liabilityValues = allValues.filter(item => 
    (item.row >= 32 && item.row <= 41) && item.colB !== 'Directors\' Loan Account'
  );
  
  const totalAssetSum = assetValues.reduce((sum, item) => sum + item.value, 0);
  const totalLiabilitySum = liabilityValues.reduce((sum, item) => sum + Math.abs(item.value), 0);
  
  console.log('\nAsset values sum:', totalAssetSum.toFixed(2));
  console.log('Liability values sum:', totalLiabilitySum.toFixed(2));
  
  // Check if there are any cells beyond column C
  console.log('\n=== Checking for data in columns beyond C ===');
  for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
    const row = jsonData[i];
    if (row && row.length > 3) {
      console.log(`Row ${i + 1} has ${row.length} columns:`, row);
    }
  }
  
} catch (error) {
  console.error('Error reading Excel file:', error);
}