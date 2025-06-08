#!/usr/bin/env node

import dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

interface CategorizationRule {
  id: string;
  name: string;
  description: string | null;
  matchType: string;
  matchField: string;
  matchValue: string;
  accountCode: string;
  taxType: string;
  priority: number;
  isActive: boolean;
}

interface XeroTransaction {
  transactionID: string;
  date: string;
  status: string;
  lineItems: Array<{
    description: string;
    accountCode?: string;
    taxType?: string;
  }>;
  contact: {
    name: string;
  };
  reference?: string;
  total: number;
}

class BookkeeperAutomation {
  private apiBaseUrl: string;
  private rules: CategorizationRule[] = [];

  constructor() {
    // In production, this would be the full URL of your deployed Next.js app
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  async fetchRules(): Promise<void> {
    try {
      console.log('Fetching categorization rules from API...');
      
      const response = await fetch(`${this.apiBaseUrl}/api/v1/bookkeeping/rules?isActive=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.statusText}`);
      }

      const data = await response.json();
      this.rules = data.rules;
      
      console.log(`Fetched ${this.rules.length} active rules`);
      
      // Sort rules by priority (highest first)
      this.rules.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('Error fetching rules:', error);
      throw error;
    }
  }

  async connectToXero(): Promise<void> {
    console.log('Connecting to Xero API...');
    
    // Phase 1: Read-only connection
    // In a real implementation, this would:
    // 1. Use OAuth2 to authenticate with Xero
    // 2. Store and refresh access tokens
    // 3. Handle rate limiting and retries
    
    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Xero API credentials not configured. Please set XERO_CLIENT_ID and XERO_CLIENT_SECRET in .env');
    }

    console.log('Xero connection established (simulation - Phase 1 read-only)');
  }

  async fetchXeroTransactions(): Promise<XeroTransaction[]> {
    console.log('Fetching uncategorized transactions from Xero...');
    
    // Phase 1: Simulated data for testing
    // In production, this would fetch real transactions from Xero API
    const mockTransactions: XeroTransaction[] = [
      {
        transactionID: 'mock-001',
        date: new Date().toISOString(),
        status: 'AUTHORISED',
        lineItems: [{
          description: 'Office Supplies - Staples',
        }],
        contact: { name: 'Staples Inc.' },
        reference: 'INV-2024-001',
        total: 125.50,
      },
      {
        transactionID: 'mock-002',
        date: new Date().toISOString(),
        status: 'AUTHORISED',
        lineItems: [{
          description: 'Cloud Hosting Services',
        }],
        contact: { name: 'AWS' },
        reference: 'AWS-MONTHLY',
        total: 250.00,
      },
    ];

    console.log(`Found ${mockTransactions.length} transactions to process`);
    return mockTransactions;
  }

  matchRule(transaction: XeroTransaction, rule: CategorizationRule): boolean {
    let fieldValue = '';
    
    switch (rule.matchField) {
      case 'description':
        fieldValue = transaction.lineItems[0]?.description || '';
        break;
      case 'payee':
        fieldValue = transaction.contact.name;
        break;
      case 'reference':
        fieldValue = transaction.reference || '';
        break;
      default:
        return false;
    }

    fieldValue = fieldValue.toLowerCase();
    const matchValue = rule.matchValue.toLowerCase();

    switch (rule.matchType) {
      case 'contains':
        return fieldValue.includes(matchValue);
      case 'equals':
        return fieldValue === matchValue;
      case 'startsWith':
        return fieldValue.startsWith(matchValue);
      case 'endsWith':
        return fieldValue.endsWith(matchValue);
      default:
        return false;
    }
  }

  categorizeTransactions(transactions: XeroTransaction[]): void {
    console.log('\\nApplying categorization rules...');
    
    for (const transaction of transactions) {
      console.log(`\\nProcessing transaction ${transaction.transactionID}:`);
      console.log(`  Description: ${transaction.lineItems[0]?.description}`);
      console.log(`  Payee: ${transaction.contact.name}`);
      console.log(`  Amount: $${transaction.total}`);
      
      let matched = false;
      
      for (const rule of this.rules) {
        if (this.matchRule(transaction, rule)) {
          console.log(`  ✓ Matched rule: "${rule.name}"`);
          console.log(`    → Account Code: ${rule.accountCode}`);
          console.log(`    → Tax Type: ${rule.taxType}`);
          matched = true;
          
          // Phase 1: Read-only - just log the match
          // Phase 2 would update the transaction in Xero
          break;
        }
      }
      
      if (!matched) {
        console.log('  ✗ No matching rules found');
      }
    }
  }

  async run(): Promise<void> {
    try {
      console.log('Starting Bookkeeper Automation...');
      console.log('=================================\\n');

      // Step 1: Fetch categorization rules
      await this.fetchRules();

      // Step 2: Connect to Xero
      await this.connectToXero();

      // Step 3: Fetch transactions
      const transactions = await this.fetchXeroTransactions();

      // Step 4: Apply categorization rules
      this.categorizeTransactions(transactions);

      console.log('\\n=================================');
      console.log('Bookkeeper Automation completed successfully');
      console.log('\\nNote: Phase 1 is read-only. No changes were made to Xero.');
    } catch (error) {
      console.error('\\nError in Bookkeeper Automation:', error);
      process.exit(1);
    }
  }
}

// Run the automation
const automation = new BookkeeperAutomation();
automation.run();