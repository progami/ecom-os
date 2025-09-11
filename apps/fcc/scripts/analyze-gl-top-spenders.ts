#!/usr/bin/env tsx

import { prisma } from '../lib/prisma';
import { structuredLogger } from '../lib/logger';

interface SpenderSummary {
  name: string;
  totalSpend: number;
  transactionCount: number;
  accounts: string[];
}

async function analyzeTopSpenders() {
  try {
    console.log('🔍 Analyzing General Ledger for top spenders...\n');
    
    // Fetch the most recent General Ledger data
    const glData = await prisma.reportData.findFirst({
      where: {
        reportType: 'GENERAL_LEDGER',
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!glData) {
      console.log('❌ No General Ledger data found in database');
      console.log('💡 Please import General Ledger data first');
      return;
    }
    
    console.log(`📊 Found General Ledger data from ${glData.periodStart?.toISOString()} to ${glData.periodEnd?.toISOString()}\n`);
    
    // Parse the JSON data
    const ledgerData = JSON.parse(glData.data);
    const accounts = ledgerData.accounts || [];
    
    console.log(`📋 Total accounts: ${accounts.length}`);
    
    // Map to track spending by vendor/contact
    const spenderMap = new Map<string, SpenderSummary>();
    
    // Process each account
    accounts.forEach((account: any) => {
      const isExpenseAccount = 
        account.accountType?.toLowerCase().includes('expense') ||
        account.accountType?.toLowerCase().includes('overhead') ||
        account.accountType?.toLowerCase().includes('cost') ||
        account.accountName?.toLowerCase().includes('expense') ||
        account.accountName?.toLowerCase().includes('cost');
      
      const isPayableAccount = 
        account.accountType?.toLowerCase().includes('payable') ||
        account.accountName?.toLowerCase().includes('payable');
      
      if (isExpenseAccount || isPayableAccount) {
        // Process transactions
        const transactions = account.transactions || [];
        
        transactions.forEach((transaction: any) => {
          // Look for payments (debits in expense accounts or credits in payable accounts)
          const isPayment = (isExpenseAccount && transaction.debit > 0) || 
                           (isPayableAccount && transaction.credit > 0);
          
          if (isPayment && transaction.contactName) {
            const contactName = transaction.contactName;
            const amount = isExpenseAccount ? transaction.debit : transaction.credit;
            
            if (!spenderMap.has(contactName)) {
              spenderMap.set(contactName, {
                name: contactName,
                totalSpend: 0,
                transactionCount: 0,
                accounts: []
              });
            }
            
            const spender = spenderMap.get(contactName)!;
            spender.totalSpend += amount;
            spender.transactionCount += 1;
            
            if (!spender.accounts.includes(account.accountName)) {
              spender.accounts.push(account.accountName);
            }
          }
        });
      }
    });
    
    // Sort spenders by total spend
    const topSpenders = Array.from(spenderMap.values())
      .filter(s => s.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);
    
    // Calculate total spend
    const totalSpend = Array.from(spenderMap.values())
      .reduce((sum, s) => sum + s.totalSpend, 0);
    
    console.log(`\n💰 Total spend across all vendors: £${totalSpend.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`👥 Total number of vendors: ${spenderMap.size}\n`);
    
    console.log('🏆 TOP 5 SPENDERS:\n');
    console.log('━'.repeat(80));
    
    topSpenders.forEach((spender, index) => {
      const percentage = (spender.totalSpend / totalSpend * 100).toFixed(1);
      const avgTransaction = spender.totalSpend / spender.transactionCount;
      
      console.log(`\n${index + 1}. ${spender.name}`);
      console.log(`   Total Spend: £${spender.totalSpend.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`   Percentage of Total: ${percentage}%`);
      console.log(`   Number of Transactions: ${spender.transactionCount}`);
      console.log(`   Average Transaction: £${avgTransaction.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`   Accounts Used: ${spender.accounts.slice(0, 3).join(', ')}${spender.accounts.length > 3 ? '...' : ''}`);
    });
    
    console.log('\n' + '━'.repeat(80));
    
    // Summary statistics
    const top5Total = topSpenders.reduce((sum, s) => sum + s.totalSpend, 0);
    const top5Percentage = (top5Total / totalSpend * 100).toFixed(1);
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Top 5 vendors account for ${top5Percentage}% of total spend`);
    console.log(`   Top 5 total: £${top5Total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
  } catch (error) {
    console.error('❌ Error analyzing General Ledger:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeTopSpenders();