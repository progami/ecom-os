import * as XLSX from 'xlsx';

const filePath = './data/amazon_fee.xlsx';
console.log(`📖 Checking Excel file structure: ${filePath}\n`);

try {
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  
  // List all sheet names
  console.log('📋 Available sheets:');
  console.log('==================');
  workbook.SheetNames.forEach(name => {
    console.log(`- ${name}`);
  });
  
  // Check standard sheet structure
  const standardSheet = workbook.Sheets['standard'];
  if (standardSheet) {
    console.log('\n📦 Standard Sheet Structure:');
    console.log('===========================');
    
    // Get first few rows
    const data = XLSX.utils.sheet_to_json(standardSheet, { header: 1 });
    
    // Show headers
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      
      // Show first few data rows
      console.log('\nFirst 3 data rows:');
      for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
        console.log(`Row ${i}:`, data[i]);
      }
    }
  }
  
  // Check lowprice sheet structure
  const lowpriceSheet = workbook.Sheets['lowprice'];
  if (lowpriceSheet) {
    console.log('\n💰 Low Price Sheet Structure:');
    console.log('=============================');
    
    const data = XLSX.utils.sheet_to_json(lowpriceSheet, { header: 1 });
    
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      
      console.log('\nFirst 3 data rows:');
      for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
        console.log(`Row ${i}:`, data[i]);
      }
    }
  }
  
  // Check sipp sheet structure
  const sippSheet = workbook.Sheets['sipp'];
  if (sippSheet) {
    console.log('\n🎯 SIPP Sheet Structure:');
    console.log('========================');
    
    const data = XLSX.utils.sheet_to_json(sippSheet, { header: 1 });
    
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      
      console.log('\nFirst 3 data rows:');
      for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
        console.log(`Row ${i}:`, data[i]);
      }
    }
  }
  
} catch (error) {
  console.error('Error reading Excel file:', error);
}