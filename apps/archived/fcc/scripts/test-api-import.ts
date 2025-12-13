import { prisma } from '../lib/prisma';

async function testAPIImport() {
  try {
    console.log('Creating test API import entry...\n');
    
    const importedReport = await prisma.importedReport.create({
      data: {
        type: 'BALANCE_SHEET',
        source: 'API',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date(),
        importedBy: 'test@example.com',
        status: 'COMPLETED',
        recordCount: 50,
        rawData: JSON.stringify({ test: true }),
        processedData: JSON.stringify({ test: true }),
        metadata: JSON.stringify({
          fetchDate: new Date().toISOString(),
          test: true
        })
      }
    });
    
    console.log('Created test ImportedReport:');
    console.log('ID:', importedReport.id);
    console.log('Source:', importedReport.source);
    console.log('Status:', importedReport.status);
    console.log('\nNow check if this appears in the UI!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIImport();