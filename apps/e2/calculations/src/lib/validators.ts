// src/lib/validators.ts

import {
  Assumptions,
  ProductMargin,
  MonthlyData,
  YearlyData,
  FinancialStatements,
  ProductMix,
  SupplierPaymentTerm
} from '../types/financial';
import { BUSINESS_THRESHOLDS } from '@/config/business-rules';

// Validation interfaces
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  expectedRange?: { min?: number; max?: number };
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

// Constants for validation ranges
const VALIDATION_RANGES = {
  growthRate: { min: -0.5, max: 3.0 }, // -50% to 300%
  percentage: { min: 0, max: 1.0 }, // 0% to 100%
  margin: { min: 0, max: 0.9 }, // 0% to 90%
  monthsOfSupply: { min: 1, max: 12 },
  leadTime: { min: 1, max: 180 }, // days
  salary: { min: 0, max: 500000 }, // annual
  currentRatio: { min: 0.5, max: 10 },
  debtToEquity: { min: 0, max: 5 },
  roi: { min: -1, max: 10 }, // -100% to 1000%
};

// 1. Input Validation Functions

export function validateAssumptions(assumptions: Assumptions): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate date
  const startDate = new Date(assumptions.modelStartDate);
  if (isNaN(startDate.getTime())) {
    errors.push({
      field: 'modelStartDate',
      message: 'Invalid model start date',
      value: assumptions.modelStartDate
    });
  }

  // Validate growth rates
  const growthRates = [
    { field: 'annualGrowthRateY1', value: assumptions.annualGrowthRateY1 },
    { field: 'annualGrowthRateY2', value: assumptions.annualGrowthRateY2 },
    { field: 'annualGrowthRateY3', value: assumptions.annualGrowthRateY3 },
    { field: 'annualGrowthRateY4', value: assumptions.annualGrowthRateY4 },
    { field: 'annualGrowthRateY5', value: assumptions.annualGrowthRateY5 },
  ];

  growthRates.forEach(({ field, value }) => {
    if (value < VALIDATION_RANGES.growthRate.min || value > VALIDATION_RANGES.growthRate.max) {
      errors.push({
        field,
        message: `Growth rate out of reasonable range`,
        value,
        expectedRange: VALIDATION_RANGES.growthRate
      });
    }
    if (value > 1.5) {
      warnings.push({
        field,
        message: `Very high growth rate (${(value * 100).toFixed(0)}%) may be difficult to achieve`,
        value,
        suggestion: 'Consider more conservative growth projections'
      });
    }
  });

  // Validate channel mix
  const channelMixes = [
    { field: 'ecommerceChannelMixY1', value: assumptions.ecommerceChannelMixY1 },
    { field: 'ecommerceChannelMixY2', value: assumptions.ecommerceChannelMixY2 },
    { field: 'ecommerceChannelMixY3', value: assumptions.ecommerceChannelMixY3 },
    { field: 'ecommerceChannelMixY4', value: assumptions.ecommerceChannelMixY4 },
    { field: 'ecommerceChannelMixY5', value: assumptions.ecommerceChannelMixY5 },
  ];

  // Check channel mix values are valid percentages
  channelMixes.forEach(({ field, value }) => {
    if (value < 0 || value > 1) {
      errors.push({
        field,
        message: 'Channel mix must be between 0% and 100%',
        value,
        expectedRange: VALIDATION_RANGES.percentage
      });
    }
  });

  // Check e-commerce percentage decreases over time (retail expansion)
  for (let i = 1; i < channelMixes.length; i++) {
    if (channelMixes[i].value > channelMixes[i - 1].value) {
      warnings.push({
        field: channelMixes[i].field,
        message: 'E-commerce percentage should decrease as retail expands',
        value: channelMixes[i].value,
        suggestion: 'Ensure retail channel growth is reflected in decreasing e-commerce percentage'
      });
    }
  }

  // Validate product sales mix
  const totalProductMix = assumptions.productSalesMix.reduce((sum: number, product: any) => sum + product.percentage, 0);
  if (Math.abs(totalProductMix - 1.0) > 0.001) {
    errors.push({
      field: 'productSalesMix',
      message: `Product mix percentages must sum to 100% (currently ${(totalProductMix * 100).toFixed(1)}%)`,
      value: totalProductMix
    });
  }

  // Validate phased launch velocities
  const velocities = [
    { field: 'launchPhaseVelocity', value: assumptions.launchPhaseVelocity },
    { field: 'growthPhaseVelocity', value: assumptions.growthPhaseVelocity },
    { field: 'maturityPhaseVelocity', value: assumptions.maturityPhaseVelocity },
  ];

  if (assumptions.launchPhaseVelocity >= assumptions.growthPhaseVelocity ||
      assumptions.growthPhaseVelocity >= assumptions.maturityPhaseVelocity) {
    errors.push({
      field: 'phaseVelocities',
      message: 'Launch velocity < Growth velocity < Maturity velocity',
      value: velocities.map(v => v.value)
    });
  }

  // Validate fees and rates
  const feeFields = [
    { field: 'amazonReferralFeeRate', value: assumptions.amazonReferralFeeRate },
    { field: 'fulfillmentFeeRate', value: assumptions.fulfillmentFeeRate },
    { field: 'refundReturnRate', value: assumptions.refundReturnRate },
    { field: 'ppcAdvertisingRate', value: assumptions.ppcAdvertisingRate },
    { field: 'payrollTaxRate', value: assumptions.payrollTaxRate },
    { field: 'corporateTaxRate', value: assumptions.corporateTaxRate },
    { field: 'tariffRate', value: assumptions.tariffRate },
  ];

  feeFields.forEach(({ field, value }) => {
    if (value < 0 || value > 1) {
      errors.push({
        field,
        message: 'Rate must be between 0% and 100%',
        value,
        expectedRange: VALIDATION_RANGES.percentage
      });
    }
  });

  // Validate inventory parameters
  if (assumptions.targetMonthsOfSupply < VALIDATION_RANGES.monthsOfSupply.min ||
      assumptions.targetMonthsOfSupply > VALIDATION_RANGES.monthsOfSupply.max) {
    errors.push({
      field: 'targetMonthsOfSupply',
      message: 'Months of supply out of reasonable range',
      value: assumptions.targetMonthsOfSupply,
      expectedRange: VALIDATION_RANGES.monthsOfSupply
    });
  }

  if (assumptions.leadTimeDays < VALIDATION_RANGES.leadTime.min ||
      assumptions.leadTimeDays > VALIDATION_RANGES.leadTime.max) {
    errors.push({
      field: 'leadTimeDays',
      message: 'Lead time out of reasonable range',
      value: assumptions.leadTimeDays,
      expectedRange: VALIDATION_RANGES.leadTime
    });
  }

  // Validate supplier payment terms
  const totalPaymentTerms = assumptions.supplierPaymentTerms.reduce((sum: number, term: any) => sum + term.percentage, 0);
  if (Math.abs(totalPaymentTerms - 1.0) > 0.001) {
    errors.push({
      field: 'supplierPaymentTerms',
      message: `Payment terms percentages must sum to 100% (currently ${(totalPaymentTerms * 100).toFixed(1)}%)`,
      value: totalPaymentTerms
    });
  }

  // Validate salaries
  const salaryFields = [
    { field: 'ownerSalary', value: assumptions.ownerSalary },
    { field: 'managerSalaryFT', value: assumptions.managerSalaryFT },
    { field: 'associateSalaryPT', value: assumptions.associateSalaryPT },
  ];

  salaryFields.forEach(({ field, value }) => {
    if (value < 0 || value > VALIDATION_RANGES.salary.max) {
      errors.push({
        field,
        message: 'Salary out of reasonable range',
        value,
        expectedRange: VALIDATION_RANGES.salary
      });
    }
  });

  // Validate investment allocation
  const investmentTotal = assumptions.investmentUseCash + assumptions.investmentUseInventory +
                         assumptions.investmentUseSetup + assumptions.investmentUseMarketing;
  
  if (Math.abs(investmentTotal - (assumptions.initialInvestment || 0)) > 1) {
    errors.push({
      field: 'investmentAllocation',
      message: `Investment allocations must sum to initial investment ($${assumptions.initialInvestment || 0})`,
      value: investmentTotal
    });
  }

  // Add suggestions
  if (assumptions.ppcAdvertisingRate > 0.15) {
    suggestions.push('Consider reducing PPC advertising rate over time as brand recognition grows');
  }

  if (assumptions.targetMonthsOfSupply > 6) {
    suggestions.push('High inventory levels tie up working capital - consider reducing months of supply');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

export function validateProductMargins(margins: ProductMargin[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  margins.forEach((margin, index) => {
    const prefix = `Product ${margin.sku}`;

    // Check required fields
    if (!margin.sku || !margin.name) {
      errors.push({
        field: `margins[${index}]`,
        message: `${prefix}: Missing required fields (SKU or description)`,
        value: margin
      });
    }

    // Validate prices are positive
    const priceFields = ['retailPrice', 'fobCost', 'landedCost', 'totalCogs'];
    priceFields.forEach(field => {
      if (margin[field as keyof ProductMargin] as number < 0) {
        errors.push({
          field: `margins[${index}].${field}`,
          message: `${prefix}: ${field} cannot be negative`,
          value: margin[field as keyof ProductMargin]
        });
      }
    });

    // Validate landed cost calculation
    const calculatedLandedCost = (margin.fobCost || 0) + (margin.manufacturing * margin.tariffRate) + margin.freight;
    if (margin.landedCost && Math.abs(calculatedLandedCost - margin.landedCost) > 0.01) {
      errors.push({
        field: `margins[${index}].landedCost`,
        message: `${prefix}: Landed cost calculation error`,
        value: margin.landedCost,
        expectedRange: { min: calculatedLandedCost, max: calculatedLandedCost }
      });
    }

    // Validate total COGS calculation
    const calculatedCogs = (margin.landedCost || 0) + margin.amazonReferralFee + margin.fulfillmentFee;
    if (margin.totalCogs && Math.abs(calculatedCogs - margin.totalCogs) > 0.01) {
      errors.push({
        field: `margins[${index}].totalCogs`,
        message: `${prefix}: Total COGS calculation error`,
        value: margin.totalCogs,
        expectedRange: { min: calculatedCogs, max: calculatedCogs }
      });
    }

    // Validate margins
    if (margin.grossMargin !== undefined && margin.grossMargin < 0) {
      errors.push({
        field: `margins[${index}].grossMargin`,
        message: `${prefix}: Negative gross margin`,
        value: margin.grossMargin
      });
    } else if (margin.grossMargin !== undefined && margin.grossMargin < BUSINESS_THRESHOLDS.defaultMarginThreshold) {
      warnings.push({
        field: `margins[${index}].grossMargin`,
        message: `${prefix}: Low gross margin (${(margin.grossMargin * 100).toFixed(1)}%)`,
        value: margin.grossMargin,
        suggestion: 'Consider pricing adjustments or cost reduction strategies'
      });
    }

    // ROI validation removed as ProductMargin doesn't have roi property

    // Wholesale price validation removed as ProductMargin doesn't have wholesalePrice property
  });

  // General suggestions
  const avgMargin = margins.reduce((sum, m) => sum + (m.grossMargin || 0), 0) / margins.length;
  if (avgMargin < 0.35) {
    suggestions.push('Overall margins are below 35% - explore opportunities for premium pricing or cost reduction');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// 2. Business Rule Validations

export function validateChannelMix(monthlyData: MonthlyData[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Group by year
  const yearlyChannelMix = new Map<number, number[]>();
  
  monthlyData.forEach(month => {
    if (!yearlyChannelMix.has(month.yearInModel)) {
      yearlyChannelMix.set(month.yearInModel, []);
    }
    const ecomPercent = month.totalRevenue > 0 ? month.ecommerceRevenue / month.totalRevenue : 0;
    const yearlyPercentages = yearlyChannelMix.get(month.yearInModel);
    if (yearlyPercentages) {
      yearlyPercentages.push(ecomPercent);
    }
  });

  // Check year-over-year trend
  const avgByYear: number[] = [];
  yearlyChannelMix.forEach((percentages, year) => {
    const avg = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
    avgByYear[year - 1] = avg;
  });

  // E-commerce percentage should generally decrease as retail expands
  for (let i = 1; i < avgByYear.length; i++) {
    if (avgByYear[i] > avgByYear[i - 1] + 0.05) { // Allow 5% variance
      warnings.push({
        field: `channelMix.year${i + 1}`,
        message: `E-commerce percentage increased in Year ${i + 1}`,
        value: avgByYear[i],
        suggestion: 'Verify retail expansion strategy is being implemented'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

export function validateEmploymentPlan(
  monthlyData: MonthlyData[],
  assumptions: Assumptions
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Group by year
  const yearlyMetrics = new Map<number, { revenue: number; payroll: number; months: number }>();
  
  monthlyData.forEach(month => {
    if (!yearlyMetrics.has(month.yearInModel)) {
      yearlyMetrics.set(month.yearInModel, { revenue: 0, payroll: 0, months: 0 });
    }
    const metrics = yearlyMetrics.get(month.yearInModel)!;
    metrics.revenue += month.totalRevenue;
    metrics.payroll += month.payroll;
    metrics.months += 1;
  });

  // Check payroll as percentage of revenue
  yearlyMetrics.forEach((metrics, year) => {
    const payrollPercent = metrics.revenue > 0 ? metrics.payroll / metrics.revenue : 0;
    
    if (payrollPercent > 0.35) {
      warnings.push({
        field: `employment.year${year}`,
        message: `High payroll percentage (${(payrollPercent * 100).toFixed(1)}% of revenue)`,
        value: payrollPercent,
        suggestion: 'Consider productivity improvements or revenue growth strategies'
      });
    }

    // Check if payroll is growing faster than revenue
    if (year > 1) {
      const prevMetrics = yearlyMetrics.get(year - 1)!;
      const revenueGrowth = (metrics.revenue - prevMetrics.revenue) / prevMetrics.revenue;
      const payrollGrowth = (metrics.payroll - prevMetrics.payroll) / prevMetrics.payroll;
      
      if (payrollGrowth > revenueGrowth * 1.2) { // Allow 20% higher growth
        warnings.push({
          field: `employment.year${year}.growth`,
          message: `Payroll growing faster than revenue`,
          value: { payrollGrowth, revenueGrowth },
          suggestion: 'Ensure headcount additions are justified by revenue growth'
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

export function validateCashFlow(monthlyData: MonthlyData[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  let previousCash = 0;
  let consecutiveNegativeCashFlow = 0;
  let minCash = Infinity;
  let minCashMonth = 0;

  monthlyData.forEach((month, index) => {
    // Check cash continuity
    if (index > 0) {
      const expectedCash = previousCash + month.netCashFlow;
      if (Math.abs(expectedCash - month.cash) > 1) {
        errors.push({
          field: `cashFlow.month${month.monthInModel}`,
          message: 'Cash flow continuity error',
          value: month.cash,
          expectedRange: { min: expectedCash - 1, max: expectedCash + 1 }
        });
      }
    }

    // Track minimum cash
    if (month.cash < minCash) {
      minCash = month.cash;
      minCashMonth = month.monthInModel;
    }

    // Check for negative cash
    if (month.cash < 0) {
      errors.push({
        field: `cash.month${month.monthInModel}`,
        message: 'Negative cash balance requires financing',
        value: month.cash
      });
    } else if (month.cash < 10000) {
      warnings.push({
        field: `cash.month${month.monthInModel}`,
        message: 'Low cash balance',
        value: month.cash,
        suggestion: 'Consider maintaining minimum cash reserve of $10,000'
      });
    }

    // Track consecutive negative cash flow
    if (month.netCashFlow < 0) {
      consecutiveNegativeCashFlow++;
      if (consecutiveNegativeCashFlow >= 3) {
        warnings.push({
          field: `cashFlow.month${month.monthInModel}`,
          message: `${consecutiveNegativeCashFlow} consecutive months of negative cash flow`,
          value: month.netCashFlow,
          suggestion: 'Review operating expenses and working capital management'
        });
      }
    } else {
      consecutiveNegativeCashFlow = 0;
    }

    previousCash = month.cash;
  });

  // Overall cash suggestions
  if (minCash < 20000) {
    suggestions.push(`Minimum cash balance of $${minCash.toFixed(0)} in month ${minCashMonth} - consider credit line`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

export function validateInventoryLevels(monthlyData: MonthlyData[], assumptions: Assumptions): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  monthlyData.forEach((month, index) => {
    if (month.totalCogs > 0) {
      const monthsOfSupply = month.inventory / (month.totalCogs / 30); // Daily COGS
      
      if (monthsOfSupply > assumptions.targetMonthsOfSupply * 1.5) {
        warnings.push({
          field: `inventory.month${month.monthInModel}`,
          message: `High inventory (${monthsOfSupply.toFixed(1)} months of supply)`,
          value: month.inventory,
          suggestion: 'Review purchasing patterns and sales forecasts'
        });
      } else if (monthsOfSupply < assumptions.targetMonthsOfSupply * 0.5) {
        warnings.push({
          field: `inventory.month${month.monthInModel}`,
          message: `Low inventory (${monthsOfSupply.toFixed(1)} months of supply)`,
          value: month.inventory,
          suggestion: 'Risk of stockouts - review reorder points'
        });
      }
    }

    // Check inventory turnover
    if (index >= 11) { // After first year
      const annualCogs = monthlyData.slice(index - 11, index + 1)
        .reduce((sum, m) => sum + m.totalCogs, 0);
      const avgInventory = monthlyData.slice(index - 11, index + 1)
        .reduce((sum, m) => sum + m.inventory, 0) / 12;
      
      const turnover = avgInventory > 0 ? annualCogs / avgInventory : 0;
      
      if (turnover < 4) {
        warnings.push({
          field: `inventoryTurnover.month${month.monthInModel}`,
          message: `Low inventory turnover (${turnover.toFixed(1)}x annually)`,
          value: turnover,
          suggestion: 'Target 4-6x annual turnover for healthy cash flow'
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// 3. Output Validation

export function validateMonthlyData(data: MonthlyData[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  data.forEach((month, index) => {
    // Balance sheet must balance
    const assetsMinusLiabilitiesEquity = Math.abs(month.totalAssets - (month.totalLiabilities + month.totalEquity));
    if (assetsMinusLiabilitiesEquity > 1) {
      errors.push({
        field: `balanceSheet.month${month.monthInModel}`,
        message: 'Balance sheet does not balance',
        value: {
          assets: month.totalAssets,
          liabilitiesAndEquity: month.totalLiabilities + month.totalEquity,
          difference: assetsMinusLiabilitiesEquity
        }
      });
    }

    // Check gross margin
    if (month.totalRevenue > 0) {
      const calculatedGrossMargin = (month.totalRevenue - month.totalCogs) / month.totalRevenue;
      if (Math.abs(calculatedGrossMargin - month.grossMargin) > 0.001) {
        errors.push({
          field: `grossMargin.month${month.monthInModel}`,
          message: 'Gross margin calculation error',
          value: month.grossMargin,
          expectedRange: { min: calculatedGrossMargin - 0.001, max: calculatedGrossMargin + 0.001 }
        });
      }

      // Check margin reasonableness
      if (month.grossMargin < BUSINESS_THRESHOLDS.defaultMarginThreshold) {
        warnings.push({
          field: `grossMargin.month${month.monthInModel}`,
          message: `Low gross margin (${(month.grossMargin * 100).toFixed(1)}%)`,
          value: month.grossMargin
        });
      }
    }

    // Validate cash flow continuity
    if (index > 0) {
      const prevMonth = data[index - 1];
      const expectedCash = prevMonth.cash + month.netCashFlow;
      if (Math.abs(expectedCash - month.cash) > 1) {
        errors.push({
          field: `cashContinuity.month${month.monthInModel}`,
          message: 'Cash flow continuity error',
          value: month.cash,
          expectedRange: { min: expectedCash - 1, max: expectedCash + 1 }
        });
      }
    }

    // Check current ratio
    if (month.totalCurrentLiabilities > 0) {
      const currentRatio = month.totalCurrentAssets / month.totalCurrentLiabilities;
      if (currentRatio < VALIDATION_RANGES.currentRatio.min) {
        warnings.push({
          field: `currentRatio.month${month.monthInModel}`,
          message: `Low current ratio (${currentRatio.toFixed(2)})`,
          value: currentRatio,
          suggestion: 'May indicate liquidity issues'
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

export function validateYearlyData(data: YearlyData[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  data.forEach((year, index) => {
    // Check year-over-year growth
    if (index > 0 && data[index - 1].totalRevenue > 0) {
      const calculatedGrowth = (year.totalRevenue - data[index - 1].totalRevenue) / data[index - 1].totalRevenue;
      if (Math.abs(calculatedGrowth - year.revenueGrowth) > 0.01) {
        errors.push({
          field: `revenueGrowth.year${year.year}`,
          message: 'Revenue growth calculation error',
          value: year.revenueGrowth,
          expectedRange: { min: calculatedGrowth - 0.01, max: calculatedGrowth + 0.01 }
        });
      }
    }

    // Validate financial ratios
    if (year.currentRatio < VALIDATION_RANGES.currentRatio.min || 
        year.currentRatio > VALIDATION_RANGES.currentRatio.max) {
      warnings.push({
        field: `currentRatio.year${year.year}`,
        message: 'Current ratio out of normal range',
        value: year.currentRatio,
        suggestion: 'Review working capital management'
      });
    }

    if (year.debtToEquity > VALIDATION_RANGES.debtToEquity.max) {
      warnings.push({
        field: `debtToEquity.year${year.year}`,
        message: 'High debt-to-equity ratio',
        value: year.debtToEquity,
        suggestion: 'Consider equity financing or debt reduction'
      });
    }

    // Check profitability progression
    if (year.year >= 3 && year.netMargin < 0) {
      warnings.push({
        field: `profitability.year${year.year}`,
        message: 'Still unprofitable by year 3',
        value: year.netMargin,
        suggestion: 'Review path to profitability'
      });
    }

    // Balance sheet check
    const balanceCheck = Math.abs(year.totalAssets - (year.totalLiabilities + year.totalEquity));
    if (balanceCheck > 1) {
      errors.push({
        field: `balanceSheet.year${year.year}`,
        message: 'Annual balance sheet does not balance',
        value: balanceCheck
      });
    }
  });

  // Overall progression checks
  if (data.length >= 5) {
    const year5 = data[4];
    if (year5.netMargin < 0.1) {
      suggestions.push('Net margin below 10% by year 5 - explore margin improvement opportunities');
    }
    if (year5.returnOnEquity < 0.15) {
      suggestions.push('ROE below 15% by year 5 - consider strategies to improve capital efficiency');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// 4. Cross-validation

export function validateFinancialStatements(statements: FinancialStatements): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate monthly to yearly rollup
  const yearlyRollup = new Map<number, {
    revenue: number;
    cogs: number;
    opex: number;
    netIncome: number;
    endingCash: number;
  }>();

  statements.monthlyData.forEach((month: any) => {
    if (!yearlyRollup.has(month.yearInModel)) {
      yearlyRollup.set(month.yearInModel, {
        revenue: 0,
        cogs: 0,
        opex: 0,
        netIncome: 0,
        endingCash: month.cash
      });
    }
    const yearly = yearlyRollup.get(month.yearInModel)!;
    yearly.revenue += month.totalRevenue;
    yearly.cogs += month.totalCogs;
    yearly.opex += month.totalOpex;
    yearly.netIncome += month.netIncome;
    yearly.endingCash = month.cash; // Last month's cash
  });

  // Compare with yearly data
  statements.yearlyData.forEach((year: any) => {
    const rollup = yearlyRollup.get(year.year);
    if (rollup) {
      // Check revenue
      if (Math.abs(rollup.revenue - year.totalRevenue) > 1) {
        errors.push({
          field: `crossValidation.revenue.year${year.year}`,
          message: 'Monthly revenue does not sum to yearly',
          value: { monthly: rollup.revenue, yearly: year.totalRevenue }
        });
      }

      // Check COGS
      if (Math.abs(rollup.cogs - year.totalCogs) > 1) {
        errors.push({
          field: `crossValidation.cogs.year${year.year}`,
          message: 'Monthly COGS does not sum to yearly',
          value: { monthly: rollup.cogs, yearly: year.totalCogs }
        });
      }

      // Check net income
      if (Math.abs(rollup.netIncome - year.netIncome) > 1) {
        errors.push({
          field: `crossValidation.netIncome.year${year.year}`,
          message: 'Monthly net income does not sum to yearly',
          value: { monthly: rollup.netIncome, yearly: year.netIncome }
        });
      }

      // Check ending cash
      if (Math.abs(rollup.endingCash - year.endingCash) > 1) {
        errors.push({
          field: `crossValidation.cash.year${year.year}`,
          message: 'Year-end cash does not match',
          value: { monthly: rollup.endingCash, yearly: year.endingCash }
        });
      }
    }
  });

  // Validate that product margins are used consistently
  const avgMargin = statements.productMargins.reduce((sum: number, p: any) => sum + (p.grossMargin || 0), 0) / 
                    statements.productMargins.length;
  
  statements.monthlyData.forEach((month: any) => {
    if (month.totalRevenue > 0) {
      const monthMargin = month.grossMargin;
      if (Math.abs(monthMargin - avgMargin) > 0.1) {
        warnings.push({
          field: `marginConsistency.month${month.monthInModel}`,
          message: 'Monthly margin deviates significantly from product margins',
          value: { monthly: monthMargin, expected: avgMargin }
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// Master validation function
export function validateAll(
  assumptions: Assumptions,
  statements: FinancialStatements
): ValidationResult {
  const results: ValidationResult[] = [
    validateAssumptions(assumptions),
    validateProductMargins(statements.productMargins),
    validateChannelMix(statements.monthlyData),
    validateEmploymentPlan(statements.monthlyData, assumptions),
    validateCashFlow(statements.monthlyData),
    validateInventoryLevels(statements.monthlyData, assumptions),
    validateMonthlyData(statements.monthlyData),
    validateYearlyData(statements.yearlyData),
    validateFinancialStatements(statements)
  ];

  // Combine all results
  const combined: ValidationResult = {
    isValid: results.every(r => r.isValid),
    errors: results.flatMap(r => r.errors),
    warnings: results.flatMap(r => r.warnings),
    suggestions: Array.from(new Set(results.flatMap(r => r.suggestions))) // Remove duplicates
  };

  // Add summary suggestions
  if (combined.errors.length > 0) {
    combined.suggestions.unshift(`Fix ${combined.errors.length} validation errors before proceeding`);
  }
  
  if (combined.warnings.length > 10) {
    combined.suggestions.push('Consider addressing high-priority warnings to improve financial projections');
  }

  return combined;
}

// Utility function to format validation results
export function formatValidationResults(results: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push(`Validation ${results.isValid ? 'PASSED' : 'FAILED'}`);
  lines.push('');
  
  if (results.errors.length > 0) {
    lines.push(`ERRORS (${results.errors.length}):`);
    results.errors.forEach(error => {
      lines.push(`  - ${error.field}: ${error.message}`);
      if (error.value !== undefined) {
        lines.push(`    Current: ${JSON.stringify(error.value)}`);
      }
      if (error.expectedRange) {
        lines.push(`    Expected: ${JSON.stringify(error.expectedRange)}`);
      }
    });
    lines.push('');
  }
  
  if (results.warnings.length > 0) {
    lines.push(`WARNINGS (${results.warnings.length}):`);
    results.warnings.forEach(warning => {
      lines.push(`  - ${warning.field}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    Suggestion: ${warning.suggestion}`);
      }
    });
    lines.push('');
  }
  
  if (results.suggestions.length > 0) {
    lines.push('SUGGESTIONS:');
    results.suggestions.forEach(suggestion => {
      lines.push(`  - ${suggestion}`);
    });
  }
  
  return lines.join('\n');
}