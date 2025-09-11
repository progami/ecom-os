// src/lib/dataValidator.ts
import { 
  ProductMargin, 
  Assumptions,
  MonthlyData,
  CSVData 
} from '@/types/financial';

export interface DataValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  expected?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}

export interface ValidationSummary {
  totalErrors: number;
  totalWarnings: number;
  criticalErrors: number;
  dataCompleteness: number; // Percentage 0-100
}

/**
 * Validate product margins data
 */
export function validateProductMargins(margins: ProductMargin[]): DataValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!margins || margins.length === 0) {
    errors.push({
      field: 'productMargins',
      message: 'No product margins data provided'
    });
    
    return {
      isValid: false,
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: 0,
        criticalErrors: 1,
        dataCompleteness: 0
      }
    };
  }
  
  margins.forEach((margin, index) => {
    // Check required fields
    if (!margin.sku) {
      errors.push({
        field: `productMargins[${index}].sku`,
        message: 'SKU is required'
      });
    }
    
    // Validate retail price
    if (margin.retailPrice <= 0) {
      errors.push({
        field: `productMargins[${index}].retailPrice`,
        message: 'Retail price must be greater than 0',
        value: margin.retailPrice
      });
    }
    
    // Validate costs
    if (margin.totalCogs !== undefined && margin.totalCogs < 0) {
      errors.push({
        field: `productMargins[${index}].totalCogs`,
        message: 'Total COGS cannot be negative',
        value: margin.totalCogs
      });
    }
    
    // Validate margin calculations
    if (margin.totalCogs !== undefined && margin.grossMargin !== undefined) {
      const expectedGrossProfit = margin.retailPrice - margin.totalCogs;
      const marginDiff = Math.abs((margin.grossMargin || 0) - expectedGrossProfit);
      if (marginDiff > 0.01) {
        warnings.push({
          field: `productMargins[${index}].grossMargin`,
          message: 'Gross profit calculation mismatch',
          value: margin.grossMargin,
          suggestion: `Expected: ${expectedGrossProfit.toFixed(2)}`
        });
      }
    }
    
    // Validate gross margin percentage
    if (margin.retailPrice > 0 && margin.grossMargin !== undefined && margin.totalCogs !== undefined) {
      const grossProfit = margin.retailPrice - margin.totalCogs;
      const expectedGrossMarginPct = (grossProfit / margin.retailPrice) * 100;
      const marginPctDiff = Math.abs((margin.grossMarginPercentage || 0) - expectedGrossMarginPct);
      if (marginPctDiff > 0.1) {
        warnings.push({
          field: `productMargins[${index}].grossMarginPercentage`,
          message: 'Gross margin percentage calculation mismatch',
          value: margin.grossMarginPercentage,
          suggestion: `Expected: ${expectedGrossMarginPct.toFixed(2)}%`
        });
      }
    }
    
    // Business logic validations
    if (margin.grossMarginPercentage !== undefined && margin.grossMarginPercentage < 15) {
      warnings.push({
        field: `productMargins[${index}].grossMarginPercentage`,
        message: 'Low gross margin detected',
        value: `${(margin.grossMarginPercentage || 0).toFixed(2)}%`,
        suggestion: 'Consider reviewing pricing or cost structure'
      });
    }
    
    if (margin.amazonReferralFee / margin.retailPrice > 0.20) {
      warnings.push({
        field: `productMargins[${index}].amazonReferralFee`,
        message: 'High Amazon referral fee percentage',
        value: `${((margin.amazonReferralFee / margin.retailPrice) * 100).toFixed(2)}%`,
        suggestion: 'Verify Amazon fee structure for this category'
      });
    }
  });
  
  const dataCompleteness = calculateDataCompleteness(margins);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      criticalErrors: errors.filter(e => e.field.includes('sku') || e.field.includes('retailPrice')).length,
      dataCompleteness
    }
  };
}

/**
 * Validate assumptions data
 */
export function validateAssumptions(assumptions: Partial<Assumptions>): DataValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Validate growth rates
  const growthRates = [
    { field: 'annualGrowthRateY1', value: assumptions.annualGrowthRateY1 },
    { field: 'annualGrowthRateY2', value: assumptions.annualGrowthRateY2 },
    { field: 'annualGrowthRateY3', value: assumptions.annualGrowthRateY3 },
    { field: 'annualGrowthRateY4', value: assumptions.annualGrowthRateY4 },
    { field: 'annualGrowthRateY5', value: assumptions.annualGrowthRateY5 }
  ];
  
  growthRates.forEach(({ field, value }) => {
    if (value !== undefined && value < -0.5) {
      errors.push({
        field,
        message: 'Growth rate cannot be less than -50%',
        value: `${(value * 100).toFixed(2)}%`
      });
    }
    
    if (value !== undefined && value > 2.0) {
      warnings.push({
        field,
        message: 'Very high growth rate detected',
        value: `${(value * 100).toFixed(2)}%`,
        suggestion: 'Verify this aggressive growth assumption'
      });
    }
  });
  
  // Validate channel mix
  const channelMixes = [
    { field: 'ecommerceChannelMixY1', value: assumptions.ecommerceChannelMixY1 },
    { field: 'ecommerceChannelMixY2', value: assumptions.ecommerceChannelMixY2 },
    { field: 'ecommerceChannelMixY3', value: assumptions.ecommerceChannelMixY3 },
    { field: 'ecommerceChannelMixY4', value: assumptions.ecommerceChannelMixY4 },
    { field: 'ecommerceChannelMixY5', value: assumptions.ecommerceChannelMixY5 }
  ];
  
  channelMixes.forEach(({ field, value }) => {
    if (value !== undefined && (value < 0 || value > 1)) {
      errors.push({
        field,
        message: 'Channel mix must be between 0 and 1',
        value
      });
    }
  });
  
  // Validate phase velocities
  if (assumptions.launchPhaseVelocity !== undefined && 
      assumptions.growthPhaseVelocity !== undefined && 
      assumptions.maturityPhaseVelocity !== undefined) {
    
    if (assumptions.launchPhaseVelocity >= assumptions.growthPhaseVelocity) {
      warnings.push({
        field: 'launchPhaseVelocity',
        message: 'Launch phase velocity should be less than growth phase',
        value: assumptions.launchPhaseVelocity
      });
    }
    
    if (assumptions.growthPhaseVelocity >= assumptions.maturityPhaseVelocity) {
      warnings.push({
        field: 'growthPhaseVelocity',
        message: 'Growth phase velocity should be less than maturity phase',
        value: assumptions.growthPhaseVelocity
      });
    }
  }
  
  // Validate product sales mix
  if (assumptions.productSalesMix) {
    const totalPercentage = assumptions.productSalesMix.reduce((sum: number, pm: any) => sum + pm.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      errors.push({
        field: 'productSalesMix',
        message: 'Product sales mix percentages must sum to 100%',
        value: `${totalPercentage.toFixed(2)}%`
      });
    }
  }
  
  // Validate financial rates
  if (assumptions.corporateTaxRate !== undefined && (assumptions.corporateTaxRate < 0 || assumptions.corporateTaxRate > 0.5)) {
    warnings.push({
      field: 'corporateTaxRate',
      message: 'Unusual corporate tax rate',
      value: `${(assumptions.corporateTaxRate * 100).toFixed(2)}%`,
      suggestion: 'Verify tax rate for your jurisdiction'
    });
  }
  
  const dataCompleteness = calculateAssumptionsCompleteness(assumptions);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      criticalErrors: errors.filter(e => 
        e.field.includes('productSalesMix') || 
        e.field.includes('channelMix')
      ).length,
      dataCompleteness
    }
  };
}

/**
 * Validate yearly data consistency
 */
export function validateYearlyData(yearlyData: any[]): DataValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!yearlyData || yearlyData.length === 0) {
    errors.push({
      field: 'yearlyData',
      message: 'No yearly data provided'
    });
    
    return {
      isValid: false,
      errors,
      warnings,
      summary: {
        totalErrors: 1,
        totalWarnings: 0,
        criticalErrors: 1,
        dataCompleteness: 0
      }
    };
  }
  
  yearlyData.forEach((year, index) => {
    // Check revenue consistency
    if (year.totalRevenue !== undefined && year.totalRevenue <= 0) {
      errors.push({
        field: `year${index + 1}.totalRevenue`,
        message: 'Total revenue must be positive',
        value: year.totalRevenue
      });
    }
    
    // Check margin calculations
    if (year.totalRevenue > 0 && year.grossProfit !== undefined && year.totalCogs !== undefined) {
      const expectedGrossProfit = year.totalRevenue - year.totalCogs;
      const diff = Math.abs(year.grossProfit - expectedGrossProfit);
      if (diff > 1) { // Allow $1 tolerance
        warnings.push({
          field: `year${index + 1}.grossProfit`,
          message: 'Gross profit calculation mismatch',
          value: year.grossProfit,
          suggestion: `Expected: ${expectedGrossProfit.toFixed(2)}`
        });
      }
    }
    
    // Check year-over-year growth
    if (index > 0 && yearlyData[index - 1].totalRevenue > 0) {
      const growth = (year.totalRevenue - yearlyData[index - 1].totalRevenue) / yearlyData[index - 1].totalRevenue;
      if (growth < -0.5) {
        warnings.push({
          field: `year${index + 1}.revenue`,
          message: 'Revenue decline exceeds 50%',
          value: `${(growth * 100).toFixed(2)}%`,
          suggestion: 'Review business assumptions for this period'
        });
      }
    }
    
    // Validate expense ratios
    if (year.totalRevenue > 0 && year.totalOpex !== undefined) {
      const opexRatio = year.totalOpex / year.totalRevenue;
      if (opexRatio > 0.8) {
        warnings.push({
          field: `year${index + 1}.totalOpex`,
          message: 'Operating expenses exceed 80% of revenue',
          value: `${(opexRatio * 100).toFixed(2)}%`,
          suggestion: 'Review cost structure and efficiency'
        });
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      criticalErrors: errors.filter(e => e.field.includes('totalRevenue')).length,
      dataCompleteness: 100 // Assuming complete if data exists
    }
  };
}

/**
 * Comprehensive validation of all imported CSV data
 */
export function validateCSVData(data: CSVData): DataValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  
  // Validate each data component
  if (data.productMargins) {
    const marginValidation = validateProductMargins(data.productMargins);
    allErrors.push(...marginValidation.errors);
    allWarnings.push(...marginValidation.warnings);
  }
  
  if (data.yearlyFigures) {
    const yearlyValidation = validateYearlyData(data.yearlyFigures);
    allErrors.push(...yearlyValidation.errors);
    allWarnings.push(...yearlyValidation.warnings);
  }
  
  // Cross-validate data consistency
  if (data.yearlyFigures && data.year1Phased) {
    const year1Total = data.yearlyFigures[0]?.totalRevenue;
    const phasedTotal = (data.year1Phased as any)?.yearTotal?.Revenue;
    
    if (year1Total && phasedTotal) {
      const phasedTotalNumeric = parseFloat(phasedTotal.toString().replace(/[$,]/g, ''));
      const diff = Math.abs(year1Total - phasedTotalNumeric);
      
      if (diff > 100) { // Allow $100 tolerance
        allWarnings.push({
          field: 'year1Revenue',
          message: 'Year 1 total revenue mismatch between yearly figures and phased data',
          value: `Yearly: $${year1Total.toFixed(2)}, Phased: $${phasedTotalNumeric.toFixed(2)}`,
          suggestion: 'Reconcile the two data sources'
        });
      }
    }
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    summary: {
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      criticalErrors: allErrors.filter(e => 
        e.field.includes('Revenue') || 
        e.field.includes('sku') || 
        e.field.includes('productMargins')
      ).length,
      dataCompleteness: calculateOverallCompleteness(data)
    }
  };
}

/**
 * Calculate data completeness percentage for product margins
 */
function calculateDataCompleteness(margins: ProductMargin[]): number {
  if (!margins || margins.length === 0) return 0;
  
  const requiredFields = [
    'sku', 'retailPrice', 'totalCogs', 'grossProfit', 'grossMargin'
  ];
  
  let totalFields = 0;
  let filledFields = 0;
  
  margins.forEach(margin => {
    requiredFields.forEach(field => {
      totalFields++;
      if (margin[field as keyof ProductMargin] !== undefined && 
          margin[field as keyof ProductMargin] !== null) {
        filledFields++;
      }
    });
  });
  
  return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
}

/**
 * Calculate assumptions completeness
 */
function calculateAssumptionsCompleteness(assumptions: Partial<Assumptions>): number {
  const requiredFields = [
    'baseMonthlySalesUnits',
    'annualGrowthRateY1',
    'annualGrowthRateY2',
    'annualGrowthRateY3',
    'annualGrowthRateY4',
    'annualGrowthRateY5',
    'ecommerceChannelMixY1',
    'productSalesMix',
    'initialInvestment'
  ];
  
  let filledFields = 0;
  requiredFields.forEach(field => {
    if (assumptions[field as keyof Assumptions] !== undefined) {
      filledFields++;
    }
  });
  
  return Math.round((filledFields / requiredFields.length) * 100);
}

/**
 * Calculate overall data completeness
 */
function calculateOverallCompleteness(data: CSVData): number {
  // Scoring weights for completeness calculation - not business configuration
  const components = [
    { name: 'yearlyFigures', weight: 0.3, exists: !!data.yearlyFigures?.length }, // 30% weight
    { name: 'productMargins', weight: 0.3, exists: !!data.productMargins?.length }, // 30% weight
    { name: 'investmentBreakdown', weight: 0.2, exists: !!data.investmentBreakdown }, // 20% weight
    { name: 'year1Phased', weight: 0.2, exists: !!data.year1Phased } // 20% weight
  ];
  
  const completeness = components.reduce((sum, comp) => {
    return sum + (comp.exists ? comp.weight : 0);
  }, 0);
  
  return Math.round(completeness * 100);
}