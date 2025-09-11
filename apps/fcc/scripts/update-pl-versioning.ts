import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

/**
 * This script demonstrates how to handle multiple P&L fetches for the same period
 * by using the version field in the ReportData table
 */

async function handleVersionedPLData() {
  console.log('=== P&L VERSIONING CAPABILITIES ===\n');
  
  try {
    // Example: Check existing versions for a specific period
    const periodStart = new Date('2024-01-01T00:00:00.000Z');
    const periodEnd = new Date('2024-01-31T23:59:59.999Z');
    
    // Find all versions for this period
    const existingVersions = await prisma.reportData.findMany({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart,
        periodEnd
      },
      orderBy: {
        version: 'desc'
      }
    });
    
    console.log(`Found ${existingVersions.length} version(s) for January 2024`);
    
    if (existingVersions.length > 0) {
      console.log('\nExisting versions:');
      existingVersions.forEach(v => {
        const data = JSON.parse(v.data);
        console.log(`  Version ${v.version}: Created ${v.createdAt.toISOString()}, Revenue: £${data.totalRevenue || 0}`);
      });
      
      // To save a new version, increment the version number
      const nextVersion = Math.max(...existingVersions.map(v => v.version)) + 1;
      console.log(`\nNext version would be: ${nextVersion}`);
    }
    
    // Example: Query to get the latest active version
    const latestActive = await prisma.reportData.findFirst({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart,
        periodEnd,
        isActive: true
      },
      orderBy: {
        version: 'desc'
      }
    });
    
    if (latestActive) {
      console.log(`\nLatest active version: ${latestActive.version}`);
    }
    
    // Show how the unique constraint works
    console.log('\n=== DATABASE CONSTRAINTS ===');
    console.log('Unique constraint: [reportType, periodStart, periodEnd, version]');
    console.log('This means:');
    console.log('  ✅ Can have multiple versions of the same period');
    console.log('  ✅ Each version is tracked separately');
    console.log('  ✅ Can mark old versions as inactive (isActive=false)');
    console.log('  ❌ Cannot have duplicate version numbers for the same period');
    
  } catch (error) {
    console.error('Error:', error);
    structuredLogger.error('[Versioning Check] Error', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
handleVersionedPLData();