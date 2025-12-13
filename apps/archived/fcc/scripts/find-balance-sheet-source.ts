import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

async function findBalanceSheetSource() {
  console.log('=== FINDING SOURCE OF BALANCE SHEET DATA ===\n');

  try {
    // 1. Check database for actual data
    const balanceSheets = await prisma.reportData.findMany({
      where: { reportType: 'BALANCE_SHEET' },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('📊 Balance Sheet Records in Database:\n');
    balanceSheets.forEach(bs => {
      const start = bs.periodStart.toISOString().split('T')[0];
      const end = bs.periodEnd.toISOString().split('T')[0];
      console.log(`- ${start} to ${end} (v${bs.version}, created: ${bs.createdAt.toISOString()})`);
    });

    // 2. Check for imported files
    console.log('\n\n📥 Imported Balance Sheet Files:\n');
    const imports = await prisma.importedReport.findMany({
      where: { type: 'BALANCE_SHEET' },
      orderBy: { importedAt: 'desc' }
    });

    imports.forEach(imp => {
      console.log(`- ${imp.fileName} (imported: ${imp.importedAt.toISOString()}, status: ${imp.status})`);
    });

    // 3. Search git history for when these records were created
    console.log('\n\n🔍 Searching git history for balance sheet operations...\n');
    
    try {
      // Search for commits mentioning balance sheet with specific dates
      const { stdout: gitLog } = await execAsync(
        `git log --grep="balance sheet" --grep="2024-06-30" --grep="2024-10-31" -i --oneline -20`
      );
      
      if (gitLog) {
        console.log('Git commits mentioning balance sheet or these dates:');
        console.log(gitLog);
      }
    } catch (error) {
      console.log('No relevant git commits found.');
    }

    // 4. Check for Excel files in data directory
    console.log('\n\n📁 Checking for Excel files in data directory:\n');
    const dataDir = path.join(process.cwd(), 'data');
    
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
      
      excelFiles.forEach(file => {
        const stats = fs.statSync(path.join(dataDir, file));
        console.log(`- ${file} (modified: ${stats.mtime.toISOString()})`);
      });
    } else {
      console.log('No data directory found.');
    }

    // 5. Check development logs for clues
    console.log('\n\n📝 Checking development logs...\n');
    const logFile = path.join(process.cwd(), 'development.log');
    
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, 'utf-8');
      const lines = logContent.split('\n');
      
      // Search for balance sheet related operations
      const relevantLines = lines.filter(line => 
        line.toLowerCase().includes('balance sheet') && 
        (line.includes('2024-06-30') || line.includes('2024-10-31'))
      ).slice(-10); // Last 10 relevant lines
      
      if (relevantLines.length > 0) {
        console.log('Found relevant log entries:');
        relevantLines.forEach(line => console.log(line));
      } else {
        console.log('No relevant balance sheet entries found in logs.');
      }
    }

    // 6. Analysis
    console.log('\n\n💡 ANALYSIS:\n');
    
    const hasJune30 = balanceSheets.some(bs => 
      bs.periodEnd.toISOString().split('T')[0] === '2024-06-30'
    );
    
    const hasOct31 = balanceSheets.some(bs => 
      bs.periodEnd.toISOString().split('T')[0] === '2024-10-31'
    );
    
    if (hasJune30 && hasOct31) {
      console.log('The data for June 30, 2024 and October 31, 2024 exists.');
      console.log('\nPossible sources:');
      console.log('1. Manual Excel file imports (check import-with-actual-parser.js)');
      console.log('2. API test scripts that fetched specific dates');
      console.log('3. Manual database inserts during development');
      
      // Check if these are year-to-date reports
      const june30Record = balanceSheets.find(bs => 
        bs.periodEnd.toISOString().split('T')[0] === '2024-06-30'
      );
      
      if (june30Record && june30Record.periodStart.toISOString().split('T')[0] === '2024-01-01') {
        console.log('\n✓ June 30 is a year-to-date report (Jan 1 - Jun 30)');
      }
      
      const oct31Record = balanceSheets.find(bs => 
        bs.periodEnd.toISOString().split('T')[0] === '2024-10-31'
      );
      
      if (oct31Record && oct31Record.periodStart.toISOString().split('T')[0] === '2024-01-01') {
        console.log('✓ October 31 is a year-to-date report (Jan 1 - Oct 31)');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findBalanceSheetSource();