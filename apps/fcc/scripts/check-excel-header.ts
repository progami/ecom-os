import * as XLSX from 'xlsx';

const workbook = XLSX.readFile('/Users/jarraramjad/Documents/ecom_os/FCC/data/TRADEMAN_ENTERPRISE_LTD_-_Profit_and_Loss (1).xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Excel file header rows:');
for (let i = 0; i < 10; i++) {
  const row = data[i] as any[];
  if (row && row.length > 0) {
    console.log(`Row ${i}: ${JSON.stringify(row)}`);
  }
}