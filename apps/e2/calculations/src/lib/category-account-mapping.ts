import { CHART_OF_ACCOUNTS, Account } from './chart-of-accounts'

// Map category names to account codes based on the chart of accounts
export const categoryToAccount: Record<string, { code: string, account: Account }> = {
  // Equity accounts
  'Equity': { code: '3000', account: CHART_OF_ACCOUNTS['3000'] }, // Member Investment - Jarrar
  
  // Revenue accounts  
  'Income': { code: '4000', account: CHART_OF_ACCOUNTS['4000'] }, // Amazon Sales
  'Sales Revenue': { code: '4000', account: CHART_OF_ACCOUNTS['4000'] }, // Amazon Sales
  'Sales': { code: '4000', account: CHART_OF_ACCOUNTS['4000'] }, // Amazon Sales
  'Amazon Sales': { code: '4000', account: CHART_OF_ACCOUNTS['4000'] }, // Amazon Sales
  
  // Expense accounts - Operating  
  'Bank Fees': { code: '5600', account: CHART_OF_ACCOUNTS['5600'] }, // Bank Fees
  'Meals & Entertainment': { code: '5710', account: CHART_OF_ACCOUNTS['5710'] }, // Meals & Entertainment
  'Software & Subscriptions': { code: '5500', account: CHART_OF_ACCOUNTS['5500'] }, // IT Software
  'Legal & Compliance': { code: '5410', account: CHART_OF_ACCOUNTS['5410'] }, // Legal and Compliance
  'Contract Services': { code: '5130', account: CHART_OF_ACCOUNTS['5130'] }, // Freelance Services
  'Travel': { code: '5700', account: CHART_OF_ACCOUNTS['5700'] }, // Travel
  'Research & Development': { code: '5510', account: CHART_OF_ACCOUNTS['5510'] }, // Research & Development
  'Accounting': { code: '5420', account: CHART_OF_ACCOUNTS['5420'] }, // Accounting
  'Members Remuneration': { code: '5120', account: CHART_OF_ACCOUNTS['5120'] }, // Contract Salaries (closest match)
  'Employer Payroll Taxes': { code: '5110', account: CHART_OF_ACCOUNTS['5110'] }, // Payroll Tax
  
  // Expense Forecast Categories - Direct mapping to organized codes
  'Payroll': { code: '5100', account: CHART_OF_ACCOUNTS['5100'] }, // Payroll
  'Payroll Tax': { code: '5110', account: CHART_OF_ACCOUNTS['5110'] }, // Payroll Tax
  'Taxes - Payroll': { code: '5110', account: CHART_OF_ACCOUNTS['5110'] }, // Payroll Tax
  'Rent': { code: '5200', account: CHART_OF_ACCOUNTS['5200'] }, // Rent
  'Utilities': { code: '5210', account: CHART_OF_ACCOUNTS['5210'] }, // Utilities
  // 'Marketing': removed - 5300 deleted from system
  'Advertising': { code: '5310', account: CHART_OF_ACCOUNTS['5310'] }, // Advertising
  'Office Supplies': { code: '5230', account: CHART_OF_ACCOUNTS['5230'] }, // Office Supplies
  'Professional Fees': { code: '5410', account: CHART_OF_ACCOUNTS['5410'] }, // Legal and Compliance (closest match)
  'Insurance': { code: '5240', account: CHART_OF_ACCOUNTS['5240'] }, // Insurance
  'Manufacturing': { code: '5020', account: CHART_OF_ACCOUNTS['5020'] }, // Manufacturing
  'Freight': { code: '5030', account: CHART_OF_ACCOUNTS['5030'] }, // Freight & Custom Duty
  'Inventory': { code: '5020', account: CHART_OF_ACCOUNTS['5020'] }, // Manufacturing (default for generic inventory)
  'Other': { code: '5600', account: CHART_OF_ACCOUNTS['5600'] }, // Bank Fees (used as general expense)
  'Other Expenses': { code: '5600', account: CHART_OF_ACCOUNTS['5600'] }, // Bank Fees (used as general expense)
  
  // Liability accounts
  // Note: Taxes - Payroll is now mapped to expense account 323 above
  
  // Asset accounts
  'Inventory Asset': { code: '1100', account: CHART_OF_ACCOUNTS['1100'] }, // Accounts Receivable (used for inventory tracking)
  
  // COGS accounts
  'Inventory - Freight & Duty': { code: '5030', account: CHART_OF_ACCOUNTS['5030'] }, // Freight & Custom Duty
  'Cost of Goods Sold': { code: '5020', account: CHART_OF_ACCOUNTS['5020'] }, // Manufacturing (default for COGS)
  
  // Amazon fee accounts
  'Amazon Expenses': { code: '5051', account: CHART_OF_ACCOUNTS['5051'] }, // Amazon FBA Fees
  'Amazon Fees': { code: '5051', account: CHART_OF_ACCOUNTS['5051'] }, // Amazon FBA Fees (legacy)
  'Marketing PPC': { code: '5310', account: CHART_OF_ACCOUNTS['5310'] }, // Amazon Advertising
}

// Get account info for a category, returning defaults if not found
export function getCategoryAccount(category: string): { code: string, type: Account['type'], name: string } {
  const mapping = categoryToAccount[category]
  
  if (mapping) {
    return {
      code: mapping.code,
      type: mapping.account.type,
      name: mapping.account.name
    }
  }
  
  // Default to bank fees if category not found
  return {
    code: '5600',
    type: 'Expense',
    name: 'Bank Fees'
  }
}

// Get account code for a category and type
export function getCategoryAccountCode(category: string, type: string): string {
  const mapping = categoryToAccount[category]
  
  if (mapping) {
    return mapping.code
  }
  
  // Default based on type
  if (type === 'revenue_projection') {
    return '4000' // Amazon Sales
  } else if (type === 'amazon_fees') {
    return '5051' // Amazon FBA Fees
  } else {
    return '5600' // Bank Fees (default expense)
  }
}