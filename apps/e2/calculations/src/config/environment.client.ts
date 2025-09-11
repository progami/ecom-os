/**
 * Client-safe Environment Configuration
 * Only includes environment variables that can be accessed on the client side
 */

// Helper function for client-safe env vars
const getClientEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  return value || defaultValue || '';
};

const getClientEnvVarAsBoolean = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getClientEnvVarAsNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Business rules configuration - safe for client
export const BUSINESS_RULES_CONFIG = {
  amazonReferralRate: getClientEnvVarAsNumber('NEXT_PUBLIC_AMAZON_REFERRAL_RATE', 0.15),
  amazonReturnAllowance: getClientEnvVarAsNumber('NEXT_PUBLIC_AMAZON_RETURN_ALLOWANCE', 0.01),
  tariffRate: getClientEnvVarAsNumber('NEXT_PUBLIC_TARIFF_RATE', 0.35),
  payrollTaxRate: getClientEnvVarAsNumber('NEXT_PUBLIC_PAYROLL_TAX_RATE', 0.153),
  defaultMarginThreshold: getClientEnvVarAsNumber('NEXT_PUBLIC_DEFAULT_MARGIN_THRESHOLD', 0.20),
  minimumOrderQuantity: getClientEnvVarAsNumber('NEXT_PUBLIC_MINIMUM_ORDER_QUANTITY', 100),
  leadTimeDays: getClientEnvVarAsNumber('NEXT_PUBLIC_LEAD_TIME_DAYS', 90),
  tacosRates: {
    2024: getClientEnvVarAsNumber('NEXT_PUBLIC_TACOS_RATE_2024', 0.15),
    2025: getClientEnvVarAsNumber('NEXT_PUBLIC_TACOS_RATE_2025', 0.13),
    2026: getClientEnvVarAsNumber('NEXT_PUBLIC_TACOS_RATE_2026', 0.12),
    2027: getClientEnvVarAsNumber('NEXT_PUBLIC_TACOS_RATE_2027', 0.12),
    2028: getClientEnvVarAsNumber('NEXT_PUBLIC_TACOS_RATE_2028', 0.10),
  },
  growthRates: {
    2024: getClientEnvVarAsNumber('NEXT_PUBLIC_GROWTH_RATE_2024', 0.25),
    2025: getClientEnvVarAsNumber('NEXT_PUBLIC_GROWTH_RATE_2025', 0.30),
    2026: getClientEnvVarAsNumber('NEXT_PUBLIC_GROWTH_RATE_2026', 0.35),
    2027: getClientEnvVarAsNumber('NEXT_PUBLIC_GROWTH_RATE_2027', 0.40),
    2028: getClientEnvVarAsNumber('NEXT_PUBLIC_GROWTH_RATE_2028', 0.45),
  },
} as const;

// Application configuration - safe for client
export const APP_CONFIG = {
  name: getClientEnvVar('NEXT_PUBLIC_APP_NAME', 'E2 Commerce Financial System'),
  title: getClientEnvVar('NEXT_PUBLIC_APP_TITLE', 'E2 Financial Modeling | Business Analytics Dashboard'),
  description: getClientEnvVar('NEXT_PUBLIC_APP_DESCRIPTION', 'Advanced financial modeling and business analytics for E2. Generate 5-year projections, analyze cash flow, and optimize business performance.'),
  version: getClientEnvVar('NEXT_PUBLIC_APP_VERSION', '1.0.0'),
  environment: (getClientEnvVar('NEXT_PUBLIC_NODE_ENV', 'development') as 'development' | 'staging' | 'production' | 'test'),
  debug: getClientEnvVarAsBoolean('NEXT_PUBLIC_DEBUG', false),
} as const;

// Company configuration - safe for client
export const COMPANY_CONFIG = {
  name: getClientEnvVar('NEXT_PUBLIC_COMPANY_NAME', 'E2 Trading LLC'),
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS,
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE,
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL,
} as const;

// API configuration - safe for client
export const API_CONFIG = {
  baseUrl: getClientEnvVar('NEXT_PUBLIC_API_BASE_URL', ''),
  timeout: getClientEnvVarAsNumber('NEXT_PUBLIC_API_TIMEOUT', 30000),
  retryAttempts: getClientEnvVarAsNumber('NEXT_PUBLIC_API_RETRY_ATTEMPTS', 3),
} as const;

// Feature flags - safe for client
export const FEATURE_FLAGS = {
  enableBankReconciliation: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_BANK_RECONCILIATION', true),
  enableAdvancedReports: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_ADVANCED_REPORTS', true),
  enableBulkImport: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_BULK_IMPORT', true),
  enableEmailNotifications: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_EMAIL_NOTIFICATIONS', false),
  enableInventoryTracking: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_INVENTORY_TRACKING', true),
  enableProductMargins: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_PRODUCT_MARGINS', true),
  enableCashFlowForecast: getClientEnvVarAsBoolean('NEXT_PUBLIC_ENABLE_CASH_FLOW_FORECAST', true),
} as const;