import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const cookie = 'user_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHl2eGJlcWkwMDAwbWF3azU2NzQ3dDJlIiwiZW1haWwiOiJqLmFtamFkQHN3aWZ0Y29tcGxldGVkLmNvbSIsInJvbGUiOiJVU0VSIiwiZmlyc3ROYW1lIjoiSmFycmFyIiwibGFzdE5hbWUiOiJBbWphZCIsImF2YXRhclVybCI6bnVsbCwiaWF0IjoxNzMwNDAzNTk0LCJleHAiOjE3MzI5OTU1OTQsImF1ZCI6WyJib29ra2VlcGluZy1hcHAiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6MzAwMyJ9.Kb5XhBjY5zEK5LCU8tI58IwGfnLOXbgj95bBPLNJL1Y';

async function testVersioning() {
  console.log('=== TESTING P&L VERSIONING CAPABILITY ===\n');
  
  try {
    // Test with December 2024 (we already have this data)
    const testDate = '2024-12-31';
    const testPeriod = 'MONTH';
    
    console.log(`📊 Testing versioning with ${testPeriod} ending ${testDate}\n`);
    
    // Check existing versions before fetch
    const periodStart = new Date('2024-12-01T00:00:00.000Z');
    const periodEnd = new Date('2024-12-31T23:59:59.999Z');
    
    const existingBefore = await prisma.reportData.findMany({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd }
      },
      orderBy: {
        version: 'desc'
      }
    });
    
    console.log(`Existing versions before fetch: ${existingBefore.length}`);
    existingBefore.forEach(v => {
      console.log(`  Version ${v.version}: Active=${v.isActive}, Created=${v.createdAt.toISOString()}`);
    });
    
    // Fetch the same period again with the updated API
    console.log('\n📥 Fetching December 2024 again...');
    const url = `https://localhost:3003/api/v1/xero/reports/profit-loss?date=${testDate}&timeframe=${testPeriod}&periods=1&refresh=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      },
      // @ts-ignore
      agent
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Successfully fetched: Revenue £${data.totalRevenue}, Net Profit £${data.netProfit}`);
    } else {
      console.log(`❌ Fetch failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(errorText);
    }
    
    // Check versions after fetch
    const existingAfter = await prisma.reportData.findMany({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd }
      },
      orderBy: {
        version: 'desc'
      }
    });
    
    console.log(`\nExisting versions after fetch: ${existingAfter.length}`);
    existingAfter.forEach(v => {
      const data = JSON.parse(v.data);
      console.log(`  Version ${v.version}: Active=${v.isActive}, Revenue=£${data.totalRevenue || 0}, Created=${v.createdAt.toISOString()}`);
    });
    
    // Summary
    console.log('\n=== VERSIONING TEST SUMMARY ===');
    console.log(`Before fetch: ${existingBefore.length} version(s)`);
    console.log(`After fetch: ${existingAfter.length} version(s)`);
    
    if (existingAfter.length > existingBefore.length) {
      console.log('✅ New version created successfully!');
      console.log('✅ Database can handle multiple fetches of the same period');
    } else if (existingAfter.length === existingBefore.length) {
      console.log('ℹ️  No new version created (might need to check the API implementation)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    structuredLogger.error('[Versioning Test] Error', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testVersioning();