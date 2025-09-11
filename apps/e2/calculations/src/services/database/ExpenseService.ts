import { prisma } from '@/utils/database';
import ProductService from '@/services/database/ProductService';
import { getBusinessRules } from '@/lib/config/dynamic-business-rules';
import logger from '@/utils/logger';

export interface ExpenseData {
  id?: string;
  strategyId?: string | null;
  date: Date;
  weekStarting: Date;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  type: 'manual' | 'automated' | 'recurring';
  vendor?: string;
  invoiceNumber?: string;
  isRecurring?: boolean;
  recurringFreq?: string;
  metadata?: any;
}

class ExpenseService {
  private static instance: ExpenseService;
  private subscribers: (() => void)[] = [];

  static getInstance(): ExpenseService {
    if (!ExpenseService.instance) {
      ExpenseService.instance = new ExpenseService();
    }
    return ExpenseService.instance;
  }

  // Get the Monday of the week for a given date
  private getWeekStarting(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // Create or update expenses (including Amazon fees)
  async upsertExpenses(expenses: ExpenseData[]): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        for (const expense of expenses) {
          const weekStarting = this.getWeekStarting(expense.date);
          
          // For automated expenses (like Amazon fees), use upsert to avoid duplicates
          if (expense.type === 'automated' && expense.vendor === 'Amazon') {
            await tx.expense.upsert({
              where: {
                date_category_subcategory_vendor_strategyId: {
                  date: expense.date,
                  category: expense.category,
                  subcategory: expense.subcategory || '',
                  vendor: expense.vendor || '',
                  strategyId: expense.strategyId || null
                }
              } as any,
              update: {
                amount: expense.amount,
                description: expense.description,
                metadata: expense.metadata,
                updatedAt: new Date()
              },
              create: {
                date: expense.date,
                weekStarting,
                category: expense.category,
                subcategory: expense.subcategory,
                description: expense.description,
                amount: expense.amount,
                type: expense.type,
                vendor: expense.vendor,
                invoiceNumber: expense.invoiceNumber,
                isRecurring: expense.isRecurring || false,
                recurringFreq: expense.recurringFreq,
                metadata: expense.metadata
              }
            });
          } else {
            // For manual expenses, just create
            await tx.expense.create({
              data: {
                date: expense.date,
                weekStarting,
                category: expense.category,
                subcategory: expense.subcategory,
                description: expense.description,
                amount: expense.amount,
                type: expense.type,
                vendor: expense.vendor,
                invoiceNumber: expense.invoiceNumber,
                isRecurring: expense.isRecurring || false,
                recurringFreq: expense.recurringFreq,
                metadata: expense.metadata
              }
            });
          }
        }
      });
      
      this.notifySubscribers();
    } catch (error) {
      logger.error('Error saving expenses to database:', error);
      throw error;
    }
  }

  // Get expenses by date range
  async getExpensesByDateRange(startDate: Date, endDate: Date): Promise<ExpenseData[]> {
    try {
      const expenses = await prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      });
      
      return expenses.map(e => ({
        id: e.id,
        date: e.date,
        weekStarting: e.weekStarting,
        category: e.category,
        subcategory: e.subcategory || undefined,
        description: e.description,
        amount: e.amount.toNumber(),
        type: e.type as 'manual' | 'automated' | 'recurring',
        vendor: e.vendor || undefined,
        invoiceNumber: e.invoiceNumber || undefined,
        isRecurring: e.isRecurring,
        recurringFreq: e.recurringFreq || undefined,
        metadata: e.metadata
      }));
    } catch (error) {
      logger.error('Error loading expenses from database:', error);
      return [];
    }
  }

  // Get expenses by week
  async getExpensesByWeek(weekStarting: Date): Promise<ExpenseData[]> {
    try {
      const expenses = await prisma.expense.findMany({
        where: { weekStarting },
        orderBy: { date: 'asc' }
      });
      
      return expenses.map(e => ({
        id: e.id,
        date: e.date,
        weekStarting: e.weekStarting,
        category: e.category,
        subcategory: e.subcategory || undefined,
        description: e.description,
        amount: e.amount.toNumber(),
        type: e.type as 'manual' | 'automated' | 'recurring',
        vendor: e.vendor || undefined,
        invoiceNumber: e.invoiceNumber || undefined,
        isRecurring: e.isRecurring,
        recurringFreq: e.recurringFreq || undefined,
        metadata: e.metadata
      }));
    } catch (error) {
      logger.error('Error loading expenses by week:', error);
      return [];
    }
  }

  // Calculate and store Amazon fees based on revenue
  async calculateAndStoreAmazonFees(weekData: {
    weekStarting: Date;
    year: number;
    skuData: Array<{
      sku: string;
      units: number;
      grossRevenue: number;
    }>;
  }): Promise<void> {
    const expenses: ExpenseData[] = [];
    const date = weekData.weekStarting;
    
    // Get business rules from database
    const businessRules = await getBusinessRules();
    
    // Get products with their TACoS and FBA fees
    const productService = ProductService.getInstance();
    const products = productService.getAllProducts();
    const fulfillmentFeesPerUnit: Record<string, number> = {};
    const productTacos: Record<string, number> = {};
    
    Object.entries(products).forEach(([sku, product]) => {
      fulfillmentFeesPerUnit[sku] = product.fulfillmentFee;
      productTacos[sku] = product.tacos || 0.12; // Default to 12% if not set
    });
    
    let totalRevenue = 0;
    let totalReferralFee = 0;
    let totalFbaFee = 0;
    let totalAdSpend = 0;
    const skuAdSpendBreakdown: Array<{
      sku: string;
      revenue: number;
      adSpend: number;
      tacos: number;
    }> = [];
    
    // Calculate fees for each SKU
    weekData.skuData.forEach(({ sku, units, grossRevenue }) => {
      totalRevenue += grossRevenue;
      
      // Amazon referral fee from config
      const referralFee = grossRevenue * businessRules.amazonReferralRate;
      totalReferralFee += referralFee;
      
      // FBA fee per unit
      const fulfillmentFee = units * (fulfillmentFeesPerUnit[sku] || 0);
      totalFbaFee += fulfillmentFee;
      
      // Calculate advertising spend using SKU-specific TACoS
      const skuTacos = productTacos[sku] || 0.12;
      const skuAdSpend = grossRevenue * skuTacos;
      totalAdSpend += skuAdSpend;
      
      skuAdSpendBreakdown.push({
        sku,
        revenue: grossRevenue,
        adSpend: skuAdSpend,
        tacos: skuTacos
      });
    });
    
    // Add referral fee expense
    if (totalReferralFee > 0) {
      expenses.push({
        date,
        weekStarting: weekData.weekStarting,
        category: 'Amazon Expenses',
        subcategory: 'Referral Fee',
        description: `Amazon Referral Fee (${businessRules.amazonReferralRate * 100}% of sales)`,
        amount: totalReferralFee,
        type: 'automated',
        vendor: 'Amazon',
        metadata: {
          percentage: businessRules.amazonReferralRate,
          baseAmount: totalRevenue,
          skuBreakdown: weekData.skuData
        }
      });
    }
    
    // Add FBA fee expense
    if (totalFbaFee > 0) {
      expenses.push({
        date,
        weekStarting: weekData.weekStarting,
        category: 'Amazon Expenses',
        subcategory: 'FBA Fees',
        description: 'Amazon FBA Fulfillment Fees',
        amount: totalFbaFee,
        type: 'automated',
        vendor: 'Amazon',
        metadata: {
          skuBreakdown: weekData.skuData.map(({ sku, units }) => ({
            sku,
            units,
            feePerUnit: fulfillmentFeesPerUnit[sku] || 0,
            totalFee: units * (fulfillmentFeesPerUnit[sku] || 0)
          }))
        }
      });
    }
    
    // Add TACoS/PPC expense using SKU-wise TACoS rates
    if (totalAdSpend > 0) {
      // Calculate weighted average TACoS for display
      const weightedTacos = totalRevenue > 0 ? (totalAdSpend / totalRevenue) : 0;
      
      expenses.push({
        date,
        weekStarting: weekData.weekStarting,
        category: 'Amazon Expenses',
        subcategory: 'Advertising',
        description: `Amazon PPC/Advertising (${(weightedTacos * 100).toFixed(2)}% weighted TACoS)`,
        amount: totalAdSpend,
        type: 'automated',
        vendor: 'Amazon',
        metadata: {
          weightedTacosPercentage: weightedTacos,
          baseAmount: totalRevenue,
          skuBreakdown: skuAdSpendBreakdown,
          note: 'Calculated using SKU-specific TACoS rates'
        }
      });
    }
    
    // Store all Amazon fees
    if (expenses.length > 0) {
      await this.upsertExpenses(expenses);
    }
  }

  // Subscribe to changes
  subscribe(callback: () => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }
}

export default ExpenseService;