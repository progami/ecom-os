#!/usr/bin/env ts-node

import { structuredLogger } from '../lib/logger';
import fs from 'fs';

async function testCashSummaryAPI() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
  
  structuredLogger.info('[Test] Starting Cash Summary API test');
  
  try {
    // Test with different period configurations
    const testCases = [
      { 
        name: 'Current month only',
        params: 'periods=1'
      },
      {
        name: 'Last 5 months',
        params: 'periods=5'
      },
      {
        name: 'Specific month',
        params: 'month=7&year=2024&periods=1'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n=== Testing: ${testCase.name} ===`);
      
      const url = `${baseUrl}/api/v1/xero/reports/cash-summary?${testCase.params}`;
      console.log(`URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add session cookie if needed
          'Cookie': process.env.SESSION_COOKIE || ''
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        console.error('Response:', JSON.stringify(data, null, 2));
        continue;
      }
      
      // Log summary of the response
      console.log(`Success! Status: ${response.status}`);
      console.log(`Periods returned: ${data.periods?.length || 0}`);
      
      if (data.periods && data.periods.length > 0) {
        console.log('\nPeriod Summary:');
        data.periods.forEach((period: any) => {
          console.log(`  ${period.month}: Net Cash Movement = ${period.netCashMovement || 0}`);
        });
        
        // Write detailed response to file
        const fileName = `cash-summary-${testCase.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
        console.log(`\nDetailed response written to: ${fileName}`);
      }
    }
    
  } catch (error) {
    structuredLogger.error('[Test] Error testing Cash Summary API', error);
    console.error('Error:', error);
  }
}

// Run the test
if (require.main === module) {
  testCashSummaryAPI()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}