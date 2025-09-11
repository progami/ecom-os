const fetch = require('node-fetch');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function testBalanceSheetRefresh() {
  try {
    console.log('Testing Balance Sheet API with refresh=true...\n');
    
    const response = await fetch('https://localhost:3003/api/v1/xero/reports/balance-sheet?refresh=true', {
      agent,
      headers: {
        'Cookie': 'your-auth-cookie-here' // You'll need to add the actual cookie
      }
    });
    
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:');
    console.log('- Source:', data.source);
    console.log('- Has importedReportId:', !!data.importedReportId);
    console.log('- Error:', data.error);
    console.log('- Message:', data.message);
    
    if (data.source === 'database') {
      console.log('\n⚠️  API returned database data even with refresh=true');
      console.log('This suggests the Xero API call failed or was not attempted');
    } else if (data.source === 'xero') {
      console.log('\n✅ Successfully fetched from Xero!');
      console.log('ImportedReport ID:', data.importedReportId);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testBalanceSheetRefresh();