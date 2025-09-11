import { PrismaClient, UnitSales } from '@prisma/client';
import { startOfMonth, endOfMonth, isAfter, isBefore, addMonths, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { getBusinessRules } from '@/lib/config/dynamic-business-rules';
import { GL_ACCOUNT_CODES } from '@/config/account-codes';
import SystemConfigService from '@/services/database/SystemConfigService';
import { validateDateFormat } from '@/config/validator';
import CutoffDateService from './CutoffDateService';
import SharedFinancialDataService from './SharedFinancialDataService';
// BatchCost services removed - no longer using inventory tracking
// import BatchCostTrackingService from './BatchCostTrackingService';
// import BatchCostPeriodService from './BatchCostPeriodService';
import ProductService, { ProductConfig } from '@/services/database/ProductService';
import ForecastDefinitionService from './ForecastDefinitionService';

interface RevenueCalculationInput {
  date: Date;
  sku: string;
  units: number;
  forecastPrice: number;
  sourceType: 'forecast' | 'actual';
  batchId?: string;
}

interface CalculatedRevenue {
  date: Date;
  sku: string;
  units: number;
  grossRevenue: number;
  manufacturingCost: number;
  freightCost: number;
  tariffCost: number;
  warehouseCost: number;
  fulfillmentFee: number;
  amazonReferralFee: number;
  returnAllowance: number;
  totalCOGS: number;
  netRevenue: number;
  marginPercent: number;
  sourceType: string;
  batchId?: string;
}

class RevenueService {
  private static instance: RevenueService;
  private prisma: PrismaClient;
  private cutoffDateService: CutoffDateService;
  private sharedDataService: SharedFinancialDataService;
  // Batch cost services removed - no longer using inventory tracking
  // private batchCostTrackingService: BatchCostTrackingService;
  // private batchCostPeriodService: BatchCostPeriodService;
  private productService: ProductService;
  private forecastDefinitionService: ForecastDefinitionService;

  // Rates are now imported from config

  private constructor() {
    this.prisma = new PrismaClient();
    this.cutoffDateService = CutoffDateService.getInstance();
    this.sharedDataService = SharedFinancialDataService.getInstance();
    // Batch cost services removed - no longer using inventory tracking
    // this.batchCostTrackingService = BatchCostTrackingService.getInstance();
    // this.batchCostPeriodService = BatchCostPeriodService.getInstance();
    this.productService = ProductService.getInstance();
    this.forecastDefinitionService = ForecastDefinitionService.getInstance();
  }

  static async getInstance(): Promise<RevenueService> {
    if (!RevenueService.instance) {
      RevenueService.instance = new RevenueService();
      // Initialize product cache
      await RevenueService.instance.productService.initializeCache();
    }
    return RevenueService.instance;
  }

  /**
   * Get instance synchronously (throws if not initialized)
   */
  static getInstanceSync(): RevenueService {
    if (!RevenueService.instance) {
      throw new Error('RevenueService not initialized. Call getInstance() first.');
    }
    return RevenueService.instance;
  }

  /**
   * Calculate revenue for a single SKU/date combination
   */
  private async calculateRevenue(input: RevenueCalculationInput): Promise<CalculatedRevenue> {
    const { date, sku, units, forecastPrice, sourceType, batchId } = input;
    
    // Get business rules from database
    const businessRules = await getBusinessRules();
    
    // Validate price is positive
    if (forecastPrice <= 0) {
      throw new Error(`Invalid price for SKU ${sku}: ${forecastPrice}. Price must be positive.`);
    }
    
    // Validate units is positive
    if (units < 0) {
      throw new Error(`Invalid units for SKU ${sku}: ${units}. Units cannot be negative.`);
    }
    
    // Get product data
    const product = this.productService.getProduct(sku);
    if (!product) {
      throw new Error(`Product not found for SKU: ${sku}`);
    }

    // Calculate gross revenue
    const grossRevenue = units * forecastPrice;

    // Use standard product costs - batch cost tracking removed
    const unitLandedCost = product.manufacturingCost + product.freightCost + product.manufacturingCost * businessRules.tariffRate;
    const manufacturingCost = product.manufacturingCost * units;
    const freightCost = product.freightCost * units;
    const tariffCost = product.manufacturingCost * businessRules.tariffRate * units;
    
    // Other costs remain the same
    const warehouseCost = product.warehouseCost * units;
    const fulfillmentFee = product.fulfillmentFee * units;
    
    // Calculate fees based on forecast price
    const amazonReferralFee = forecastPrice * businessRules.amazonReferralRate * units;
    const returnAllowance = forecastPrice * businessRules.amazonReturnAllowance * units;

    // Total COGS using batch-based landed cost
    const totalCOGS = (unitLandedCost * units) + warehouseCost + fulfillmentFee + amazonReferralFee + returnAllowance;

    // Net revenue (profit)
    const netRevenue = grossRevenue - totalCOGS;
    const marginPercent = grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0;

    return {
      date,
      sku,
      units,
      grossRevenue,
      manufacturingCost,
      freightCost,
      tariffCost,
      warehouseCost,
      fulfillmentFee,
      amazonReferralFee,
      returnAllowance,
      totalCOGS,
      netRevenue,
      marginPercent,
      sourceType,
      batchId
    };
  }

  /**
   * Generate and store revenue forecasts based on forecast definitions
   */
  async generateRevenueForecasts(startDate?: Date, endDate?: Date): Promise<UnitSales[]> {
    // Get cutoff date if not provided
    if (!startDate) {
      const cutoffDate = await this.cutoffDateService.getActiveCutoffDate();
      // Revenue forecasts start from their defined months, not cutoff + 1
      startDate = new Date(cutoffDate);
    }

    if (!endDate) {
      // Default to 5 years from now
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 5);
    }

    const revenues: UnitSales[] = [];

    // Get revenue forecast definitions
    const forecastDefinitions = await this.forecastDefinitionService.getActiveDefinitions('revenue');
    
    // Process each forecast definition
    for (const definition of forecastDefinitions) {
      if (!definition.sku) continue; // Skip non-SKU forecasts
      
      const product = this.productService.getProduct(definition.sku);
      if (!product) continue;
      
      // Generate forecasts based on definition frequency
      let currentDate = new Date(Math.max(startDate.getTime(), definition.startDate.getTime()));
      const definitionEndDate = definition.endDate || endDate;
      const finalEndDate = new Date(Math.min(endDate.getTime(), definitionEndDate.getTime()));
      
      while (currentDate <= finalEndDate) {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        
        // Calculate units based on definition
        const units = Number(definition.baseAmount || 0);
        
        if (units > 0) {
          const calculation = await this.calculateRevenue({
            date: currentDate,
            sku: definition.sku,
            units: Math.round(units),
            forecastPrice: product.price,
            sourceType: 'forecast'
          });
          
          // Create UnitSales record
          // Note: This needs to be updated to include strategyId in the unique constraint
          const revenue = await this.prisma.unitSales.upsert({
            where: {
              weekStarting_sku_strategyId: {
                weekStarting: weekStart,
                sku: definition.sku || '',
                strategyId: null // Need to get strategyId from context
              }
            } as any,
            update: {
              revenue: calculation.netRevenue,
              units: calculation.units,
              metadata: {
                grossRevenue: calculation.grossRevenue,
                totalCOGS: calculation.totalCOGS,
                marginPercent: calculation.marginPercent,
                manufacturingCost: calculation.manufacturingCost,
                freightCost: calculation.freightCost,
                tariffCost: calculation.tariffCost,
                warehouseCost: calculation.warehouseCost,
                fulfillmentFee: calculation.fulfillmentFee,
                amazonReferralFee: calculation.amazonReferralFee,
                returnAllowance: calculation.returnAllowance
              },
              updatedAt: new Date()
            },
            create: {
              weekStarting: weekStart,
              weekEnding: weekEnd,
              sku: definition.sku || '',
              revenue: calculation.netRevenue,
              units: calculation.units,
              isActual: false,
              metadata: {
                grossRevenue: calculation.grossRevenue,
                totalCOGS: calculation.totalCOGS,
                marginPercent: calculation.marginPercent,
                manufacturingCost: calculation.manufacturingCost,
                freightCost: calculation.freightCost,
                tariffCost: calculation.tariffCost,
                warehouseCost: calculation.warehouseCost,
                fulfillmentFee: calculation.fulfillmentFee,
                amazonReferralFee: calculation.amazonReferralFee,
                returnAllowance: calculation.returnAllowance
              }
            }
          });
          
          revenues.push(revenue);
        }
        
        // Move to next period based on frequency
        if (definition.frequency === 'weekly') {
          currentDate = addDays(currentDate, 7);
        } else if (definition.frequency === 'monthly') {
          currentDate = addMonths(currentDate, 1);
        } else {
          // Default to monthly
          currentDate = addMonths(currentDate, 1);
        }
      }
    }

    return revenues;
  }

  /**
   * Store revenue calculations in database
   */
  private async storeCalculations(calculations: CalculatedRevenue[]): Promise<UnitSales[]> {
    const results: UnitSales[] = [];

    for (const calc of calculations) {
      const weekStart = startOfWeek(calc.date, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(calc.date, { weekStartsOn: 0 });
      
      const stored = await this.prisma.unitSales.upsert({
        where: {
          weekStarting_sku_strategyId: {
            weekStarting: weekStart,
            sku: calc.sku,
            strategyId: null // Need to get strategyId from context
          }
        } as any,
        update: {
          revenue: calc.netRevenue,
          units: calc.units,
          metadata: calc as any,
          updatedAt: new Date()
        },
        create: {
          weekStarting: weekStart,
          weekEnding: weekEnd,
          sku: calc.sku,
          revenue: calc.netRevenue,
          units: calc.units,
          isActual: calc.sourceType === 'actual',
          metadata: calc as any
        }
      });
      
      results.push(stored);
    }

    return results;
  }

  /**
   * Get revenue calculations for GL display
   */
  async getRevenueForGL(startDate: Date, endDate: Date): Promise<{
    date: Date;
    category: string;
    subcategory: string;
    description: string;
    amount: number;
    accountCode: string;
    type: string;
  }[]> {
    // Use hardcoded account codes
    const revenues = await this.prisma.unitSales.findMany({
      where: {
        weekStarting: {
          gte: startDate,
          lte: endDate
        }
        // Filter for Amazon Sales SKUs if needed - removed category filter
      },
      orderBy: {
        weekStarting: 'asc'
      }
    });

    // Transform to GL format
    return revenues.map(revenue => ({
      date: revenue.weekStarting,
      category: 'Amazon Sales',
      subcategory: revenue.sku,
      description: `${revenue.sku} Revenue - Week of ${revenue.weekStarting.toLocaleDateString('en-US')}`,
      amount: typeof revenue.revenue === 'object' && 'toNumber' in revenue.revenue ? revenue.revenue.toNumber() : Number(revenue.revenue),
      accountCode: GL_ACCOUNT_CODES.AMAZON_SALES.code, // Amazon Sales account
      type: 'revenue_projection'
    }));
  }

  /**
   * Get revenue calculations by date range
   */
  async getCalculations(startDate: Date, endDate: Date): Promise<UnitSales[]> {
    return await this.prisma.unitSales.findMany({
      where: {
        weekStarting: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [
        { weekStarting: 'asc' },
        { sku: 'asc' }
      ]
    });
  }

  /**
   * Clear all revenue calculations (useful for recalculation)
   */
  async clearCalculations(isActual?: boolean): Promise<void> {
    const where = isActual !== undefined ? { isActual } : {};
    await this.prisma.unitSales.deleteMany({ where });
  }

  /**
   * Get batch cost information for revenue calculations
   */
  async getBatchCostInfo(sku: string, date: Date): Promise<{
    weightedCost: number;
    activeBatches: number;
    costVariance: number; // Variance from standard cost
    source: 'period' | 'inventory' | 'standard';
  }> {
    const product = this.productService.getProduct(sku);
    if (!product) {
      return { weightedCost: 0, activeBatches: 0, costVariance: 0, source: 'standard' };
    }

    // Get business rules from database
    const businessRules = await getBusinessRules();
    const standardLandedCost = product.manufacturingCost + product.freightCost + 
                              (product.manufacturingCost * businessRules.tariffRate);

    // Batch cost tracking removed - always use standard cost
    return {
      weightedCost: standardLandedCost,
      activeBatches: 0,
      costVariance: 0,
      source: 'standard'
    };
  }

  /**
   * Get summary metrics for a date range
   */
  async getSummaryMetrics(startDate: Date, endDate: Date): Promise<{
    totalGrossRevenue: number;
    totalNetRevenue: number;
    totalCOGS: number;
    averageMargin: number;
    bySkuMetrics: Record<string, {
      grossRevenue: number;
      netRevenue: number;
      units: number;
      margin: number;
    }>;
  }> {
    const revenues = await this.getCalculations(startDate, endDate);
    
    let totalGrossRevenue = 0;
    let totalNetRevenue = 0;
    let totalCOGS = 0;

    // By SKU metrics
    const bySkuMetrics: Record<string, any> = {};
    
    revenues.forEach(revenue => {
      const metadata = revenue.metadata as any;
      const grossRevenue = metadata?.grossRevenue || 0;
      const cogs = metadata?.totalCOGS || 0;
      
      totalGrossRevenue += grossRevenue;
      totalNetRevenue += typeof revenue.revenue === 'object' && revenue.revenue.toNumber ? revenue.revenue.toNumber() : Number(revenue.revenue);
      totalCOGS += cogs;
      
      const sku = revenue.sku || 'Unknown';
      if (!bySkuMetrics[sku]) {
        bySkuMetrics[sku] = {
          grossRevenue: 0,
          netRevenue: 0,
          units: 0,
          margin: 0
        };
      }
      
      bySkuMetrics[sku].grossRevenue += grossRevenue;
      bySkuMetrics[sku].netRevenue += typeof revenue.revenue === 'object' && revenue.revenue.toNumber ? revenue.revenue.toNumber() : Number(revenue.revenue);
      bySkuMetrics[sku].units += revenue.units || 0;
    });

    // Calculate margins
    Object.keys(bySkuMetrics).forEach(sku => {
      const metrics = bySkuMetrics[sku];
      metrics.margin = metrics.grossRevenue > 0 ? 
        (metrics.netRevenue / metrics.grossRevenue) * 100 : 0;
    });

    const averageMargin = totalGrossRevenue > 0 ? (totalNetRevenue / totalGrossRevenue) * 100 : 0;

    return {
      totalGrossRevenue,
      totalNetRevenue,
      totalCOGS,
      averageMargin,
      bySkuMetrics
    };
  }
}

export default RevenueService;
export type { CalculatedRevenue, RevenueCalculationInput };