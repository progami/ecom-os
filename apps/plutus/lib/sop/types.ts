/**
 * Enhanced SOP Types - Linked to QBO Accounts
 *
 * This is the skeleton for accepting new SOPs.
 * SOPs are now linked to QBO Account IDs, not hardcoded codes.
 */

// QBO Account reference (from Chart of Accounts)
export interface QboAccountRef {
  id: string; // QBO Account ID
  name: string;
  type: string; // e.g., "Expense", "Bank"
  subType?: string; // e.g., "Advertising"
}

// Field definition for dynamic forms
export interface SopFieldDef {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'period' | 'number';
  required?: boolean;
  options?: string[]; // For select type
  placeholder?: string;
  maxLength?: number;
  defaultValue?: string;
  helpText?: string;
}

// Service type configuration within an SOP
export interface SopServiceType {
  id: string;
  name: string;
  description?: string;

  // Fields required for this service type
  referenceFields: string[]; // Field IDs for reference (DocNumber)
  memoFields: string[]; // Field IDs for memo (PrivateNote)

  // Templates with {fieldId} placeholders
  referenceTemplate: string; // Max 21 chars output
  memoTemplate: string; // Max 4000 chars output

  // Optional rules
  rules?: SopRule[];
}

// Rule for auto-population or validation
export interface SopRule {
  id: string;
  type: 'auto-populate' | 'validation' | 'conditional';
  condition?: {
    field: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
    value: string;
  };
  action: {
    field: string;
    value?: string;
    template?: string;
  };
}

// Main SOP configuration for an account
export interface AccountSop {
  id: string; // UUID
  qboAccountId: string; // QBO Account ID (links to Chart of Accounts)
  qboAccountName?: string; // Cached for display
  qboAccountType?: string; // Cached for filtering

  // Service types available for this account
  serviceTypes: SopServiceType[];

  // Custom fields for this account (beyond global fields)
  customFields?: SopFieldDef[];

  // Default service type ID
  defaultServiceTypeId?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  version: number;
}

// Global field definitions (shared across all SOPs)
export interface GlobalSopFields {
  fields: SopFieldDef[];
  version: number;
  updatedAt: string;
}

// SOP configuration store (all SOPs)
export interface SopStore {
  version: number;
  globalFields: GlobalSopFields;
  accountSops: AccountSop[];
  updatedAt: string;
}

// Transaction with SOP fields applied
export interface SopTransactionUpdate {
  purchaseId: string;
  syncToken: string;
  paymentType: string;
  reference?: string; // Generated DocNumber
  memo?: string; // Generated PrivateNote
  fieldValues?: Record<string, string>; // Input values used
  serviceTypeId?: string; // Service type used
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

// Bulk update request
export interface BulkUpdateRequest {
  updates: SopTransactionUpdate[];
}

// Bulk update response
export interface BulkUpdateResponse {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    purchaseId: string;
    status: 'success' | 'error';
    error?: string;
  }>;
}

// Compliance status for a transaction
export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant';

// Transaction compliance info
export interface TransactionCompliance {
  purchaseId: string;
  hasReference: boolean;
  hasMemo: boolean;
  referenceCompliant: boolean;
  memoCompliant: boolean;
  status: ComplianceStatus;
  matchedSopId?: string;
  matchedServiceTypeId?: string;
}

// Reconciliation batch
export interface ReconciliationBatch {
  id: string;
  name?: string;
  accountId?: string; // Filter by account
  transactions: string[]; // Purchase IDs
  status: 'draft' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  createdAt: string;
  completedAt?: string;
}

// Default global fields
export const DEFAULT_GLOBAL_FIELDS: GlobalSopFields = {
  version: 1,
  updatedAt: new Date().toISOString(),
  fields: [
    {
      id: 'invoiceNumber',
      label: 'Invoice #',
      type: 'text',
      placeholder: 'INV-9595',
      maxLength: 15,
    },
    {
      id: 'period',
      label: 'Period',
      type: 'period',
      placeholder: 'Dec24',
      helpText: 'Format: MonYY (e.g., Dec24, Jan25)',
    },
    {
      id: 'frequency',
      label: 'Frequency',
      type: 'select',
      options: ['Monthly', 'Quarterly', 'Yearly', 'One-time'],
    },
    {
      id: 'region',
      label: 'Region',
      type: 'select',
      options: ['UK', 'US', 'DE', 'FR', 'ES', 'IT', 'CA', 'AU', 'CN', 'JP'],
    },
    {
      id: 'department',
      label: 'Department',
      type: 'select',
      options: ['Operations', 'Sales', 'Marketing', 'Admin', 'Finance', 'Product', 'HR', 'Legal'],
    },
    {
      id: 'vendor',
      label: 'Vendor',
      type: 'text',
      placeholder: 'Vendor name',
    },
    {
      id: 'shortTag',
      label: 'Short Tag',
      type: 'text',
      placeholder: 'Brief description',
      maxLength: 30,
    },
    {
      id: 'notes',
      label: 'Notes',
      type: 'text',
      placeholder: 'Additional notes',
    },
  ],
};

// Default SOP store
export const DEFAULT_SOP_STORE: SopStore = {
  version: 1,
  globalFields: DEFAULT_GLOBAL_FIELDS,
  accountSops: [],
  updatedAt: new Date().toISOString(),
};
