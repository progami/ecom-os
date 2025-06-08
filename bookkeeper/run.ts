import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { XeroClient, BankTransaction } from 'xero-node';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface CategorizationRule {
  id: string;
  name: string;
  description?: string;
  matchType: string;
  matchField: string;
  matchValue: string;
  accountCode: string;
  taxType: string;
  priority: number;
  isActive: boolean;
}

interface RulesResponse {
  success: boolean;
  data: CategorizationRule[];
  count: number;
}

class BookkeeperAutomation {
  private apiBaseUrl: string;
  private xeroClient: XeroClient | null = null;
  private rules: CategorizationRule[] = [];

  constructor() {
    this.apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }

  /**
   * Initialize the automation script
   */
  async initialize(): Promise<void> {
    console.log('🚀 Bookkeeper Automation Starting...');
    
    // Fetch categorization rules from the API
    await this.fetchCategorizationRules();
    
    // Initialize Xero client
    await this.initializeXeroClient();
  }

  /**
   * Fetch categorization rules from the Next.js API
   */
  private async fetchCategorizationRules(): Promise<void> {
    try {
      console.log('📋 Fetching categorization rules from API...');
      
      const response = await fetch(`${this.apiBaseUrl}/api/v1/bookkeeping/rules`, {
        headers: {
          'Content-Type': 'application/json',
          // In production, add proper authentication headers
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.statusText}`);
      }

      const data: RulesResponse = await response.json() as RulesResponse;
      this.rules = data.data;
      
      console.log(`✅ Successfully fetched ${this.rules.length} categorization rules`);
    } catch (error) {
      console.error('❌ Error fetching categorization rules:', error);
      throw error;
    }
  }

  /**
   * Initialize Xero API client
   */
  private async initializeXeroClient(): Promise<void> {
    try {
      console.log('🔐 Initializing Xero client...');
      
      // Check if required Xero credentials are available
      if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
        console.warn('⚠️  Xero credentials not found in environment variables');
        console.log('   Please set XERO_CLIENT_ID and XERO_CLIENT_SECRET in .env.local');
        return;
      }

      // Initialize Xero client (simplified for Phase 1 - read-only)
      this.xeroClient = new XeroClient({
        clientId: process.env.XERO_CLIENT_ID,
        clientSecret: process.env.XERO_CLIENT_SECRET,
        redirectUris: [process.env.XERO_REDIRECT_URI || 'http://localhost:3000/api/xero/callback'],
        scopes: ['accounting.transactions.read', 'accounting.contacts.read', 'accounting.settings.read']
      });

      console.log('✅ Xero client initialized (read-only mode)');
    } catch (error) {
      console.error('❌ Error initializing Xero client:', error);
      // Continue without Xero in development/testing
    }
  }

  /**
   * Process transactions from Xero (Phase 1: Read-only)
   */
  async processTransactions(): Promise<void> {
    if (!this.xeroClient) {
      console.log('⏭️  Skipping Xero processing - client not initialized');
      return;
    }

    try {
      console.log('📊 Processing Xero transactions...');
      
      // This is a placeholder for Phase 1 - actual implementation would:
      // 1. Authenticate with Xero OAuth2
      // 2. Fetch uncategorized transactions
      // 3. Apply categorization rules
      // 4. Log suggested categorizations (read-only)
      
      console.log('🔍 Analyzing transactions with categorization rules:');
      this.rules.forEach((rule, index) => {
        console.log(`   ${index + 1}. ${rule.name}: ${rule.matchField} ${rule.matchType} "${rule.matchValue}" → Account: ${rule.accountCode}, Tax: ${rule.taxType}`);
      });
      
      console.log('\n📝 Phase 1 Complete: Read-only analysis mode');
      console.log('   In production, this would fetch and analyze real Xero transactions');
      
    } catch (error) {
      console.error('❌ Error processing transactions:', error);
    }
  }

  /**
   * Main execution function
   */
  async run(): Promise<void> {
    try {
      await this.initialize();
      await this.processTransactions();
      
      console.log('\n✅ Bookkeeper automation completed successfully');
    } catch (error) {
      console.error('\n❌ Bookkeeper automation failed:', error);
      process.exit(1);
    }
  }
}

// Execute the automation script
if (require.main === module) {
  const automation = new BookkeeperAutomation();
  automation.run().catch(console.error);
}

export default BookkeeperAutomation;