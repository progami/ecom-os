import { prisma } from '../lib/prisma';

async function cleanupTestImport() {
  try {
    console.log('Cleaning up test import entry...\n');
    
    // Delete the test import
    const result = await prisma.importedReport.delete({
      where: {
        id: 'cmcjdzn310000f2olrxif0sua'
      }
    });
    
    console.log('Deleted test import:', result.id);
    console.log('Imported by:', result.importedBy);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestImport();