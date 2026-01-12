/**
 * SOP Configuration for Transaction Reference/Memo Generation
 *
 * Reference (DocNumber): Max 21 characters
 * Memo (PrivateNote): Max 4000 characters
 */

export interface AccountConfig {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface ServiceTypeConfig {
  id: string;
  name: string;
  referenceFields: string[];
  memoFields: string[];
  referenceTemplate: string;
  memoTemplate: string;
  note?: string;
}

export interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'period';
  options?: string[];
  placeholder?: string;
  maxLength?: number;
}

// Account definitions based on Chart of Accounts
export const ACCOUNTS: AccountConfig[] = [
  { id: '321', code: '321', name: 'Contract Salaries', category: 'HR / Admin' },
  { id: '325', code: '325', name: 'Research & Development', category: 'Product' },
  { id: '331', code: '331', name: '3PL', category: 'Ops' },
  { id: '332', code: '332', name: 'Land Freight', category: 'Ops' },
  { id: '333', code: '333', name: 'Manufacturing', category: 'Ops' },
  { id: '334', code: '334', name: 'Freight & Custom Duty', category: 'Ops' },
  { id: '401', code: '401', name: 'Accounting', category: 'Finance' },
  { id: '429', code: '429', name: 'General Operating Expenses', category: 'Ops' },
  { id: '437', code: '437', name: 'Interest Paid', category: 'Finance' },
  { id: '441', code: '441', name: 'Legal and Compliance', category: 'Legal' },
  { id: '456', code: '456', name: 'Travel', category: 'HR / Admin' },
  { id: '458', code: '458', name: 'Office Supplies', category: 'HR / Admin' },
  { id: '459', code: '459', name: 'Overseas VAT', category: 'Finance' },
  { id: '460', code: '460', name: 'Subsistence', category: 'HR / Admin' },
  { id: '463', code: '463', name: 'IT Software', category: 'Product' },
  { id: '489', code: '489', name: 'Telephone & Internet', category: 'Ops' },
  { id: '820', code: '820', name: 'VAT', category: 'Finance' },
  { id: '835', code: '835', name: 'Director\'s Loan Account', category: 'Finance' },
];

// Field definitions
export const FIELDS: Record<string, FieldConfig> = {
  invoiceNumber: {
    id: 'invoiceNumber',
    label: 'Invoice #',
    type: 'text',
    placeholder: 'INV-9595',
    maxLength: 15,
  },
  period: {
    id: 'period',
    label: 'Period',
    type: 'period',
    placeholder: 'Dec24',
  },
  frequency: {
    id: 'frequency',
    label: 'Frequency',
    type: 'select',
    options: ['Monthly', 'Quarterly', 'Yearly', 'One-time'],
  },
  region: {
    id: 'region',
    label: 'Region',
    type: 'select',
    options: ['UK', 'US', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU'],
  },
  department: {
    id: 'department',
    label: 'Department',
    type: 'select',
    options: ['Operations', 'Sales', 'Marketing', 'Admin', 'Finance', 'Product', 'HR'],
  },
  service: {
    id: 'service',
    label: 'Service',
    type: 'text',
    placeholder: 'e.g., Freight, Storage',
  },
  shortTag: {
    id: 'shortTag',
    label: 'Short Tag',
    type: 'text',
    placeholder: 'Brief description',
    maxLength: 30,
  },
  vendor: {
    id: 'vendor',
    label: 'Vendor',
    type: 'text',
    placeholder: 'Vendor name',
  },
  notes: {
    id: 'notes',
    label: 'Notes',
    type: 'text',
    placeholder: 'Additional notes',
  },
};

// Service types per account
export const SERVICE_TYPES: Record<string, ServiceTypeConfig[]> = {
  '321': [
    {
      id: 'salary',
      name: 'Salary',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{department}_Salary_{shortTag}',
      note: 'For active contract employees',
    },
    {
      id: 'compensation',
      name: 'Compensation',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{department}_Compensation_{shortTag}',
      note: 'For passive services, retainer services',
    },
    {
      id: 'freelance',
      name: 'Freelance',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{department}_Freelance_{shortTag}',
      note: 'Freelance services, not permanent employees',
    },
  ],
  '325': [
    {
      id: 'research_subscription',
      name: 'Research Subscription',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: 'Research Subscription_{shortTag}',
      note: 'Recurring R&D expenses',
    },
    {
      id: 'research_expense',
      name: 'Research Expense',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Research Expense_{shortTag}',
      note: 'One-time R&D expenses',
    },
  ],
  '331': [
    {
      id: 'storage',
      name: 'Storage',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Storage_{shortTag}',
      note: '3PL storage charges',
    },
    {
      id: 'internal_handling',
      name: 'Internal Handling',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Internal Handling_{shortTag}',
      note: 'Handling costs during internal storage',
    },
    {
      id: 'container_unloading',
      name: 'Container Unloading',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Container Unloading_{shortTag}',
      note: 'Container unloading at 3PL warehouse',
    },
    {
      id: 'outbound_handling',
      name: 'Outbound Handling',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Outbound Handling_{shortTag}',
      note: 'Costs for sending freight to Amazon',
    },
  ],
  '332': [
    {
      id: 'ltl_ftl',
      name: 'LTL/FTL',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'LTL_{shortTag}',
      note: 'LTL or FTL shipments to Amazon',
    },
  ],
  '333': [
    {
      id: 'production',
      name: 'Production',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Production_{shortTag}',
      note: 'Manufacturing cost for goods',
    },
    {
      id: 'inspection',
      name: 'Inspection',
      referenceFields: ['invoiceNumber'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Inspection_{shortTag}',
      note: 'Inspection cost for goods',
    },
    {
      id: 'other',
      name: 'Other',
      referenceFields: ['invoiceNumber'],
      memoFields: ['shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Other_{shortTag}',
      note: 'Other manufacturing services',
    },
  ],
  '334': [
    {
      id: 'freight',
      name: 'Freight',
      referenceFields: ['invoiceNumber'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{region}_Freight_{shortTag}',
      note: 'Freight, documentation and related costs',
    },
    {
      id: 'customs_duty',
      name: 'Customs Duty',
      referenceFields: ['invoiceNumber'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{region}_Customs Duty_{shortTag}',
      note: 'Customs duty charged at port',
    },
  ],
  '401': [
    {
      id: 'tax_management',
      name: 'Tax Management',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{region}_Tax Management_{shortTag}',
      note: 'Tax management, CT etc.',
    },
    {
      id: 'software_subscription',
      name: 'Software Subscription',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: 'Software Subscription_{shortTag}',
      note: 'Accounting software subscriptions',
    },
    {
      id: 'adhoc',
      name: 'Adhoc',
      referenceFields: ['invoiceNumber', 'period'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{region}_Adhoc_{shortTag}',
      note: 'One-off accounting tasks',
    },
  ],
  '429': [
    {
      id: 'adhoc',
      name: 'Adhoc',
      referenceFields: ['invoiceNumber'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{department}_{shortTag}',
      note: 'General expenses catch-all',
    },
  ],
  '437': [
    {
      id: 'adhoc',
      name: 'Adhoc',
      referenceFields: ['invoiceNumber'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{region}_Adhoc_{shortTag}',
      note: 'Interest payments',
    },
  ],
  '441': [
    {
      id: 'epr',
      name: 'EPR',
      referenceFields: ['invoiceNumber'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{region}_EPR_{shortTag}',
      note: 'EPR Services',
    },
    {
      id: 'trademark',
      name: 'Trademark',
      referenceFields: ['invoiceNumber'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{region}_Trademark_{shortTag}',
      note: 'Trademark services',
    },
    {
      id: 'adhoc',
      name: 'Adhoc',
      referenceFields: ['invoiceNumber'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{region}_Adhoc_{shortTag}',
      note: 'Any adhoc legal services',
    },
  ],
  '456': [
    {
      id: 'travel',
      name: 'Travel',
      referenceFields: ['invoiceNumber'],
      memoFields: ['shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Travel_{shortTag}',
      note: 'Travel expenses',
    },
  ],
  '458': [
    {
      id: 'office_supplies',
      name: 'Office Supplies',
      referenceFields: ['invoiceNumber'],
      memoFields: ['shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'Office Supplies_{shortTag}',
      note: 'Office supply purchases',
    },
  ],
  '459': [
    {
      id: 'overseas_vat',
      name: 'Overseas VAT',
      referenceFields: ['invoiceNumber', 'frequency', 'period'],
      memoFields: ['region', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{region}_Overseas VAT_{shortTag}',
      note: 'Overseas VAT not claimed',
    },
  ],
  '463': [
    {
      id: 'amazon_subscription',
      name: 'Amazon Subscription',
      referenceFields: ['invoiceNumber', 'frequency', 'period'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{department}_AmazonSubscription_{shortTag}',
      note: 'Subscriptions related to Amazon/store',
    },
    {
      id: 'operating_subscription',
      name: 'Operating Subscription',
      referenceFields: ['invoiceNumber', 'frequency', 'period'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{department}_OperatingSubscription_{shortTag}',
      note: 'Operating subscriptions (ChatGPT, AWS, etc.)',
    },
  ],
  '489': [
    {
      id: 'operating_subscription',
      name: 'Operating Subscription',
      referenceFields: ['invoiceNumber', 'frequency', 'period'],
      memoFields: ['department', 'service', 'shortTag'],
      referenceTemplate: '{invoiceNumber}_{period}',
      memoTemplate: '{department}_OperatingSubscription_{shortTag}',
      note: 'Telephone & internet subscriptions',
    },
  ],
  '820': [
    {
      id: 'vat_paid',
      name: 'VAT Paid',
      referenceFields: ['invoiceNumber'],
      memoFields: ['frequency', 'period', 'shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: '{frequency}_{period}_{shortTag}',
      note: 'VAT payments to HMRC',
    },
  ],
  '835': [
    {
      id: 'directors_loan',
      name: 'Director\'s Loan',
      referenceFields: ['invoiceNumber'],
      memoFields: ['shortTag'],
      referenceTemplate: '{invoiceNumber}',
      memoTemplate: 'DirectorsLoan_{shortTag}',
      note: 'Director\'s loan transactions',
    },
  ],
};

// Default service type for accounts not in the config
export const DEFAULT_SERVICE_TYPE: ServiceTypeConfig = {
  id: 'general',
  name: 'General',
  referenceFields: ['invoiceNumber'],
  memoFields: ['shortTag'],
  referenceTemplate: '{invoiceNumber}',
  memoTemplate: '{shortTag}',
  note: 'General transaction',
};

/**
 * Generate reference string from template and values
 */
export function generateReference(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(`{${key}}`, value || '');
  }
  // Clean up any remaining placeholders and extra underscores
  result = result.replace(/\{[^}]+\}/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  // Truncate to 21 chars for DocNumber
  return result.slice(0, 21);
}

/**
 * Generate memo string from template and values
 */
export function generateMemo(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(`{${key}}`, value || '');
  }
  // Clean up any remaining placeholders and extra underscores
  result = result.replace(/\{[^}]+\}/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  // Truncate to 4000 chars for PrivateNote
  return result.slice(0, 4000);
}

/**
 * Get service types for an account
 */
export function getServiceTypesForAccount(accountId: string): ServiceTypeConfig[] {
  return SERVICE_TYPES[accountId] || [DEFAULT_SERVICE_TYPE];
}

/**
 * Find account by QBO account name (fuzzy match)
 */
export function findAccountByName(qboAccountName: string): AccountConfig | undefined {
  const normalized = qboAccountName.toLowerCase();
  return ACCOUNTS.find(acc =>
    normalized.includes(acc.code) ||
    normalized.includes(acc.name.toLowerCase())
  );
}

/**
 * Check if a reference follows the expected format
 */
export function isReferenceCompliant(reference: string | undefined): 'compliant' | 'empty' | 'unknown' {
  if (!reference || reference.trim() === '') return 'empty';
  // Basic check: should have at least an invoice-like pattern
  if (/^[A-Za-z0-9\-_]+/.test(reference)) return 'compliant';
  return 'unknown';
}

/**
 * Check if a memo follows the expected format
 */
export function isMemoCompliant(memo: string | undefined): 'compliant' | 'empty' | 'unknown' {
  if (!memo || memo.trim() === '') return 'empty';
  // Basic check: should have underscore-separated segments
  if (/_/.test(memo)) return 'compliant';
  return 'unknown';
}

/**
 * Get overall compliance status
 */
export function getComplianceStatus(reference: string | undefined, memo: string | undefined): 'compliant' | 'partial' | 'non-compliant' {
  const refStatus = isReferenceCompliant(reference);
  const memoStatus = isMemoCompliant(memo);

  if (refStatus === 'compliant' && memoStatus === 'compliant') return 'compliant';
  if (refStatus === 'empty' && memoStatus === 'empty') return 'non-compliant';
  return 'partial';
}
