import ProductService from '@/services/database/ProductService';
import SystemConfigService from '@/services/database/SystemConfigService';

// Product validation
export function validateProducts(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const productService = ProductService.getInstance();
  let products;
  try {
    products = productService.getAllProducts();
  } catch (error) {
    errors.push('ProductService cache not initialized. Cannot validate products.');
    return { valid: false, errors };
  }

  Object.entries(products).forEach(([sku, product]) => {
    // Check required fields
    if (!product.sku || typeof product.sku !== 'string') {
      errors.push(`Product missing valid SKU: ${JSON.stringify(product)}`);
    }
    if (!product.name || typeof product.name !== 'string') {
      errors.push(`Product ${sku} missing valid name`);
    }
    
    // Validate price
    if (typeof product.price !== 'number' || product.price <= 0) {
      errors.push(`Product ${sku} has invalid price: ${product.price}`);
    }
    
    // Validate manufacturing cost
    if (typeof product.manufacturingCost !== 'number' || product.manufacturingCost < 0) {
      errors.push(`Product ${sku} has invalid manufacturing cost: ${product.manufacturingCost}`);
    }
    
    // Validate freight cost
    if (typeof product.freightCost !== 'number' || product.freightCost < 0) {
      errors.push(`Product ${sku} has invalid freight cost: ${product.freightCost}`);
    }
    
    // Validate warehouse cost
    if (typeof product.warehouseCost !== 'number' || product.warehouseCost < 0) {
      errors.push(`Product ${sku} has invalid warehouse cost: ${product.warehouseCost}`);
    }
    
    // Validate FBA fee
    if (typeof product.fulfillmentFee !== 'number' || product.fulfillmentFee < 0) {
      errors.push(`Product ${sku} has invalid FBA fee: ${product.fulfillmentFee}`);
    }
    
    // Validate margin
    const totalCost = product.manufacturingCost + product.freightCost + product.warehouseCost + product.fulfillmentFee;
    if (totalCost > product.price) {
      errors.push(`Product ${sku} has total cost (${totalCost}) greater than price (${product.price})`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// Account codes validation
export async function validateAccountCodes(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();

  try {
    const configService = SystemConfigService.getInstance();
    const accountCodes = await configService.getGLAccountCodes();

    Object.entries(accountCodes).forEach(([key, account]: [string, any]) => {
      // Check for duplicate codes
      if (seenCodes.has(account.code)) {
        errors.push(`Duplicate account code: ${account.code} (${key})`);
      }
      seenCodes.add(account.code);

      // Check for duplicate names
      if (seenNames.has(account.name)) {
        errors.push(`Duplicate account name: ${account.name} (${key})`);
      }
      seenNames.add(account.name);

      // Validate code format (either 4 digits or LMB codes)
      if (!/^(\d{3,4}|LMB\d+[A-Z]?)$/.test(account.code)) {
        errors.push(`Invalid account code format: ${account.code} (${key}) - should be 3-4 digits or LMB format`);
      }

      // Validate required fields
      if (!account.name || typeof account.name !== 'string') {
        errors.push(`Account ${key} missing valid name`);
      }
      if (!account.type || typeof account.type !== 'string') {
        errors.push(`Account ${key} missing valid type`);
      }
    });
  } catch (error) {
    errors.push(`Failed to load account codes from database: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Business rules validation
export async function validateBusinessRules(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const configService = SystemConfigService.getInstance();
    const businessRules = await configService.getBusinessRules();

    // Validate AMAZON_FEES percentages (0-1)
    if (typeof businessRules.amazonReferralRate !== 'number' || businessRules.amazonReferralRate < 0 || businessRules.amazonReferralRate > 1) {
      errors.push(`Invalid Amazon referral rate: ${businessRules.amazonReferralRate} (should be between 0 and 1)`);
    }
    
    if (typeof businessRules.amazonReturnAllowance !== 'number' || businessRules.amazonReturnAllowance < 0 || businessRules.amazonReturnAllowance > 1) {
      errors.push(`Invalid Amazon return allowance: ${businessRules.amazonReturnAllowance} (should be between 0 and 1)`);
    }

    // Validate TAX_RATES percentages (0-1)
    if (typeof businessRules.tariffRate !== 'number' || businessRules.tariffRate < 0 || businessRules.tariffRate > 1) {
      errors.push(`Invalid tariff rate: ${businessRules.tariffRate} (should be between 0 and 1)`);
    }
    
    if (typeof businessRules.payrollTaxRate !== 'number' || businessRules.payrollTaxRate < 0 || businessRules.payrollTaxRate > 1) {
      errors.push(`Invalid payroll tax rate: ${businessRules.payrollTaxRate} (should be between 0 and 1)`);
    }
  } catch (error) {
    errors.push(`Failed to load business rules from database: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Date validation
export function validateDateFormat(date: string): boolean {
  // Check ISO 8601 format (YYYY-MM-DD)
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(date)) {
    return false;
  }

  // Check if it's a valid date
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(date);
}

// Validate all configuration
export async function validateAllConfig(): Promise<{ valid: boolean; errors: string[] }> {
  const allErrors: string[] = [];

  const productValidation = validateProducts();
  if (!productValidation.valid) {
    allErrors.push(...productValidation.errors);
  }

  const accountValidation = await validateAccountCodes();
  if (!accountValidation.valid) {
    allErrors.push(...accountValidation.errors);
  }

  const rulesValidation = await validateBusinessRules();
  if (!rulesValidation.valid) {
    allErrors.push(...rulesValidation.errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

// Helper to check if a value might be hardcoded
export function isHardcodedValue(value: any, knownHardcodedValues: any[]): boolean {
  return knownHardcodedValues.some(hardcoded => {
    if (typeof value === 'number' && typeof hardcoded === 'number') {
      return Math.abs(value - hardcoded) < 0.001; // Handle floating point comparison
    }
    return value === hardcoded;
  });
}