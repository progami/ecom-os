#!/usr/bin/env tsx

import axios from 'axios';

async function testXeroBalanceSheet() {
  try {
    console.log('🔍 Testing Xero Balance Sheet API...\n');
    
    const baseUrl = 'https://localhost:3003';
    const endpoint = '/api/v1/xero/reports/balance-sheet';
    
    // First, let's try to access the endpoint
    console.log(`📡 Calling: ${baseUrl}${endpoint}`);
    console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}\n`);
    
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      params: {
        date: new Date().toISOString().split('T')[0] // Today's date
      },
      headers: {
        'Accept': 'application/json',
      },
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false // For self-signed certificate
      })
    });
    
    console.log('✅ Success! Balance Sheet data received:\n');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('❌ Error calling Balance Sheet API:\n');
    
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Response:`, JSON.stringify(error.response.data, null, 2));
      
      // If it's an authentication issue, provide guidance
      if (error.response.status === 401 || error.response.data?.error?.includes('auth')) {
        console.log('\n💡 Authentication required. You may need to:');
        console.log('1. Login to the application');
        console.log('2. Connect to Xero via the UI');
        console.log('3. Or use the Xero OAuth flow');
      }
    } else {
      console.log('Error:', error.message);
    }
  }
}

testXeroBalanceSheet();