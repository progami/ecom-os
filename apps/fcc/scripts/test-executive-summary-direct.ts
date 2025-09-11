import { PrismaClient } from '@prisma/client';
import { getXeroClientFromDatabase } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

async function testExecutiveSummary() {
  console.log('=== TESTING EXECUTIVE SUMMARY API DIRECTLY ===\n');
  
  try {
    // Connect to database
    await prisma.$connect();
    
    // Get the first user (for tenant ID)
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found in database');
    }
    
    const tenantId = 'ca9f2956-55ce-47de-8e9f-b1f74c26098f';
    console.log(`Using tenant ID: ${tenantId}\n`);
    
    // Get Xero client from database
    const xeroClient = await getXeroClientFromDatabase(tenantId);
    if (!xeroClient) {
      throw new Error('Failed to get Xero client');
    }
    
    // Test Executive Summary for a specific month
    const fromDate = new Date('2024-01-01');
    const toDate = new Date('2024-01-31');
    
    console.log(`📊 Fetching Executive Summary for January 2024...`);
    console.log(`   From: ${fromDate.toISOString()}`);
    console.log(`   To: ${toDate.toISOString()}\n`);
    
    try {
      const response = await xeroClient.accountingApi.getReportExecutiveSummary(
        tenantId,
        fromDate,
        toDate
      );
      
      console.log('✅ Executive Summary Response:');
      console.log(`   Status: ${response.response.status}`);
      console.log(`   Has Body: ${!!response.body}`);
      console.log(`   Body Type: ${typeof response.body}`);
      
      if (response.body) {
        console.log(`   Has Reports: ${!!response.body.reports}`);
        console.log(`   Report Count: ${response.body.reports?.length || 0}`);
        
        if (response.body.reports && response.body.reports.length > 0) {
          const report = response.body.reports[0];
          console.log(`\n📋 Report Details:`);
          console.log(`   Report Name: ${report.reportName}`);
          console.log(`   Report Date: ${report.reportDate}`);
          console.log(`   Row Count: ${report.rows?.length || 0}`);
          
          // Log all sections
          console.log(`\n📑 Sections Found:`);
          if (report.rows) {
            report.rows.forEach((section: any, index: number) => {
              if (section.rowType === 'Section') {
                console.log(`   ${index}: "${section.title || 'Untitled'}" (${section.rows?.length || 0} rows)`);
                
                // If it's the Cash section, log the details
                if (section.title?.toLowerCase() === 'cash' && section.rows) {
                  console.log(`\n   💰 Cash Section Details:`);
                  section.rows.forEach((row: any) => {
                    if (row.cells && row.cells.length >= 2) {
                      const label = row.cells[0]?.value || '';
                      const value = row.cells[1]?.value || '';
                      console.log(`      - ${label}: ${value}`);
                    }
                  });
                }
              }
            });
          }
          
          // Log the full response for debugging
          console.log(`\n🔍 Full Report Structure:`);
          console.log(JSON.stringify(report, null, 2));
        }
      } else {
        console.log('\n❌ No body in response!');
      }
      
    } catch (error: any) {
      console.error('\n❌ Error calling Executive Summary API:');
      console.error(`   Message: ${error.message}`);
      console.error(`   Status Code: ${error.statusCode || error.response?.statusCode || 'N/A'}`);
      console.error(`   Response: ${JSON.stringify(error.response?.data || error.response?.body || 'N/A')}`);
      
      if (error.response?.headers) {
        console.error(`   Auth Header: ${error.response.headers['www-authenticate'] || 'N/A'}`);
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testExecutiveSummary()
  .then(() => console.log('\n✅ Test completed'))
  .catch(error => console.error('Test failed:', error));