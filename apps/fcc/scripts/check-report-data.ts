#!/usr/bin/env tsx

import { prisma } from '../lib/prisma';

async function checkReportData() {
  try {
    console.log('📊 Checking available report data...\n');
    
    // Get all report types
    const reportTypes = await prisma.reportData.groupBy({
      by: ['reportType'],
      _count: {
        reportType: true
      },
      where: {
        isActive: true
      }
    });
    
    console.log('Available report types:');
    console.log('━'.repeat(50));
    
    for (const type of reportTypes) {
      console.log(`\n${type.reportType}: ${type._count.reportType} records`);
      
      // Get latest record for this type
      const latest = await prisma.reportData.findFirst({
        where: {
          reportType: type.reportType,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          periodStart: true,
          periodEnd: true,
          createdAt: true,
          metadata: true
        }
      });
      
      if (latest) {
        console.log(`  Latest: ${latest.periodStart?.toISOString()} to ${latest.periodEnd?.toISOString()}`);
        console.log(`  Created: ${latest.createdAt.toISOString()}`);
        if (latest.metadata && typeof latest.metadata === 'object') {
          console.log(`  Metadata:`, JSON.stringify(latest.metadata, null, 2));
        }
      }
    }
    
    console.log('\n' + '━'.repeat(50));
    
  } catch (error) {
    console.error('❌ Error checking report data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReportData();