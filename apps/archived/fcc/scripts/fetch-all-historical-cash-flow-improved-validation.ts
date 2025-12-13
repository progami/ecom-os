// Enhanced validation function with improvements
interface CashFlowValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  metadata?: {
    businessSize?: 'small' | 'medium' | 'large';
    industryType?: string;
  };
}

// Improved validation function
function validateCashFlowNumbers(data: any, options?: {
  businessSize?: 'small' | 'medium' | 'large';
  industryType?: string;
  customThresholds?: {
    largeTransaction?: number;
    unusualVariance?: number;
  };
}): CashFlowValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isValid = true;

  // Dynamic thresholds based on business size
  const thresholds = {
    small: { largeTransaction: 1000000, unusualVariance: 0.5 },
    medium: { largeTransaction: 10000000, unusualVariance: 0.3 },
    large: { largeTransaction: 100000000, unusualVariance: 0.2 }
  };
  
  const businessSize = options?.businessSize || 'medium';
  const threshold = options?.customThresholds || thresholds[businessSize];

  try {
    const netCashFlow = data.summary?.netCashFlow || 0;
    const openingBalance = data.summary?.openingBalance || 0;
    const closingBalance = data.summary?.closingBalance || 0;
    const operatingCash = data.operatingActivities?.netCashFromOperating || 0;
    const investingCash = data.investingActivities?.netCashFromInvesting || 0;
    const financingCash = data.financingActivities?.netCashFromFinancing || 0;
    
    // 1. FUNDAMENTAL EQUATION CHECKS (unchanged - these are correct)
    const calculatedNetCashFlow = operatingCash + investingCash + financingCash;
    const calculatedClosingBalance = openingBalance + netCashFlow;
    
    // Allow for small rounding differences (0.01)
    if (Math.abs(calculatedNetCashFlow - netCashFlow) > 0.01) {
      errors.push(`Net cash flow mismatch: Calculated ${calculatedNetCashFlow.toFixed(2)}, Reported ${netCashFlow.toFixed(2)}`);
      isValid = false;
    }
    
    if (Math.abs(calculatedClosingBalance - closingBalance) > 0.01) {
      errors.push(`Closing balance mismatch: Opening ${openingBalance.toFixed(2)} + Net Flow ${netCashFlow.toFixed(2)} = ${calculatedClosingBalance.toFixed(2)}, but reported ${closingBalance.toFixed(2)}`);
      isValid = false;
    }
    
    // 2. ENHANCED REASONABLENESS CHECKS
    const absOperating = Math.abs(operatingCash);
    const absInvesting = Math.abs(investingCash);
    const absFinancing = Math.abs(financingCash);
    
    // Dynamic threshold warnings
    if (absOperating > threshold.largeTransaction) {
      warnings.push(`Large operating cash flow for ${businessSize} business: £${operatingCash.toFixed(2)}`);
    }
    if (absInvesting > threshold.largeTransaction) {
      warnings.push(`Large investing cash flow for ${businessSize} business: £${investingCash.toFixed(2)}`);
    }
    if (absFinancing > threshold.largeTransaction) {
      warnings.push(`Large financing cash flow for ${businessSize} business: £${financingCash.toFixed(2)}`);
    }
    
    // 3. ADDITIONAL INTEGRITY CHECKS
    
    // Check for data consistency
    if (closingBalance < 0) {
      warnings.push(`Negative closing cash balance: £${closingBalance.toFixed(2)}`);
    }
    
    // Check for zero activity
    if (operatingCash === 0 && investingCash === 0 && financingCash === 0) {
      warnings.push('All cash flow activities are zero - may indicate no transactions or data issue');
    }
    
    // Check for unusual patterns
    if (operatingCash < 0 && Math.abs(operatingCash) > absInvesting + absFinancing) {
      warnings.push('Negative operating cash flow exceeds investing and financing combined - may indicate distress');
    }
    
    // 4. NEW VALIDATION CHECKS
    
    // Check for extreme volatility between opening and closing
    if (openingBalance !== 0) {
      const changeRatio = Math.abs((closingBalance - openingBalance) / openingBalance);
      if (changeRatio > 5) { // 500% change
        warnings.push(`Extreme cash balance change: ${(changeRatio * 100).toFixed(0)}% - verify data accuracy`);
      }
    }
    
    // Check for suspicious round numbers (potential data entry errors)
    const suspiciouslyRound = [operatingCash, investingCash, financingCash].filter(
      val => val !== 0 && val % 10000 === 0
    ).length;
    if (suspiciouslyRound >= 2) {
      warnings.push('Multiple suspiciously round numbers detected - verify source data');
    }
    
    // Industry-specific checks
    if (options?.industryType === 'retail' && operatingCash < 0) {
      warnings.push('Negative operating cash flow unusual for retail business');
    }
    
    // Check for missing exchange rate differences (if applicable)
    const hasExchangeDiff = data.summary?.exchangeRateDifferences;
    if (hasExchangeDiff && Math.abs(hasExchangeDiff) > 0) {
      const recalculated = openingBalance + netCashFlow + hasExchangeDiff;
      if (Math.abs(recalculated - closingBalance) > 0.01) {
        errors.push(`Exchange rate differences not properly accounted: £${hasExchangeDiff.toFixed(2)}`);
        isValid = false;
      }
    }
    
    // Validate individual line items if available
    if (data.operatingActivities?.lineItems) {
      const operatingSum = data.operatingActivities.lineItems.reduce(
        (sum: number, item: any) => sum + (item.amount || 0), 0
      );
      if (Math.abs(operatingSum - operatingCash) > 0.01) {
        errors.push(`Operating activities line items don't sum correctly`);
        isValid = false;
      }
    }
    
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    isValid = false;
  }
  
  return { 
    isValid, 
    warnings, 
    errors,
    metadata: {
      businessSize,
      industryType: options?.industryType
    }
  };
}

// Example usage in the fetch function:
/*
const validation = validateCashFlowNumbers(responseData, {
  businessSize: 'medium', // Could be derived from company profile
  industryType: 'trading', // Could be from company metadata
  customThresholds: {
    largeTransaction: 5000000, // £5M for this specific company
    unusualVariance: 0.4
  }
});
*/