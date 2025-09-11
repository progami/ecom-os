// src/lib/financeEngine.ts

import { 
  Assumptions, 
  FinancialStatements, 
  MonthlyData, 
  YearlyData, 
  ProductMargin,
  ProductMix,
  EmployeePosition
} from '../types/financial';
import ProductService from '@/services/database/ProductService';
import SystemConfigService from '@/services/database/SystemConfigService';

// Default assumptions based on E2 business plan (now from database)
export async function getDefaultAssumptions(): Promise<Assumptions> {
  const configService = SystemConfigService.getInstance();
  const businessRules = await configService.getBusinessRules();
  const defaultAssumptions = await configService.getDefaultAssumptions();
  return {
    // General & Timing
    modelStartDate: '2025-11-01',

    // Sales & Revenue
    baseMonthlySalesUnits: 11779,
    annualGrowthRateY1: 0.30,
    annualGrowthRateY2: 0.20,
    annualGrowthRateY3: 0.15,
    annualGrowthRateY4: 0.15,
    annualGrowthRateY5: 0.10,
    
    // Channel Mix (E-commerce percentage, remainder is retail)
    ecommerceChannelMixY1: 1.00,
    ecommerceChannelMixY2: 0.85,
    ecommerceChannelMixY3: 0.75,
    ecommerceChannelMixY4: 0.70,
    ecommerceChannelMixY5: 0.65,
    
    // Product Sales Mix
    productSalesMix: [
      { sku: 'TS-007', percentage: 0.40, monthlyUnits: 4712 },
      { sku: 'TS-009', percentage: 0.35, monthlyUnits: 4123 },
      { sku: 'TS-US-001', percentage: 0.15, monthlyUnits: 1767 },
      { sku: 'TS-010', percentage: 0.10, monthlyUnits: 1177 }
    ],
    
    // Phased Launch (Year 1)
    launchPhaseVelocity: 0.30,
    growthPhaseVelocity: 0.60,
    maturityPhaseVelocity: 1.00,

    // Product & COGS
    amazonReferralFeeRate: businessRules.amazonReferralRate,
    fulfillmentFeeRate: 0.10,
    refundReturnRate: businessRules.amazonReturnAllowance,

    // Inventory & Supply Chain
    targetMonthsOfSupply: 3,
    leadTimeDays: businessRules.leadTimeDays,
    tariffRate: businessRules.tariffRate,
    lclShipmentCost: 5000,
    supplierPaymentTerms: [
      { percentage: 0.30, daysAfterPO: 0 },
      { percentage: 0.70, daysAfterPO: 30 }
    ],

    // Operating Expenses
    ownerSalary: defaultAssumptions.ownerSalary / 12, // Convert annual to monthly
    managerSalaryFT: defaultAssumptions.managerSalaryFT / 12,
    associateSalaryPT: defaultAssumptions.associateSalaryPT / 12,
    ppcAdvertisingRate: 0.15, // % of revenue
    officeRentMonthly: defaultAssumptions.officeRentMonthly,
    utilitiesMonthly: defaultAssumptions.utilitiesMonthly,
    quickbooksMonthly: 200,
    googleWorkspaceMonthly: 72,
    claudeAiMonthly: 20,
    liabilityInsuranceAnnual: defaultAssumptions.insuranceAnnual,
    accountingFeesMonthly: defaultAssumptions.accountingFeesMonthly,
    officeSuppliesMonthly: defaultAssumptions.officeSuppliesMonthly,
    grsRegistration: 2000,
    
    // Capital & Taxes
    payrollTaxRate: businessRules.payrollTaxRate,
    corporateTaxRate: 0.21,
    trademarkCost: 1500,
    trademarkDate: '2025-12-01',
    
    // Initial Investment
    initialInvestment: defaultAssumptions.initialInvestment,
    investmentUseCash: 0,
    investmentUseInventory: defaultAssumptions.inventoryInvestment,
    investmentUseSetup: defaultAssumptions.setupInvestment,
    investmentUseMarketing: defaultAssumptions.marketingInvestment
  };
}

// Default product margins - converts from centralized config to old ProductMargin format
export function getDefaultProductMargins(): ProductMargin[] {
  const productService = ProductService.getInstance();
  const products = productService.getAllProducts();
  return Object.values(products).map(product => {
    const tariff = product.manufacturingCost * ((product.tariffRate || 0) / 100);
    const landedCost = product.manufacturingCost + product.freightCost + tariff;
    const totalCogs = landedCost + product.amazonReferralFee + product.fulfillmentFee;
    const grossProfit = product.price - totalCogs;
    const grossMargin = grossProfit / product.price;
    const roi = grossProfit / totalCogs;
    
    // Estimate wholesale price as 50% of retail
    const wholesalePrice = product.price * 0.5;
    const retailGrossProfit = product.price - landedCost;
    const retailGrossMargin = retailGrossProfit / product.price;
    
    return {
      sku: product.sku,
      name: product.name,
      retailPrice: product.price,
      manufacturing: product.manufacturingCost,
      freight: product.freightCost,
      thirdPLStorage: product.warehouseCost,
      amazonReferralFee: product.amazonReferralFee,
      fulfillmentFee: product.fulfillmentFee,
      refundAllowance: product.price * 0.035, // 3.5% refund allowance
      group: product.group || 1,
      country: product.country || 'China',
      packSize: product.packSize || 1,
      micron: product.micron || 0,
      dimensions: product.dimensions || '',
      density: product.density || 0,
      weight: product.weight || 0,
      weightOz: product.weightOz || 0,
      weightLb: product.weightLb || 0,
      cbmPerUnit: product.cbmPerUnit || 0,
      sizeTier: product.sizeTier || '',
      tariffRate: product.tariffRate || 0,
      fobCost: product.manufacturingCost,
      landedCost: landedCost,
      totalCogs: totalCogs,
      grossMargin: grossProfit,
      grossMarginPercentage: grossMargin * 100
    };
  });
}

// Calculate weighted average prices and margins
function calculateWeightedAverages(productMargins: ProductMargin[], productMix: any[]) {
  let avgEcomPrice = 0;
  let avgEcomCogs = 0;
  let avgRetailPrice = 0;
  let avgRetailCogs = 0;

  productMix.forEach(mix => {
    const margin = productMargins.find(m => m.sku === mix.sku);
    if (margin) {
      avgEcomPrice += margin.retailPrice * mix.percentage;
      avgEcomCogs += (margin.totalCogs || 0) * mix.percentage;
      avgRetailPrice += (margin.retailPrice * 0.5) * mix.percentage;
      avgRetailCogs += (margin.landedCost || 0) * mix.percentage;
    }
  });

  return {
    avgEcomPrice,
    avgEcomCogs,
    avgEcomMargin: (avgEcomPrice - avgEcomCogs) / avgEcomPrice,
    avgRetailPrice,
    avgRetailCogs,
    avgRetailMargin: (avgRetailPrice - avgRetailCogs) / avgRetailPrice
  };
}

// Get employment plan for a given year
function getEmploymentPlan(year: number): EmployeePosition[] {
  switch(year) {
    case 1:
      return [
        { title: 'Part-time Associate 1', type: 'PT', monthlySalary: 1100 },
        { title: 'Part-time Associate 2', type: 'PT', monthlySalary: 1100 }
      ];
    case 2:
      return [
        { title: 'Operations Manager', type: 'FT', monthlySalary: 4000 },
        { title: 'Part-time Associate', type: 'PT', monthlySalary: 1100 }
      ];
    case 3:
      return [
        { title: 'Operations Manager', type: 'FT', monthlySalary: 4000 },
        { title: 'Customer Service Rep', type: 'FT', monthlySalary: 3200 },
        { title: 'Part-time Associate', type: 'PT', monthlySalary: 1100 }
      ];
    case 4:
      return [
        { title: 'Operations Manager', type: 'FT', monthlySalary: 4500 },
        { title: 'Customer Service Manager', type: 'FT', monthlySalary: 3800 },
        { title: 'Marketing Coordinator', type: 'FT', monthlySalary: 3500 },
        { title: 'Sales Representative', type: 'FT', monthlySalary: 3000 }
      ];
    case 5:
    default:
      return [
        { title: 'Operations Manager', type: 'FT', monthlySalary: 5000 },
        { title: 'Customer Service Manager', type: 'FT', monthlySalary: 4200 },
        { title: 'Marketing Manager', type: 'FT', monthlySalary: 4500 },
        { title: 'Sales Manager', type: 'FT', monthlySalary: 4000 },
        { title: 'Product Development', type: 'FT', monthlySalary: 3800 }
      ];
  }
}

// Main calculation engine
export async function calculateFinancialModel(
  assumptions: Assumptions,
  productMargins: ProductMargin[]
): Promise<FinancialStatements> {
  const monthlyData: MonthlyData[] = [];
  const yearlyData: YearlyData[] = [];
  
  // Calculate weighted averages
  const { avgEcomPrice, avgEcomCogs, avgEcomMargin, avgRetailPrice, avgRetailCogs, avgRetailMargin } = 
    calculateWeightedAverages(productMargins, assumptions.productSalesMix);
  
  // Initialize balance sheet items
  let cash = 73258.54; // Starting cash before model
  let accountsReceivable = 0;
  let inventory = assumptions.investmentUseInventory || 0;
  let prepaidExpenses = 0;
  let ppe = 0;
  let accumulatedDepreciation = 0;
  let intangibles = assumptions.trademarkCost || 0;
  let accountsPayable = 0;
  let accruedExpenses = 0;
  let longTermDebt = 0;
  let commonStock = assumptions.initialInvestment || 0;
  let retainedEarnings = -6741.46; // Starting retained earnings
  
  const startDate = new Date(assumptions.modelStartDate);
  let cumulativeUnitsSold = 0;
  
  // Main 60-month loop
  for (let monthIndex = 0; monthIndex < 60; monthIndex++) {
    const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthIndex, 1);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const yearInModel = Math.floor(monthIndex / 12) + 1;
    const monthInYear = (monthIndex % 12) + 1;
    
    // Determine phase for Year 1
    let phase: 'Launch' | 'Growth' | 'Maturity' | undefined;
    let phaseMultiplier = 1;
    if (yearInModel === 1) {
      if (monthInYear <= 3) {
        phase = 'Launch';
        phaseMultiplier = assumptions.launchPhaseVelocity;
      } else if (monthInYear <= 6) {
        phase = 'Growth';
        phaseMultiplier = assumptions.growthPhaseVelocity;
      } else {
        phase = 'Maturity';
        phaseMultiplier = assumptions.maturityPhaseVelocity;
      }
    }
    
    // Calculate growth rate
    let growthRate = 1;
    switch(yearInModel) {
      case 1: growthRate = 1 + assumptions.annualGrowthRateY1; break;
      case 2: growthRate = 1 + assumptions.annualGrowthRateY2; break;
      case 3: growthRate = 1 + assumptions.annualGrowthRateY3; break;
      case 4: growthRate = 1 + assumptions.annualGrowthRateY4; break;
      case 5: growthRate = 1 + assumptions.annualGrowthRateY5; break;
    }
    
    // Apply compound growth
    const compoundGrowth = Math.pow(growthRate, yearInModel - 1);
    
    // Calculate units sold
    const baseUnits = assumptions.baseMonthlySalesUnits * compoundGrowth * phaseMultiplier;
    
    // Determine channel mix
    let ecommerceMix = 1;
    switch(yearInModel) {
      case 1: ecommerceMix = assumptions.ecommerceChannelMixY1; break;
      case 2: ecommerceMix = assumptions.ecommerceChannelMixY2; break;
      case 3: ecommerceMix = assumptions.ecommerceChannelMixY3; break;
      case 4: ecommerceMix = assumptions.ecommerceChannelMixY4; break;
      case 5: ecommerceMix = assumptions.ecommerceChannelMixY5; break;
    }
    
    const ecommerceUnits = baseUnits * ecommerceMix;
    const retailUnits = baseUnits * (1 - ecommerceMix);
    const totalUnitsSold = baseUnits;
    
    // Calculate revenue
    const ecommerceRevenue = ecommerceUnits * avgEcomPrice;
    const retailRevenue = retailUnits * avgRetailPrice;
    const totalRevenue = ecommerceRevenue + retailRevenue;
    
    // Calculate COGS
    const ecommerceCogs = ecommerceUnits * avgEcomCogs;
    const retailCogs = retailUnits * avgRetailCogs;
    const totalCogs = ecommerceCogs + retailCogs;
    
    const grossProfit = totalRevenue - totalCogs;
    const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    
    // Calculate operating expenses
    const employees = getEmploymentPlan(yearInModel);
    const payroll = employees.reduce((sum, emp) => sum + emp.monthlySalary, 0);
    const payrollTaxes = payroll * assumptions.payrollTaxRate;
    
    const ppcAdvertising = totalRevenue * assumptions.ppcAdvertisingRate;
    const softwareSubscriptions = (assumptions.quickbooksMonthly || 0) + (assumptions.googleWorkspaceMonthly || 0) + (assumptions.claudeAiMonthly || 0);
    const insurance = (assumptions.liabilityInsuranceAnnual || 0) / 12;
    
    // Scale office rent with growth
    const officeRent = yearInModel <= 2 ? (assumptions.officeRentMonthly || 0) : 
                      yearInModel <= 3 ? (assumptions.officeRentMonthly || 0) * 1.5 :
                      (assumptions.officeRentMonthly || 0) * 2;
    
    const totalOpex = ppcAdvertising + payroll + (assumptions.ownerSalary || 0) + payrollTaxes + 
                     officeRent + (assumptions.utilitiesMonthly || 0) + softwareSubscriptions + 
                     insurance + (assumptions.accountingFeesMonthly || 0) + (assumptions.officeSuppliesMonthly || 0);
    
    // Calculate profit
    const ebitda = grossProfit - totalOpex;
    const depreciation = ppe > 0 ? ppe / 60 : 0; // 5-year straight line
    const netIncomeBeforeTax = ebitda - depreciation;
    const taxes = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * assumptions.corporateTaxRate : 0;
    const netIncome = netIncomeBeforeTax - taxes;
    const netMargin = totalRevenue > 0 ? netIncome / totalRevenue : 0;
    
    // Update balance sheet
    retainedEarnings += netIncome;
    
    // Handle one-time expenses
    if (monthIndex === 0) {
      cash += assumptions.initialInvestment || 0;
      cash -= assumptions.investmentUseSetup || 0;
      cash -= assumptions.investmentUseMarketing || 0;
    }
    
    // Trademark in month 2
    if (monthIndex === 1) {
      cash -= assumptions.trademarkCost || 0;
    }
    
    // GRS registration in month 6
    if (monthIndex === 5) {
      cash -= assumptions.grsRegistration || 0;
    }
    
    // Simple cash flow (operating activities)
    const cashFromOperations = netIncome + depreciation;
    const cashFromInvesting = 0; // Simplified
    const cashFromFinancing = monthIndex === 0 ? (assumptions.initialInvestment || 0) : 0;
    const netCashFlow = cashFromOperations + cashFromInvesting + cashFromFinancing;
    
    cash += netCashFlow;
    
    // Update other balance sheet items (simplified)
    accountsReceivable = retailRevenue * 0.5; // Assume 15 days collection for retail
    accountsPayable = totalCogs * 0.3; // Assume 30 days payable
    accruedExpenses = totalOpex * 0.1;
    
    const totalCurrentAssets = cash + accountsReceivable + inventory + prepaidExpenses;
    const totalAssets = totalCurrentAssets + ppe - accumulatedDepreciation + intangibles;
    const totalCurrentLiabilities = accountsPayable + accruedExpenses;
    const totalLiabilities = totalCurrentLiabilities + longTermDebt;
    const totalEquity = commonStock + retainedEarnings;
    
    // Store monthly data
    monthlyData.push({
      month: month.toString(),
      year,
      yearInModel,
      monthInModel: monthIndex + 1,
      date: currentDate.toISOString().split('T')[0],
      phase,
      totalUnitsSold,
      ecommerceUnits,
      retailUnits,
      ecommerceRevenue,
      retailRevenue,
      totalRevenue,
      ecommerceCogs,
      retailCogs,
      totalCogs,
      grossProfit,
      grossMargin,
      ppcAdvertising,
      payroll,
      ownerSalary: assumptions.ownerSalary,
      payrollTaxes,
      officeRent,
      utilities: assumptions.utilitiesMonthly,
      softwareSubscriptions,
      insurance,
      accountingFees: assumptions.accountingFeesMonthly,
      officeSupplies: assumptions.officeSuppliesMonthly,
      totalOpex,
      ebitda,
      depreciation,
      netIncomeBeforeTax,
      taxes,
      netIncome,
      netMargin,
      cash,
      accountsReceivable,
      inventory,
      prepaidExpenses,
      totalCurrentAssets,
      ppe,
      accumulatedDepreciation,
      intangibles,
      totalAssets,
      accountsPayable,
      accruedExpenses,
      totalCurrentLiabilities,
      longTermDebt,
      totalLiabilities,
      commonStock,
      retainedEarnings,
      totalEquity,
      cashFromOperations,
      cashFromInvesting,
      cashFromFinancing,
      netCashFlow
    });
    
    cumulativeUnitsSold += totalUnitsSold;
  }
  
  // Generate yearly summaries
  for (let y = 1; y <= 5; y++) {
    const yearMonths = monthlyData.filter(m => m.yearInModel === y);
    
    if (yearMonths.length > 0) {
      const yearData: YearlyData = {
        year: y,
        totalUnitsSold: yearMonths.reduce((sum, m) => sum + m.totalUnitsSold, 0),
        ecommerceRevenue: yearMonths.reduce((sum, m) => sum + m.ecommerceRevenue, 0),
        retailRevenue: yearMonths.reduce((sum, m) => sum + m.retailRevenue, 0),
        totalRevenue: yearMonths.reduce((sum, m) => sum + m.totalRevenue, 0),
        revenueGrowth: y === 1 ? 0 : 
          (yearMonths.reduce((sum, m) => sum + m.totalRevenue, 0) / 
           monthlyData.filter(m => m.yearInModel === y - 1).reduce((sum, m) => sum + m.totalRevenue, 0) - 1),
        totalCogs: yearMonths.reduce((sum, m) => sum + m.totalCogs, 0),
        grossProfit: yearMonths.reduce((sum, m) => sum + m.grossProfit, 0),
        grossMargin: yearMonths.reduce((sum, m) => sum + m.grossProfit, 0) / 
                    yearMonths.reduce((sum, m) => sum + m.totalRevenue, 0),
        totalOpex: yearMonths.reduce((sum, m) => sum + m.totalOpex, 0),
        netIncome: yearMonths.reduce((sum, m) => sum + m.netIncome, 0),
        netMargin: yearMonths.reduce((sum, m) => sum + m.netIncome, 0) / 
                  yearMonths.reduce((sum, m) => sum + m.totalRevenue, 0),
        totalAssets: yearMonths[yearMonths.length - 1].totalAssets,
        totalLiabilities: yearMonths[yearMonths.length - 1].totalLiabilities,
        totalEquity: yearMonths[yearMonths.length - 1].totalEquity,
        operatingCashFlow: yearMonths.reduce((sum, m) => sum + m.cashFromOperations, 0),
        investingCashFlow: yearMonths.reduce((sum, m) => sum + m.cashFromInvesting, 0),
        financingCashFlow: yearMonths.reduce((sum, m) => sum + m.cashFromFinancing, 0),
        endingCash: yearMonths[yearMonths.length - 1].cash,
        currentRatio: yearMonths[yearMonths.length - 1].totalCurrentAssets / 
                     yearMonths[yearMonths.length - 1].totalCurrentLiabilities,
        quickRatio: (yearMonths[yearMonths.length - 1].cash + yearMonths[yearMonths.length - 1].accountsReceivable) / 
                   yearMonths[yearMonths.length - 1].totalCurrentLiabilities,
        debtToEquity: yearMonths[yearMonths.length - 1].totalLiabilities / 
                     yearMonths[yearMonths.length - 1].totalEquity,
        returnOnAssets: yearMonths.reduce((sum, m) => sum + m.netIncome, 0) / 
                       yearMonths[yearMonths.length - 1].totalAssets,
        returnOnEquity: yearMonths.reduce((sum, m) => sum + m.netIncome, 0) / 
                       yearMonths[yearMonths.length - 1].totalEquity,
        fullTimeEmployees: getEmploymentPlan(y).filter(e => e.type === 'FT').length,
        partTimeEmployees: getEmploymentPlan(y).filter(e => e.type === 'PT').length,
        totalPayroll: yearMonths.reduce((sum, m) => sum + m.payroll + m.ownerSalary, 0)
      };
      
      yearlyData.push(yearData);
    }
  }
  
  return {
    monthlyData,
    yearlyData,
    productMargins
  };
}