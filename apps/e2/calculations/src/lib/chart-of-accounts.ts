export interface Account {
  code: string
  name: string
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  subtype: string
  normalBalance: 'Debit' | 'Credit'
}

export const CHART_OF_ACCOUNTS: Record<string, Account> = {
  // Assets (1000-1999)
  // Cash and Bank (1000-1099)
  '1000': { code: '1000', name: 'Business Bank Account', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit' },
  
  // Receivables (1100-1199) - Not used (cash-basis accounting)
  
  // Inventory (1200-1299)
  '1200': { code: '1200', name: 'Inventory', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit' },
  
  // Fixed Assets (1700-1799)
  '1700': { code: '1700', name: 'Office Equipment', type: 'Asset', subtype: 'Fixed Asset', normalBalance: 'Debit' },
  '1750': { code: '1750', name: 'Less Accumulated Depreciation on Office Equipment', type: 'Asset', subtype: 'Fixed Asset', normalBalance: 'Credit' },

  // Liabilities (2000-2999)
  // Current Liabilities (2000-2199) - Not used (cash-basis accounting)
  
  // Equity (3000-3999)
  // Member Capital (3000-3099)
  '3000': { code: '3000', name: 'Member Investment', type: 'Equity', subtype: 'Contributed Capital', normalBalance: 'Credit' },
  
  // Retained Earnings (3900-3999)
  '3900': { code: '3900', name: 'Retained Earnings', type: 'Equity', subtype: 'Retained Earnings', normalBalance: 'Credit' },
  '3950': { code: '3950', name: 'Member Distributions', type: 'Equity', subtype: 'Distributions', normalBalance: 'Debit' },

  // Revenue (4000-4999)
  // Sales Revenue (4000-4099)
  '4000': { code: '4000', name: 'Amazon Sales', type: 'Revenue', subtype: 'Operating Revenue', normalBalance: 'Credit' },
  '4001': { code: '4001', name: 'Walmart Revenue', type: 'Revenue', subtype: 'Operating Revenue', normalBalance: 'Credit' },
  '4002': { code: '4002', name: 'Retail Revenue', type: 'Revenue', subtype: 'Operating Revenue', normalBalance: 'Credit' },
  // '4010' moved to expenses - refunds are an expense not contra-revenue
  // 4020 removed - Amazon FBA Inventory Reimbursement no longer tracked
  
  // Other Revenue (4900-4999)
  '4900': { code: '4900', name: 'Interest Income - Cashback', type: 'Revenue', subtype: 'Other Revenue', normalBalance: 'Credit' },

  // Cost of Goods Sold (5000-5099)
  // Note: 5000 removed - it's a summary account, not a line item
  '5020': { code: '5020', name: 'Manufacturing', type: 'Expense', subtype: 'COGS', normalBalance: 'Debit' },
  '5025': { code: '5025', name: 'Year-end Inventory Adjustment', type: 'Expense', subtype: 'COGS', normalBalance: 'Credit' },
  '5030': { code: '5030', name: 'Ocean Freight', type: 'Expense', subtype: 'COGS', normalBalance: 'Debit' },
  '5031': { code: '5031', name: 'Land Freight', type: 'Expense', subtype: 'COGS', normalBalance: 'Debit' },
  '5040': { code: '5040', name: 'Tariffs', type: 'Expense', subtype: 'COGS', normalBalance: 'Debit' },
  
  // Marketplace Expenses (Channel-Agnostic - formerly Amazon Expenses)
  '4010': { code: '4010', name: 'Refunds', type: 'Expense', subtype: 'Marketplace Expenses', normalBalance: 'Debit' },
  '5032': { code: '5032', name: 'Storage 3PL', type: 'Expense', subtype: 'Marketplace Expenses', normalBalance: 'Debit' },
  '5050': { code: '5050', name: 'Referral Fees', type: 'Expense', subtype: 'Marketplace Expenses', normalBalance: 'Debit' },
  '5051': { code: '5051', name: 'Fulfillment Fees', type: 'Expense', subtype: 'Marketplace Expenses', normalBalance: 'Debit' },
  '5052': { code: '5052', name: 'Storage Fees', type: 'Expense', subtype: 'Marketplace Expenses', normalBalance: 'Debit' },
  '5310': { code: '5310', name: 'Advertising', type: 'Expense', subtype: 'Marketplace Expenses', normalBalance: 'Debit' },

  // Operating Expenses (5100-5999)
  // Payroll & Benefits (5100-5199)
  '5100': { code: '5100', name: 'Payroll', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5110': { code: '5110', name: 'Payroll Tax', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5120': { code: '5120', name: 'Contract Salaries', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5130': { code: '5130', name: 'Freelance Services', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  
  // Facilities & Operations (5200-5299)
  '5200': { code: '5200', name: 'Rent', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5210': { code: '5210', name: 'Utilities', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5220': { code: '5220', name: 'Telephone & Internet', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5230': { code: '5230', name: 'Office Supplies', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5240': { code: '5240', name: 'Insurance', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  
  // Professional Services (5400-5499)
  '5410': { code: '5410', name: 'Legal and Compliance', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5420': { code: '5420', name: 'Accounting', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  
  // Technology (5500-5599)
  '5500': { code: '5500', name: 'IT Software', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  
  // Financial Expenses (5600-5699)
  '5600': { code: '5600', name: 'Bank Fees', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  // 5610 removed - Interest Paid no longer tracked
  // 5620 removed - Bank Revaluations no longer tracked
  // 5630 removed - Unrealised Currency Gains no longer tracked
  // 5631 removed - Realised Currency Gains no longer tracked
  
  // Other Operating Expenses (5700-5999)
  '5700': { code: '5700', name: 'Travel', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5710': { code: '5710', name: 'Meals & Entertainment', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  '5720': { code: '5720', name: 'Depreciation Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit' },
  
  // All legacy codes have been removed - use 4-digit systematic codes only
}

// Helper function to get account by code
export function getAccount(code: string): Account | undefined {
  return CHART_OF_ACCOUNTS[code]
}

// Helper function to get accounts by type
export function getAccountsByType(type: Account['type']): Account[] {
  return Object.values(CHART_OF_ACCOUNTS).filter(account => account.type === type)
}