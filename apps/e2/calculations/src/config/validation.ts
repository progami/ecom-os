/**
 * Validation Rules Configuration
 * Centralizes validation rules, limits, and constraints
 */

export interface ValidationRule {
  min?: number;
  max?: number;
  required?: boolean;
  pattern?: RegExp;
  message?: string;
}

export interface FieldValidation {
  [fieldName: string]: ValidationRule;
}

// Numeric limits
export const NUMERIC_LIMITS = {
  AMOUNT: {
    MIN: 0.01,
    MAX: 999999999.99,
    DECIMAL_PLACES: 2,
  },
  PERCENTAGE: {
    MIN: 0,
    MAX: 100,
    DECIMAL_PLACES: 2,
  },
  QUANTITY: {
    MIN: 1,
    MAX: 999999,
    DECIMAL_PLACES: 0,
  },
  PRICE: {
    MIN: 0.01,
    MAX: 999999.99,
    DECIMAL_PLACES: 2,
  },
} as const;

// String length limits
export const STRING_LIMITS = {
  NAME: {
    MIN: 1,
    MAX: 255,
  },
  DESCRIPTION: {
    MIN: 0,
    MAX: 1000,
  },
  CODE: {
    MIN: 1,
    MAX: 50,
  },
  EMAIL: {
    MIN: 5,
    MAX: 255,
  },
  PHONE: {
    MIN: 10,
    MAX: 20,
  },
} as const;

// Date constraints
export const DATE_CONSTRAINTS = {
  MIN_YEAR: 2020,
  MAX_FUTURE_YEARS: 10,
  MAX_PAST_YEARS: 10,
} as const;

// File upload constraints
export const FILE_CONSTRAINTS = {
  MAX_SIZE_MB: 10,
  ALLOWED_TYPES: {
    CSV: ['text/csv', 'application/csv'],
    EXCEL: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    PDF: ['application/pdf'],
    IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  },
} as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-()]+$/,
  ACCOUNT_CODE: /^\d{4}$/,
  CURRENCY: /^\d+(\.\d{1,2})?$/,
  PERCENTAGE: /^\d+(\.\d{1,2})?$/,
  INTEGER: /^\d+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  SKU: /^[A-Z0-9-_]+$/,
} as const;

// Field-specific validation rules
export const FIELD_VALIDATIONS: Record<string, FieldValidation> = {
  expense: {
    amount: {
      min: NUMERIC_LIMITS.AMOUNT.MIN,
      max: NUMERIC_LIMITS.AMOUNT.MAX,
      required: true,
      pattern: VALIDATION_PATTERNS.CURRENCY,
      message: 'Amount must be a valid currency value',
    },
    description: {
      min: STRING_LIMITS.DESCRIPTION.MIN,
      max: STRING_LIMITS.DESCRIPTION.MAX,
      required: true,
      message: 'Description is required',
    },
    category: {
      required: true,
      message: 'Category is required',
    },
    date: {
      required: true,
      message: 'Date is required',
    },
  },
  revenue: {
    amount: {
      min: NUMERIC_LIMITS.AMOUNT.MIN,
      max: NUMERIC_LIMITS.AMOUNT.MAX,
      required: true,
      pattern: VALIDATION_PATTERNS.CURRENCY,
      message: 'Amount must be a valid currency value',
    },
    quantity: {
      min: NUMERIC_LIMITS.QUANTITY.MIN,
      max: NUMERIC_LIMITS.QUANTITY.MAX,
      required: true,
      pattern: VALIDATION_PATTERNS.INTEGER,
      message: 'Quantity must be a positive integer',
    },
    unitPrice: {
      min: NUMERIC_LIMITS.PRICE.MIN,
      max: NUMERIC_LIMITS.PRICE.MAX,
      required: true,
      pattern: VALIDATION_PATTERNS.CURRENCY,
      message: 'Unit price must be a valid currency value',
    },
  },
  account: {
    code: {
      min: STRING_LIMITS.CODE.MIN,
      max: STRING_LIMITS.CODE.MAX,
      required: true,
      pattern: VALIDATION_PATTERNS.ACCOUNT_CODE,
      message: 'Account code must be 4 digits',
    },
    name: {
      min: STRING_LIMITS.NAME.MIN,
      max: STRING_LIMITS.NAME.MAX,
      required: true,
      message: 'Account name is required',
    },
  },
} as const;

// Validation helper functions
export const validateAmount = (value: number): boolean => {
  return value >= NUMERIC_LIMITS.AMOUNT.MIN && value <= NUMERIC_LIMITS.AMOUNT.MAX;
};

export const validatePercentage = (value: number): boolean => {
  return value >= NUMERIC_LIMITS.PERCENTAGE.MIN && value <= NUMERIC_LIMITS.PERCENTAGE.MAX;
};

export const validateEmail = (email: string): boolean => {
  return VALIDATION_PATTERNS.EMAIL.test(email);
};

export const validateAccountCode = (code: string): boolean => {
  return VALIDATION_PATTERNS.ACCOUNT_CODE.test(code);
};

export const validateFileSize = (sizeInBytes: number): boolean => {
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB <= FILE_CONSTRAINTS.MAX_SIZE_MB;
};

export const validateFileType = (mimeType: string, category: keyof typeof FILE_CONSTRAINTS.ALLOWED_TYPES): boolean => {
  const allowedTypes = FILE_CONSTRAINTS.ALLOWED_TYPES[category] as readonly string[];
  return allowedTypes.includes(mimeType);
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(NUMERIC_LIMITS.PERCENTAGE.DECIMAL_PLACES)}%`;
};