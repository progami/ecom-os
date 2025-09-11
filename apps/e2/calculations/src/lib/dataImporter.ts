// src/lib/dataImporter.ts
import {
  Assumptions,
  ProductMargin,
  ProductMix,
  EmployeePosition,
  CSVData
} from '@/types/financial';
import {
  loadCSVServerSide,
  parseNumericValue,
  validateCSVStructure
} from './csvLoader';
import { getBusinessRules } from '@/lib/config/dynamic-business-rules';
import logger from '@/utils/logger';

/**
 * Import product margins from CSV
 */
export async function importProductMargins(): Promise<ProductMargin[]> {
  const records = await loadCSVServerSide('E2 Calculations - Product Margins.csv');
  
  if (!records || records.length === 0) {
    throw new Error('No product margin data found');
  }
  
  // The CSV has a transposed structure, so we need to pivot it
  const productMargins: ProductMargin[] = [];
  
  // Extract SKUs from the first row (skip first column which is the metric name)
  const firstRow = records[0];
  const skus = Object.keys(firstRow).filter(key => key !== 'Product Margins (Per Unit)');
  
  // Create a map of metrics by row
  const metricsMap: Record<string, any> = {};
  records.forEach(row => {
    const metricName = row['Product Margins (Per Unit)'];
    if (metricName) {
      metricsMap[metricName] = row;
    }
  });
  
  // Build product margin objects for each SKU
  skus.forEach(sku => {
    const margin: ProductMargin = {
      sku: sku,
      name: sku, // Use SKU as name for now
      retailPrice: parseNumericValue(metricsMap['Retail Price (USD)']?.[sku] || 0),
      manufacturing: parseNumericValue(metricsMap['Total Landed Cost (See Invoice)']?.[sku] || 0),
      freight: parseNumericValue(metricsMap['3PL/AWD Receiving & Storage (Your Input)']?.[sku] || 0),
      thirdPLStorage: parseNumericValue(metricsMap['3PL/AWD Receiving & Storage (Your Input)']?.[sku] || 0),
      amazonReferralFee: parseNumericValue(metricsMap['Amazon Referral Fee (15%)']?.[sku] || 0),
      fulfillmentFee: parseNumericValue(metricsMap['FBA Fulfillment Fee (Depends on Size Tier)']?.[sku] || 0),
      refundAllowance: parseNumericValue(metricsMap['Return Allowance (3.5%)']?.[sku] || 0),
      group: 1,
      country: 'China',
      packSize: 1,
      micron: 0,
      dimensions: '',
      density: 0,
      weight: 0,
      weightOz: 0,
      weightLb: 0,
      cbmPerUnit: 0,
      sizeTier: '',
      tariffRate: 0,
      // Optional fields
      fobCost: parseNumericValue(metricsMap['Total Landed Cost (See Invoice)']?.[sku] || 0),
      landedCost: parseNumericValue(metricsMap['Total Landed Cost (See Invoice)']?.[sku] || 0),
      totalCogs: parseNumericValue(metricsMap['Total COGS (Cost of Goods Sold)']?.[sku] || 0),
      grossMargin: parseNumericValue(metricsMap['Gross Profit per Unit']?.[sku] || 0),
      grossMarginPercentage: parseNumericValue(metricsMap['Gross Margin (%)']?.[sku] || 0)
    };
    
    productMargins.push(margin);
  });
  
  return productMargins;
}

/**
 * Import yearly figures from CSV
 */
export async function importYearlyFigures(): Promise<any[]> {
  const records = await loadCSVServerSide('E2 Calculations - Yearly Figures.csv');
  
  // Transform the data structure
  const yearlyData = [];
  const years = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
  
  for (let i = 0; i < years.length; i++) {
    const yearColumn = `Column ${String.fromCharCode(66 + i)} (${years[i]})`;
    const yearData: any = {
      year: i + 1,
      yearLabel: years[i]
    };
    
    records.forEach(row => {
      const metric = row['Yearly Revenues'];
      const value = row[yearColumn];
      
      if (metric && value) {
        switch (metric) {
          case 'Total Revenue':
            yearData.totalRevenue = parseNumericValue(value);
            break;
          case 'Total COGS':
            yearData.totalCogs = parseNumericValue(value);
            break;
          case 'Gross Profit':
            yearData.grossProfit = parseNumericValue(value);
            break;
          case 'Gross Margin (%)':
            yearData.grossMargin = parseNumericValue(value);
            break;
          case 'Net Income (After Tax)':
            yearData.netIncome = parseNumericValue(value);
            break;
          case 'Net Profit Margin (%)':
            yearData.netMargin = parseNumericValue(value);
            break;
          case 'Annual Growth (%)':
            yearData.annualGrowth = parseNumericValue(value);
            break;
          // Operating expenses
          case 'PPC Marketing Costs':
            yearData.ppcMarketing = parseNumericValue(value);
            break;
          case 'U.S. Payroll':
            yearData.usPayroll = parseNumericValue(value);
            break;
          case 'Salaries (Owner)':
            yearData.ownerSalary = parseNumericValue(value);
            break;
          case 'Total Operating Expenses':
            yearData.totalOpex = parseNumericValue(value);
            break;
        }
      }
    });
    
    yearlyData.push(yearData);
  }
  
  return yearlyData;
}

/**
 * Import investment breakdown from CSV
 */
export async function importInvestmentBreakdown(): Promise<any> {
  const records = await loadCSVServerSide('E2 Calculations - Investment Breakdown.csv');
  
  const investmentData = {
    totalInvestment: 0,
    sources: [] as any[],
    uses: [] as any[],
    setupCosts: [] as any[],
    netIncomeByYear: [] as any[],
    cumulativeROI: [] as any[]
  };
  
  let currentSection = '';
  
  records.forEach(row => {
    const firstCol = row['Investment Details'];
    const amount = row['Amount'];
    const percentage = row['Percentage'];
    
    if (firstCol === 'SOURCE OF FUNDS') {
      currentSection = 'sources';
    } else if (firstCol === 'USE OF FUNDS') {
      currentSection = 'uses';
    } else if (firstCol === 'SETUP COSTS BREAKDOWN') {
      currentSection = 'setupCosts';
    } else if (firstCol === 'NET INCOME BY YEAR') {
      currentSection = 'netIncome';
    } else if (firstCol === 'CUMULATIVE ROI') {
      currentSection = 'cumulativeROI';
    } else if (firstCol && amount) {
      const parsedAmount = parseNumericValue(amount);
      
      if (firstCol === 'Total Investment') {
        investmentData.totalInvestment = parsedAmount;
      } else if (currentSection === 'sources' && firstCol !== 'Total') {
        investmentData.sources.push({
          name: firstCol,
          amount: parsedAmount,
          percentage: parseNumericValue(percentage)
        });
      } else if (currentSection === 'uses' && firstCol !== 'Total') {
        investmentData.uses.push({
          name: firstCol,
          amount: parsedAmount,
          percentage: parseNumericValue(percentage),
          notes: row['Notes'] || ''
        });
      } else if (currentSection === 'setupCosts') {
        investmentData.setupCosts.push({
          name: firstCol,
          amount: parsedAmount
        });
      } else if (currentSection === 'netIncome' && firstCol.startsWith('Year')) {
        investmentData.netIncomeByYear.push({
          year: parseInt(firstCol.replace('Year ', '')),
          amount: parsedAmount
        });
      } else if (currentSection === 'cumulativeROI' && firstCol.startsWith('Year')) {
        investmentData.cumulativeROI.push({
          year: parseInt(firstCol.replace('Year ', '')),
          roi: parseNumericValue(percentage)
        });
      }
    }
  });
  
  return investmentData;
}

/**
 * Import salary figures from CSV
 */
export async function importSalaryFigures(): Promise<any> {
  const records = await loadCSVServerSide('E2 Calculations - Salary Figures.csv');
  
  const salaryData = {
    headcount: [] as any[],
    salaryExpenses: [] as any[],
    employmentDetails: [] as any[]
  };
  
  // Extract headcount data
  const headcountRow = records.find(r => r['Employee Category'] === 'Total Headcount');
  if (headcountRow) {
    for (let year = 1; year <= 5; year++) {
      salaryData.headcount.push({
        year,
        count: parseInt(headcountRow[`Year ${year}`] || '0')
      });
    }
  }
  
  // Extract salary expenses
  const totalPayrollRow = records.find(r => r['Employee Category'] === 'Total Payroll');
  if (totalPayrollRow) {
    for (let year = 1; year <= 5; year++) {
      salaryData.salaryExpenses.push({
        year,
        totalPayroll: parseNumericValue(totalPayrollRow[`Year ${year}`] || 0)
      });
    }
  }
  
  // Extract employment details from the bottom section
  const detailsStartIndex = records.findIndex(r => r['Employee Category'] === 'EMPLOYMENT DETAILS');
  if (detailsStartIndex >= 0) {
    for (let i = detailsStartIndex + 1; i < records.length; i++) {
      const row = records[i];
      if (row['Employee Category']?.startsWith('Year')) {
        const year = parseInt(row['Employee Category'].replace('Year ', ''));
        const details = row['Year 1'] || ''; // Details are in the Year 1 column
        salaryData.employmentDetails.push({ year, details });
      }
    }
  }
  
  return salaryData;
}

/**
 * Import Year 1 phased data from CSV
 */
export async function importYear1Phased(): Promise<any> {
  const records = await loadCSVServerSide('E2 Calculations - Year1 Phased.csv');
  
  const phases = [];
  
  // Find the main phase data rows
  const launchPhase = records.find(r => r['Phase'] === 'Launch Phase');
  const growthPhase = records.find(r => r['Phase'] === 'Growth Phase');
  const maturityPhase = records.find(r => r['Phase'] === 'Maturity Phase');
  
  if (launchPhase) {
    phases.push({
      name: 'Launch',
      months: launchPhase['Months'],
      velocity: parseNumericValue(launchPhase['Velocity %']),
      duration: parseInt(launchPhase['Duration (Months)'] || '0'),
      unitsSold: parseNumericValue(launchPhase['Units Sold']),
      revenue: parseNumericValue(launchPhase['Revenue']),
      cogs: parseNumericValue(launchPhase['COGS']),
      grossProfit: parseNumericValue(launchPhase['Gross Profit']),
      operatingExpenses: parseNumericValue(launchPhase['Operating Expenses']),
      netOperatingIncome: parseNumericValue(launchPhase['Net Operating Income'])
    });
  }
  
  if (growthPhase) {
    phases.push({
      name: 'Growth',
      months: growthPhase['Months'],
      velocity: parseNumericValue(growthPhase['Velocity %']),
      duration: parseInt(growthPhase['Duration (Months)'] || '0'),
      unitsSold: parseNumericValue(growthPhase['Units Sold']),
      revenue: parseNumericValue(growthPhase['Revenue']),
      cogs: parseNumericValue(growthPhase['COGS']),
      grossProfit: parseNumericValue(growthPhase['Gross Profit']),
      operatingExpenses: parseNumericValue(growthPhase['Operating Expenses']),
      netOperatingIncome: parseNumericValue(growthPhase['Net Operating Income'])
    });
  }
  
  if (maturityPhase) {
    phases.push({
      name: 'Maturity',
      months: maturityPhase['Months'],
      velocity: parseNumericValue(maturityPhase['Velocity %']),
      duration: parseInt(maturityPhase['Duration (Months)'] || '0'),
      unitsSold: parseNumericValue(maturityPhase['Units Sold']),
      revenue: parseNumericValue(maturityPhase['Revenue']),
      cogs: parseNumericValue(maturityPhase['COGS']),
      grossProfit: parseNumericValue(maturityPhase['Gross Profit']),
      operatingExpenses: parseNumericValue(maturityPhase['Operating Expenses']),
      netOperatingIncome: parseNumericValue(maturityPhase['Net Operating Income'])
    });
  }
  
  return {
    phases,
    yearTotal: records.find(r => r['Phase'] === 'Year 1 Total')
  };
}

/**
 * Create default assumptions from imported CSV data
 */
export async function createDefaultAssumptions(): Promise<Partial<Assumptions>> {
  try {
    // Get business rules from database
    const businessRules = await getBusinessRules();
    
    // Import all necessary data
    const [productMargins, yearlyFigures, investmentData, salaryData, year1Phased] = await Promise.all([
      importProductMargins(),
      importYearlyFigures(),
      importInvestmentBreakdown(),
      importSalaryFigures(),
      importYear1Phased()
    ]);
    
    // Calculate product sales mix from Year 1 data
    const year1Data = yearlyFigures[0];
    const totalYear1Units = 141347; // From Year 1 phased data
    
    // Create product mix based on equal distribution (can be refined later)
    const productMix: ProductMix[] = productMargins.map(pm => {
      const monthlyUnits = Math.round(totalYear1Units / 12 / productMargins.length);
      return {
        skuCode: pm.sku,
        jan: monthlyUnits,
        feb: monthlyUnits,
        mar: monthlyUnits,
        apr: monthlyUnits,
        may: monthlyUnits,
        jun: monthlyUnits,
        jul: monthlyUnits,
        aug: monthlyUnits,
        sep: monthlyUnits,
        oct: monthlyUnits,
        nov: monthlyUnits,
        dec: monthlyUnits
      };
    });
    
    // Extract growth rates
    const growthRates = yearlyFigures.map(yf => yf.annualGrowth || 0);
    
    // Build assumptions object
    const assumptions: Partial<Assumptions> = {
      // General & Timing
      modelStartDate: new Date().toISOString().split('T')[0],
      
      // Sales & Revenue
      baseMonthlySalesUnits: Math.round(totalYear1Units / 12),
      annualGrowthRateY1: growthRates[0] || 0.30,
      annualGrowthRateY2: growthRates[1] || 0.20,
      annualGrowthRateY3: growthRates[2] || 0.15,
      annualGrowthRateY4: growthRates[3] || 0.10,
      annualGrowthRateY5: growthRates[4] || 0.10,
      
      // Channel Mix (100% e-commerce for now, can be adjusted)
      ecommerceChannelMixY1: 1.0,
      ecommerceChannelMixY2: 1.0,
      ecommerceChannelMixY3: 1.0,
      ecommerceChannelMixY4: 1.0,
      ecommerceChannelMixY5: 1.0,
      
      // Product Sales Mix
      productSalesMix: productMix,
      
      // Phased Launch (Year 1) - from Year1 Phased data
      launchPhaseVelocity: 0.30,
      growthPhaseVelocity: 0.60,
      maturityPhaseVelocity: 1.00,
      
      // Product & COGS
      amazonReferralFeeRate: businessRules.amazonReferralRate,
      fulfillmentFeeRate: 0.20, // Approximate based on data
      refundReturnRate: businessRules.amazonReturnAllowance,
      
      // Operating Expenses (from yearly data)
      ownerSalary: yearlyFigures[0].ownerSalary || 48000,
      managerSalaryFT: 40000, // Estimated from payroll data
      associateSalaryPT: 15000, // Estimated
      ppcAdvertisingRate: yearlyFigures[0].ppcMarketing / yearlyFigures[0].totalRevenue || 0.15,
      
      // Initial Investment (from investment breakdown)
      initialInvestment: investmentData.totalInvestment,
      investmentUseCash: 0, // Not specified in data
      investmentUseInventory: investmentData.uses.find((u: any) => u.name.includes('Inventory'))?.amount || 60000,
      investmentUseSetup: investmentData.uses.find((u: any) => u.name.includes('Setup'))?.amount || 15000,
      investmentUseMarketing: investmentData.uses.find((u: any) => u.name.includes('Marketing'))?.amount || 5000,
      
      // Tax rates
      payrollTaxRate: businessRules.payrollTaxRate,
      corporateTaxRate: 0.21,
      
      // Other defaults
      targetMonthsOfSupply: 3,
      leadTimeDays: 60,
      tariffRate: 0.10, // Estimate
      officeRentMonthly: 400, // From yearly data: $4,800 / 12
      utilitiesMonthly: 150, // From yearly data: $1,800 / 12
      liabilityInsuranceAnnual: 2400, // From yearly data
      accountingFeesMonthly: 500, // From yearly data: $6,000 / 12
      officeSuppliesMonthly: 125, // From yearly data: $1,500 / 12
    };
    
    return assumptions;
  } catch (error) {
    logger.error('Error creating default assumptions:', error);
    throw error;
  }
}

/**
 * Import all CSV data into a unified structure
 */
export async function importAllCSVData(): Promise<CSVData> {
  try {
    const [
      yearlyFigures,
      productMargins,
      investmentBreakdown,
      year1Phased,
      salaryData
    ] = await Promise.all([
      importYearlyFigures(),
      importProductMargins(),
      importInvestmentBreakdown(),
      importYear1Phased(),
      importSalaryFigures()
    ]);
    
    // Try to load additional CSV files if they exist
    let balanceSheet = [];
    let cashFlow = [];
    let financialRatios = [];
    let competitorAnalysis = [];
    
    try {
      balanceSheet = await loadCSVServerSide('E2 Calculations - Balance Sheet.csv');
    } catch (e) {
      logger.warn('Balance Sheet CSV not found');
    }
    
    try {
      cashFlow = await loadCSVServerSide('E2 Calculations - Cash Flow.csv');
    } catch (e) {
      logger.warn('Cash Flow CSV not found');
    }
    
    try {
      financialRatios = await loadCSVServerSide('E2 Calculations - Financial Ratios.csv');
    } catch (e) {
      logger.warn('Financial Ratios CSV not found');
    }
    
    try {
      competitorAnalysis = await loadCSVServerSide('E2 Calculations - Competitor Analysis.csv');
    } catch (e) {
      logger.warn('Competitor Analysis CSV not found');
    }
    
    return {
      yearlyFigures,
      balanceSheet,
      cashFlow,
      productMargins,
      investmentBreakdown,
      financialRatios,
      competitorAnalysis,
      year1Phased
    };
  } catch (error) {
    logger.error('Error importing CSV data:', error);
    throw error;
  }
}

/**
 * Validate imported data
 */
export function validateImportedData(data: CSVData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate yearly figures
  if (!data.yearlyFigures || data.yearlyFigures.length === 0) {
    errors.push('No yearly figures data found');
  } else if (data.yearlyFigures.length < 5) {
    warnings.push(`Only ${data.yearlyFigures.length} years of data found, expected 5`);
  }
  
  // Validate product margins
  if (!data.productMargins || data.productMargins.length === 0) {
    errors.push('No product margins data found');
  }
  
  // Validate investment breakdown
  if (!data.investmentBreakdown) {
    errors.push('No investment breakdown data found');
  }
  
  // Check for data consistency
  if (data.yearlyFigures && data.yearlyFigures.length > 0) {
    const year1Revenue = data.yearlyFigures[0].totalRevenue;
    if (year1Revenue <= 0) {
      errors.push('Year 1 revenue is zero or negative');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}