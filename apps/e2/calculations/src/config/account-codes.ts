/**
 * GL Account Codes Configuration
 * Centralizes all General Ledger account codes used throughout the system
 * 
 * IMPORTANT: All codes should match the chart of accounts (src/lib/chart-of-accounts.ts)
 * Use systematic 4-digit codes only - no legacy 3-digit codes
 */

export interface AccountCode {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}

export interface AccountCodes {
  // Assets (1xxx)
  BANK_ACCOUNT: AccountCode;
  // ACCOUNTS_RECEIVABLE removed - using cash-basis accounting
  INVENTORY: AccountCode;
  PREPAID_EXPENSES: AccountCode;
  AMAZON_RECEIVABLE: AccountCode;
  AMAZON_RESERVED_BALANCES: AccountCode;
  AMAZON_SPLIT_MONTH_ROLLOVERS: AccountCode;
  OTHER_DEBTORS: AccountCode;
  OFFICE_EQUIPMENT: AccountCode;
  ACCUMULATED_DEPRECIATION: AccountCode;
  
  // Liabilities (2xxx)
  // ACCOUNTS_PAYABLE removed - using cash-basis accounting
  SALES_TAX_PAYABLE: AccountCode;
  PAYROLL_TAX_PAYABLE: AccountCode;
  MEMBERS_LOAN_ACCOUNT: AccountCode;
  ROUNDING: AccountCode;
  
  // Equity (3xxx)
  MEMBER_INVESTMENT_JARRAR: AccountCode;
  MEMBER_INVESTMENT_ABDUL: AccountCode;
  MEMBER_INVESTMENT_AMJAD: AccountCode;
  CAPITAL_MEMBER_UNITS: AccountCode;
  RETAINED_EARNINGS: AccountCode;
  MEMBER_DISTRIBUTIONS: AccountCode;
  
  // Revenue (4xxx)
  AMAZON_SALES: AccountCode;
  AMAZON_FBA_INVENTORY_REIMBURSEMENT: AccountCode;
  CASHBACK_REWARDS: AccountCode;
  
  // Expenses - COGS (5000-5099)
  COST_OF_GOODS_SOLD: AccountCode;
  MANUFACTURING: AccountCode;
  FREIGHT_CUSTOM_DUTY: AccountCode;
  LAND_FREIGHT: AccountCode;
  STORAGE_3PL: AccountCode;
  VAT_TARIFFS: AccountCode;
  AMAZON_SELLER_FEES: AccountCode;
  AMAZON_FBA_FEES: AccountCode;
  AMAZON_STORAGE_FEES: AccountCode;
  
  // Expenses - Operating (5100+)
  PAYROLL: AccountCode;
  PAYROLL_TAX: AccountCode;
  CONTRACT_SALARIES: AccountCode;
  FREELANCE_SERVICES: AccountCode;
  MEMBERS_REMUNERATION: AccountCode;
  RENT: AccountCode;
  UTILITIES: AccountCode;
  TELEPHONE_INTERNET: AccountCode;
  OFFICE_SUPPLIES: AccountCode;
  INSURANCE: AccountCode;
  ADVERTISING: AccountCode;
  PROFESSIONAL_FEES: AccountCode;
  LEGAL_COMPLIANCE: AccountCode;
  ACCOUNTING: AccountCode;
  IT_SOFTWARE: AccountCode;
  RESEARCH_DEVELOPMENT: AccountCode;
  BANK_FEES: AccountCode;
  INTEREST_PAID: AccountCode;
  BANK_REVALUATIONS: AccountCode;
  UNREALISED_CURRENCY_GAINS: AccountCode;
  REALISED_CURRENCY_GAINS: AccountCode;
  TRAVEL: AccountCode;
  MEALS_ENTERTAINMENT: AccountCode;
  DEPRECIATION_EXPENSE: AccountCode;
  GENERAL_OPERATING_EXPENSES: AccountCode;
  OTHER_EXPENSES: AccountCode;
  AMAZON_REFUNDS: AccountCode;
}

export const GL_ACCOUNT_CODES: AccountCodes = {
  // Asset accounts (1xxx)
  BANK_ACCOUNT: { code: '1000', name: 'Business Bank Account', type: 'asset' },
  // ACCOUNTS_RECEIVABLE removed - using cash-basis accounting
  INVENTORY: { code: '1200', name: 'Inventory', type: 'asset' },
  PREPAID_EXPENSES: { code: '1300', name: 'Prepayments', type: 'asset' },
  AMAZON_RECEIVABLE: { code: '1110', name: 'Amazon Receivable', type: 'asset' },
  AMAZON_RESERVED_BALANCES: { code: '1120', name: 'Amazon Reserved Balances', type: 'asset' },
  AMAZON_SPLIT_MONTH_ROLLOVERS: { code: '1121', name: 'Amazon Split Month Rollovers', type: 'asset' },
  OTHER_DEBTORS: { code: '1180', name: 'Other Debtors', type: 'asset' },
  OFFICE_EQUIPMENT: { code: '1700', name: 'Office Equipment', type: 'asset' },
  ACCUMULATED_DEPRECIATION: { code: '1750', name: 'Less Accumulated Depreciation on Office Equipment', type: 'asset' },
  
  // Liability accounts (2xxx)
  // ACCOUNTS_PAYABLE removed - using cash-basis accounting
  SALES_TAX_PAYABLE: { code: '2100', name: 'Sales Tax Payable', type: 'liability' },
  PAYROLL_TAX_PAYABLE: { code: '2110', name: 'Payroll Tax Payable', type: 'liability' },
  MEMBERS_LOAN_ACCOUNT: { code: '2200', name: 'Members Loan Account', type: 'liability' },
  ROUNDING: { code: '2900', name: 'Rounding', type: 'liability' },
  
  // Equity accounts (3xxx)
  MEMBER_INVESTMENT_JARRAR: { code: '3000', name: 'Member Investment - Jarrar', type: 'equity' },
  MEMBER_INVESTMENT_ABDUL: { code: '3001', name: 'Member Investment - Abdul Basit', type: 'equity' },
  MEMBER_INVESTMENT_AMJAD: { code: '3002', name: 'Member Investment - Amjad Ali', type: 'equity' },
  CAPITAL_MEMBER_UNITS: { code: '3100', name: 'Capital - Member Units', type: 'equity' },
  RETAINED_EARNINGS: { code: '3900', name: 'Retained Earnings', type: 'equity' },
  MEMBER_DISTRIBUTIONS: { code: '3950', name: 'Member Distributions', type: 'equity' },
  
  // Revenue accounts (4xxx)
  AMAZON_SALES: { code: '4000', name: 'Amazon Sales', type: 'revenue' },
  AMAZON_FBA_INVENTORY_REIMBURSEMENT: { code: '4020', name: 'Amazon FBA Inventory Reimbursement', type: 'revenue' },
  CASHBACK_REWARDS: { code: '4900', name: 'Cashback & Rewards', type: 'revenue' },
  
  // COGS accounts (5000-5099)
  COST_OF_GOODS_SOLD: { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
  MANUFACTURING: { code: '5020', name: 'Manufacturing', type: 'expense' },
  FREIGHT_CUSTOM_DUTY: { code: '5030', name: 'Freight & Custom Duty', type: 'expense' },
  LAND_FREIGHT: { code: '5031', name: 'Land Freight', type: 'expense' },
  STORAGE_3PL: { code: '5032', name: 'Storage AWD', type: 'expense' },
  VAT_TARIFFS: { code: '5040', name: 'VAT/Tariffs', type: 'expense' },
  AMAZON_SELLER_FEES: { code: '5050', name: 'Amazon Referral Fees', type: 'expense' },
  AMAZON_FBA_FEES: { code: '5051', name: 'Amazon FBA Fees', type: 'expense' },
  AMAZON_STORAGE_FEES: { code: '5052', name: 'Amazon Storage Fees', type: 'expense' },
  
  // Operating Expense accounts (5100+)
  PAYROLL: { code: '5100', name: 'Payroll', type: 'expense' },
  PAYROLL_TAX: { code: '5110', name: 'Payroll Tax', type: 'expense' },
  CONTRACT_SALARIES: { code: '5120', name: 'Contract Salaries', type: 'expense' },
  FREELANCE_SERVICES: { code: '5130', name: 'Freelance Services', type: 'expense' },
  MEMBERS_REMUNERATION: { code: '5140', name: 'Members Remuneration', type: 'expense' },
  RENT: { code: '5200', name: 'Rent', type: 'expense' },
  UTILITIES: { code: '5210', name: 'Utilities', type: 'expense' },
  TELEPHONE_INTERNET: { code: '5220', name: 'Telephone & Internet', type: 'expense' },
  OFFICE_SUPPLIES: { code: '5230', name: 'Office Supplies', type: 'expense' },
  INSURANCE: { code: '5240', name: 'Insurance', type: 'expense' },
  // Note: 5300 removed - Marketing moved to 5200 range
  ADVERTISING: { code: '5310', name: 'Advertising', type: 'expense' },
  PROFESSIONAL_FEES: { code: '5400', name: 'Professional Fees', type: 'expense' },
  LEGAL_COMPLIANCE: { code: '5410', name: 'Legal and Compliance', type: 'expense' },
  ACCOUNTING: { code: '5420', name: 'Accounting', type: 'expense' },
  IT_SOFTWARE: { code: '5500', name: 'IT Software', type: 'expense' },
  RESEARCH_DEVELOPMENT: { code: '5510', name: 'Research & Development', type: 'expense' },
  BANK_FEES: { code: '5600', name: 'Bank Fees', type: 'expense' },
  INTEREST_PAID: { code: '5610', name: 'Interest Paid', type: 'expense' },
  BANK_REVALUATIONS: { code: '5620', name: 'Bank Revaluations', type: 'expense' },
  UNREALISED_CURRENCY_GAINS: { code: '5630', name: 'Unrealised Currency Gains', type: 'expense' },
  REALISED_CURRENCY_GAINS: { code: '5631', name: 'Realised Currency Gains', type: 'expense' },
  TRAVEL: { code: '5700', name: 'Travel', type: 'expense' },
  MEALS_ENTERTAINMENT: { code: '5710', name: 'Meals & Entertainment', type: 'expense' },
  DEPRECIATION_EXPENSE: { code: '5800', name: 'Depreciation Expense', type: 'expense' },
  GENERAL_OPERATING_EXPENSES: { code: '5900', name: 'General Operating Expenses', type: 'expense' },
  OTHER_EXPENSES: { code: '5990', name: 'Other Expenses', type: 'expense' },
  AMAZON_REFUNDS: { code: '4010', name: 'Amazon Refunds', type: 'expense' },
} as const;

// Helper functions
export const getAccountByCode = (code: string): AccountCode | undefined => {
  return Object.values(GL_ACCOUNT_CODES).find(account => account.code === code);
};

export const getAccountsByType = (type: AccountCode['type']): AccountCode[] => {
  return Object.values(GL_ACCOUNT_CODES).filter(account => account.type === type);
};

// Export individual account codes for convenience
export const {
  BANK_ACCOUNT,
  // ACCOUNTS_RECEIVABLE removed
  INVENTORY,
  AMAZON_RECEIVABLE,
  AMAZON_RESERVED_BALANCES,
  AMAZON_SPLIT_MONTH_ROLLOVERS,
  // ACCOUNTS_PAYABLE removed
  PAYROLL_TAX_PAYABLE,
  AMAZON_SALES,
  AMAZON_FBA_INVENTORY_REIMBURSEMENT,
  COST_OF_GOODS_SOLD,
  MANUFACTURING,
  FREIGHT_CUSTOM_DUTY,
  VAT_TARIFFS,
  AMAZON_SELLER_FEES,
  AMAZON_FBA_FEES,
  AMAZON_STORAGE_FEES,
  PAYROLL,
  PAYROLL_TAX,
  CONTRACT_SALARIES,
  RENT,
  UTILITIES,
  INSURANCE,
  ADVERTISING,
  PROFESSIONAL_FEES,
  IT_SOFTWARE,
  BANK_FEES,
  MEMBERS_LOAN_ACCOUNT,
  OTHER_EXPENSES,
  AMAZON_REFUNDS,
} = GL_ACCOUNT_CODES;