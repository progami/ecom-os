import { z } from 'zod';

// Base schemas for common data types
const CurrencyAmountSchema = z.number().default(0);
const DateStringSchema = z.string().optional();
const ContactIdSchema = z.string().min(1).optional().default('unknown');
const ContactNameSchema = z.string().default('Unknown Contact');

// Contact schema for aged reports
const ContactSchema = z.object({
  contactId: ContactIdSchema,
  contactName: ContactNameSchema,
  totalOutstanding: CurrencyAmountSchema,
  current: CurrencyAmountSchema,
  days1to30: CurrencyAmountSchema,
  days31to60: CurrencyAmountSchema,
  days61to90: CurrencyAmountSchema,
  days91Plus: CurrencyAmountSchema,
});

// Summary schema for aged reports
const AgedSummarySchema = z.object({
  totalOutstanding: CurrencyAmountSchema,
  percentageCurrent: z.number().min(0).max(100).default(0),
  percentageOverdue: z.number().min(0).max(100).default(0),
  criticalAmount: CurrencyAmountSchema,
  criticalPercentage: z.number().min(0).max(100).default(0),
});

// Aged Payables Report Schema
export const AgedPayablesSchema = z.object({
  totalOutstanding: CurrencyAmountSchema,
  current: CurrencyAmountSchema,
  days1to30: CurrencyAmountSchema,
  days31to60: CurrencyAmountSchema,
  days61to90: CurrencyAmountSchema,
  days91Plus: CurrencyAmountSchema,
  contacts: z.array(ContactSchema).default([]),
  summary: AgedSummarySchema,
  reportDate: DateStringSchema,
  fromDate: DateStringSchema,
  toDate: DateStringSchema,
  source: z.string().default('database'),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

// Aged Receivables Report Schema (same structure as payables)
export const AgedReceivablesSchema = AgedPayablesSchema;

// Cash Flow Activities Schemas
const OperatingActivitiesSchema = z.object({
  netCashFromOperating: CurrencyAmountSchema,
  receiptsFromCustomers: CurrencyAmountSchema,
  paymentsToSuppliers: CurrencyAmountSchema,
  paymentsToEmployees: CurrencyAmountSchema,
  interestPaid: CurrencyAmountSchema,
  incomeTaxPaid: CurrencyAmountSchema,
});

const InvestingActivitiesSchema = z.object({
  netCashFromInvesting: CurrencyAmountSchema,
  purchaseOfAssets: CurrencyAmountSchema,
  saleOfAssets: CurrencyAmountSchema,
});

const FinancingActivitiesSchema = z.object({
  netCashFromFinancing: CurrencyAmountSchema,
  proceedsFromBorrowing: CurrencyAmountSchema,
  repaymentOfBorrowing: CurrencyAmountSchema,
  dividendsPaid: CurrencyAmountSchema,
});

const CashFlowSummarySchema = z.object({
  netCashFlow: CurrencyAmountSchema,
  openingBalance: CurrencyAmountSchema,
  closingBalance: CurrencyAmountSchema,
  operatingCashFlowRatio: z.number().default(0),
});

// Monthly trend data for cash flow
const MonthlyTrendSchema = z.object({
  month: z.string(),
  operating: CurrencyAmountSchema,
  investing: CurrencyAmountSchema,
  financing: CurrencyAmountSchema,
  netCashFlow: CurrencyAmountSchema,
});

// Cash Flow Report Schema
export const CashFlowSchema = z.object({
  operatingActivities: OperatingActivitiesSchema,
  investingActivities: InvestingActivitiesSchema,
  financingActivities: FinancingActivitiesSchema,
  summary: CashFlowSummarySchema,
  monthlyTrends: z.array(MonthlyTrendSchema).optional(),
  fromDate: DateStringSchema,
  toDate: DateStringSchema,
  reportDate: DateStringSchema,
  source: z.string().default('database'),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

// Bank Account Schema
const BankAccountSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().default('Unknown Account'),
  accountType: z.string().default('Unknown Type'),
  balance: CurrencyAmountSchema,
  currencyCode: z.string().default('GBP'),
  isActive: z.boolean().default(true),
  bankAccountNumber: z.string().optional(),
});

// Account Type Schema for charts
const AccountTypeSchema = z.object({
  type: z.string(),
  balance: CurrencyAmountSchema,
  count: z.number().int().min(0).default(0),
});


// Profit & Loss Line Item Schema
const ProfitLossLineItemSchema = z.object({
  accountId: z.string().optional(),
  accountCode: z.string().optional(),
  accountName: z.string().default('Unknown Account'),
  accountType: z.string().optional(),
  total: CurrencyAmountSchema,
  lineItems: z.array(z.object({
    accountId: z.string().optional(),
    accountCode: z.string().optional(),
    accountName: z.string().default('Unknown Account'),
    amount: CurrencyAmountSchema,
  })).optional(),
});

// Profit & Loss Report Schema
export const ProfitLossSchema = z.object({
  revenue: z.array(ProfitLossLineItemSchema).default([]),
  expenses: z.array(ProfitLossLineItemSchema).default([]),
  totalRevenue: CurrencyAmountSchema,
  totalExpenses: CurrencyAmountSchema,
  grossProfit: CurrencyAmountSchema,
  netProfit: CurrencyAmountSchema,
  fromDate: DateStringSchema,
  toDate: DateStringSchema,
  reportDate: DateStringSchema,
  source: z.string().default('database'),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

// Balance Sheet Account Schema
const BalanceSheetAccountSchema = z.object({
  accountId: z.string().optional(),
  accountCode: z.string().default(''),
  accountName: z.string().default('Unknown Account'),
  accountType: z.string().optional(),
  balance: CurrencyAmountSchema,
});

// Balance Sheet Report Schema
export const BalanceSheetSchema = z.object({
  // Assets section with current and non-current breakdown
  assets: z.object({
    currentAssets: z.array(BalanceSheetAccountSchema).default([]),
    nonCurrentAssets: z.array(BalanceSheetAccountSchema).default([]),
    totalAssets: CurrencyAmountSchema,
  }),
  // Liabilities section with current and non-current breakdown
  liabilities: z.object({
    currentLiabilities: z.array(BalanceSheetAccountSchema).default([]),
    nonCurrentLiabilities: z.array(BalanceSheetAccountSchema).default([]),
    totalLiabilities: CurrencyAmountSchema,
  }),
  // Equity section
  equity: z.object({
    accounts: z.array(BalanceSheetAccountSchema).default([]),
    totalEquity: CurrencyAmountSchema,
  }),
  // Summary totals
  totalAssets: CurrencyAmountSchema,
  totalLiabilities: CurrencyAmountSchema,
  totalEquity: CurrencyAmountSchema,
  netAssets: CurrencyAmountSchema,
  // Working capital and ratios
  currentAssets: CurrencyAmountSchema.optional(),
  currentLiabilities: CurrencyAmountSchema.optional(),
  nonCurrentAssets: CurrencyAmountSchema.optional(),
  nonCurrentLiabilities: CurrencyAmountSchema.optional(),
  workingCapital: CurrencyAmountSchema.optional(),
  currentRatio: z.number().optional(),
  quickRatio: z.number().optional(),
  debtToEquityRatio: z.number().optional(),
  equityRatio: z.number().optional(),
  // Summary object for additional metrics
  summary: z.object({
    netAssets: CurrencyAmountSchema,
    currentRatio: z.number().default(0),
    quickRatio: z.number().default(0),
    debtToEquityRatio: z.number().default(0),
    equityRatio: z.number().default(0),
  }).optional(),
  // Trends data for charts
  trends: z.array(z.object({
    date: z.string(),
    totalAssets: CurrencyAmountSchema,
    totalLiabilities: CurrencyAmountSchema,
    totalEquity: CurrencyAmountSchema,
  })).optional(),
  // Metadata
  reportDate: DateStringSchema,
  source: z.string().default('database'),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

// Trial Balance Account Schema
const TrialBalanceAccountSchema = z.object({
  accountId: z.string().optional(),
  accountCode: z.string().default(''),
  accountName: z.string().default('Unknown Account'),
  accountType: z.string().optional(),
  debit: CurrencyAmountSchema,
  credit: CurrencyAmountSchema,
  balance: CurrencyAmountSchema,
  isActive: z.boolean().default(true),
});

// Trial Balance Report Schema
export const TrialBalanceSchema = z.object({
  accounts: z.array(TrialBalanceAccountSchema).default([]),
  totals: z.object({
    totalDebits: CurrencyAmountSchema,
    totalCredits: CurrencyAmountSchema,
    balanceDifference: CurrencyAmountSchema,
    isBalanced: z.boolean().default(false),
  }),
  summary: z.object({
    totalAccounts: z.number().int().min(0).default(0),
    activeAccounts: z.number().int().min(0).default(0),
    inactiveAccounts: z.number().int().min(0).default(0),
    largestDebit: CurrencyAmountSchema,
    largestCredit: CurrencyAmountSchema,
  }),
  accountTypes: z.array(z.object({
    type: z.string(),
    debits: CurrencyAmountSchema,
    credits: CurrencyAmountSchema,
    count: z.number().int().min(0).default(0),
  })).default([]),
  reportDate: DateStringSchema,
  source: z.string().default('database'),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

// Generic API Response Schema
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean().default(true),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string().default(() => new Date().toISOString()),
  });

// Error Response Schema
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
});

// General Ledger Transaction Schema
const GeneralLedgerTransactionSchema = z.object({
  transactionId: z.string().optional(),
  date: z.string(),
  description: z.string().default(''),
  reference: z.string().optional(),
  contactName: z.string().optional(),
  debit: CurrencyAmountSchema,
  credit: CurrencyAmountSchema,
  runningBalance: CurrencyAmountSchema,
  transactionType: z.string().optional(),
  invoiceNumber: z.string().optional(),
  journalNumber: z.string().optional(),
});

// General Ledger Account Schema
const GeneralLedgerAccountSchema = z.object({
  accountId: z.string().optional(),
  accountCode: z.string().default(''),
  accountName: z.string().default('Unknown Account'),
  accountType: z.string().optional(),
  openingBalance: CurrencyAmountSchema,
  closingBalance: CurrencyAmountSchema,
  totalDebits: CurrencyAmountSchema,
  totalCredits: CurrencyAmountSchema,
  transactionCount: z.number().int().min(0).default(0),
  transactions: z.array(GeneralLedgerTransactionSchema).default([]),
});

// General Ledger Summary Schema
const GeneralLedgerSummarySchema = z.object({
  totalAccounts: z.number().int().min(0).default(0),
  totalTransactions: z.number().int().min(0).default(0),
  totalDebits: CurrencyAmountSchema,
  totalCredits: CurrencyAmountSchema,
  balanceDifference: CurrencyAmountSchema,
  isBalanced: z.boolean().default(false),
  dateRange: z.object({
    fromDate: DateStringSchema,
    toDate: DateStringSchema,
  }),
});

// General Ledger Report Schema
export const GeneralLedgerSchema = z.object({
  accounts: z.array(GeneralLedgerAccountSchema).default([]),
  summary: GeneralLedgerSummarySchema,
  fromDate: DateStringSchema,
  toDate: DateStringSchema,
  reportDate: DateStringSchema,
  source: z.string().default('database'),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

// Types derived from schemas
export type AgedPayablesData = z.infer<typeof AgedPayablesSchema>;
export type AgedReceivablesData = z.infer<typeof AgedReceivablesSchema>;
export type CashFlowData = z.infer<typeof CashFlowSchema>;
export type ProfitLossData = z.infer<typeof ProfitLossSchema>;
export type BalanceSheetData = z.infer<typeof BalanceSheetSchema>;
export type TrialBalanceData = z.infer<typeof TrialBalanceSchema>;
export type GeneralLedgerData = z.infer<typeof GeneralLedgerSchema>;
export type GeneralLedgerAccount = z.infer<typeof GeneralLedgerAccountSchema>;
export type GeneralLedgerTransaction = z.infer<typeof GeneralLedgerTransactionSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Validation helper functions
export const validateApiResponse = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } => {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      return { success: false, error: `Validation error: ${errorMessage}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
};

// Safe parse with fallback
export const safeParseWithFallback = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  fallback: z.infer<T>
): z.infer<T> => {
  try {
    return schema.parse(data);
  } catch (error) {
    console.warn('Data validation failed, using fallback:', error);
    return fallback;
  }
};

// Partial validation for updates
export const createPartialSchema = <T extends z.ZodTypeAny>(schema: T) => {
  return (schema as any).partial();
};