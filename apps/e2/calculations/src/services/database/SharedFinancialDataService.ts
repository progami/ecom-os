
import { GLEntry, UnitSales, Expense, Product, Prisma } from '@prisma/client';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { prisma } from '@/utils/database';

export interface WeeklyFinancialData {
  weekStarting: string;
  revenue: number;
  expenses: number;
  profit: number;
  glEntries: GLEntry[];
}

export interface ExpenseData {
  id?: string;
  date: string;
  weekStarting: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  type?: string;
  vendor?: string;
  invoiceNumber?: string;
  metadata?: any;
  glEntryIds?: string[];
}

export interface RevenueData {
  id?: string;
  weekStarting: string;
  weekEnding: string;
  category: string;
  subcategory?: string;
  amount: number;
  units?: number;
  orderCount?: number;
  metadata?: any;
  glEntryIds?: string[];
}

class SharedFinancialDataService {
  private static instance: SharedFinancialDataService;
  private subscribers: Set<() => void> = new Set();

  private constructor() {
    // Use shared prisma instance
  }

  static getInstance(): SharedFinancialDataService {
    if (!SharedFinancialDataService.instance) {
      SharedFinancialDataService.instance = new SharedFinancialDataService();
    }
    return SharedFinancialDataService.instance;
  }

  // Subscribe to data changes
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }

  // Revenue operations (using UnitSales table)
  async getRevenue(): Promise<RevenueData[]> {
    const unitSales = await prisma.unitSales.findMany({
      orderBy: { weekStarting: 'desc' },
      include: {
        glEntries: {
          include: {
            glEntry: true
          }
        }
      }
    });
    
    return unitSales.map(sale => ({
      id: sale.id,
      weekStarting: sale.weekStarting.toISOString(), // Return full ISO string
      weekEnding: sale.weekEnding.toISOString(), // Return full ISO string
      category: 'Amazon Sales', // Fixed category for all sales
      subcategory: sale.sku, // SKU goes in subcategory field
      amount: sale.revenue.toNumber(),
      units: sale.units,
      orderCount: undefined,
      metadata: sale.metadata,
      // Include GL entry IDs in metadata for reference
      glEntryIds: sale.glEntries?.map(rel => rel.glEntry.id) || []
    }));
  }

  async addRevenue(data: RevenueData): Promise<void> {
    const weekStart = new Date(data.weekStarting);
    const weekEnd = data.weekEnding ? new Date(data.weekEnding) : endOfWeek(weekStart);

    // Create GL entries first
    const glEntryIds = await this.createGLEntriesForRevenue(data, weekStart);

    // Use upsert to handle unique constraint on [weekStarting, sku, strategyId]
    await prisma.unitSales.upsert({
      where: {
        weekStarting_sku_strategyId: {
          weekStarting: weekStart,
          sku: data.category, // Using category as SKU for now
          strategyId: null
        }
      } as any,
      update: {
        weekEnding: weekEnd,
        revenue: data.amount,
        units: data.units || 0,
        metadata: data.metadata,
        isActual: true,
        // Add new GL entries to existing ones
        glEntries: {
          create: glEntryIds.map(glEntryId => ({
            glEntry: {
              connect: { id: glEntryId }
            }
          }))
        }
      },
      create: {
        weekStarting: weekStart,
        weekEnding: weekEnd,
        sku: data.category, // Using category as SKU for now
        revenue: data.amount,
        units: data.units || 0,
        metadata: data.metadata,
        isActual: true,
        glEntries: {
          create: glEntryIds.map(glEntryId => ({
            glEntry: {
              connect: { id: glEntryId }
            }
          }))
        }
      } as any
    });
    
    this.notifySubscribers();
  }

  async updateRevenue(id: string, data: Partial<RevenueData>): Promise<void> {
    const updateData: any = {};
    
    if (data.weekStarting) updateData.weekStarting = new Date(data.weekStarting);
    if (data.weekEnding) updateData.weekEnding = new Date(data.weekEnding);
    if (data.category) updateData.category = data.category;
    if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.units !== undefined) updateData.units = data.units;
    if (data.orderCount !== undefined) updateData.orderCount = data.orderCount;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    // Get the existing unit sales with its GL entries
    const existingUnitSales = await prisma.unitSales.findUnique({
      where: { id },
      include: {
        glEntries: {
          include: {
            glEntry: true
          }
        }
      }
    });

    if (existingUnitSales && data.amount !== undefined && data.amount !== Number(existingUnitSales.revenue)) {
      // Amount has changed, we need to update GL entries
      // First, get the GL entry IDs to delete
      const glEntryIdsToDelete = existingUnitSales.glEntries.map(rel => rel.glEntryId);
      
      // Delete the relation entries first
      await prisma.unitSalesGLEntry.deleteMany({
        where: { unitSalesId: id }
      });
      
      // Then delete the actual GL entries
      if (glEntryIdsToDelete.length > 0) {
        await prisma.gLEntry.deleteMany({
          where: {
            id: { in: glEntryIdsToDelete }
          }
        });
      }

      // Create new GL entries with updated amount
      const revenueData: RevenueData = {
        ...existingUnitSales,
        ...data,
        weekStarting: existingUnitSales.weekStarting.toISOString(),
        weekEnding: existingUnitSales.weekEnding.toISOString(),
        amount: data.amount,
        category: existingUnitSales.sku
      };
      
      const glEntryIds = await this.createGLEntriesForRevenue(revenueData, existingUnitSales.weekStarting);
      
      // Update unit sales with new GL entries
      await prisma.unitSales.update({
        where: { id },
        data: {
          ...updateData,
          glEntries: {
            create: glEntryIds.map(glEntryId => ({
              glEntry: {
                connect: { id: glEntryId }
              }
            }))
          }
        } as any
      });
    } else {
      // No amount change, just update the unit sales
      // Convert category to sku if needed
      if (data.category) updateData.sku = data.category;
      if (data.amount !== undefined) updateData.revenue = data.amount;
      if (data.units !== undefined) updateData.units = data.units;
      
      await prisma.unitSales.update({
        where: { id },
        data: updateData as any
      });
    }

    this.notifySubscribers();
  }

  async deleteRevenue(id: string): Promise<void> {
    // First get the unit sales with its GL entries
    const unitSales = await prisma.unitSales.findUnique({
      where: { id },
      include: {
        glEntries: {
          include: {
            glEntry: true
          }
        }
      }
    });

    if (unitSales) {
      // Get GL entry IDs to delete
      const glEntryIds = unitSales.glEntries.map(rel => rel.glEntryId);
      
      // Delete the unit sales (this will cascade delete UnitSalesGLEntry records)
      await prisma.unitSales.delete({
        where: { id }
      });
      
      // Delete the GL entries themselves
      if (glEntryIds.length > 0) {
        await prisma.gLEntry.deleteMany({
          where: {
            id: { in: glEntryIds }
          }
        });
      }
    }
    
    this.notifySubscribers();
  }

  // Expense operations
  async getExpenses(): Promise<ExpenseData[]> {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: 'desc' },
      include: {
        glEntries: {
          include: {
            glEntry: true
          }
        }
      }
    });

    return expenses.map(exp => ({
      id: exp.id,
      date: exp.date.toISOString(), // Return full ISO string
      weekStarting: exp.weekStarting.toISOString(), // Return full ISO string
      category: exp.category,
      subcategory: exp.subcategory || undefined,
      description: exp.description,
      amount: exp.amount.toNumber(),
      type: exp.type,
      vendor: exp.vendor || undefined,
      invoiceNumber: exp.invoiceNumber || undefined,
      metadata: exp.metadata,
      // Include GL entry IDs in metadata for reference
      glEntryIds: exp.glEntries?.map(rel => rel.glEntry.id) || []
    }));
  }

  async addExpense(data: ExpenseData): Promise<void> {
    const date = new Date(data.date);
    const weekStart = startOfWeek(date);

    // Create GL entries first
    const glEntryIds = await this.createGLEntriesForExpense(data, date);

    // Create expense with GL relation
    await prisma.expense.create({
      data: {
        date,
        weekStarting: weekStart,
        category: data.category,
        subcategory: data.subcategory,
        description: data.description,
        amount: data.amount,
        type: data.type || 'manual',
        vendor: data.vendor,
        invoiceNumber: data.invoiceNumber,
        metadata: data.metadata,
        glEntries: {
          create: glEntryIds.map(glEntryId => ({
            glEntry: {
              connect: { id: glEntryId }
            }
          }))
        }
      } as any
    });
    
    this.notifySubscribers();
  }

  async updateExpense(id: string, data: Partial<ExpenseData>): Promise<void> {
    const updateData: any = {};
    
    if (data.date) {
      updateData.date = new Date(data.date);
      updateData.weekStarting = startOfWeek(updateData.date);
    }
    if (data.category) updateData.category = data.category;
    if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;
    if (data.description) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.type) updateData.type = data.type;
    if (data.vendor !== undefined) updateData.vendor = data.vendor;
    if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    await prisma.expense.update({
      where: { id },
      data: updateData as any
    });

    this.notifySubscribers();
  }

  async deleteExpense(id: string): Promise<void> {
    await prisma.expense.delete({
      where: { id }
    });
    this.notifySubscribers();
  }

  // GL Entry operations
  async getGLEntries(startDate?: Date, endDate?: Date): Promise<GLEntry[]> {
    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return await prisma.gLEntry.findMany({
      where,
      orderBy: { date: 'desc' }
    });
  }

  async createGLEntry(data: Omit<GLEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<GLEntry> {
    const entry = await prisma.gLEntry.create({
      data: data as any
    });
    this.notifySubscribers();
    return entry;
  }

  // Helper methods for GL entry creation
  private async createGLEntriesForRevenue(revenue: RevenueData, date: Date): Promise<string[]> {
    const glEntryIds: string[] = [];
    
    const glData = {
      date,
      account: `Revenue - ${revenue.category}`,
      accountCategory: 'Revenue',
      description: `${revenue.category} ${revenue.subcategory ? `- ${revenue.subcategory}` : ''}`,
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(revenue.amount),
      source: 'automated',
      metadata: { revenueId: revenue.id, ...revenue.metadata },
      reference: null,
      periodId: null
    };

    const creditEntry = await this.createGLEntry(glData);
    glEntryIds.push(creditEntry.id);

    // Create corresponding debit entry (Cash/AR)
    const debitEntry = await this.createGLEntry({
      ...glData,
      account: 'Cash',
      accountCategory: 'Assets',
      debit: new Prisma.Decimal(revenue.amount),
      credit: new Prisma.Decimal(0)
    });
    glEntryIds.push(debitEntry.id);
    
    return glEntryIds;
  }

  private async createGLEntriesForExpense(expense: ExpenseData, date: Date): Promise<string[]> {
    const glEntryIds: string[] = [];
    
    const glData = {
      date,
      account: `${expense.category} ${expense.subcategory ? `- ${expense.subcategory}` : ''}`.trim(),
      accountCategory: expense.category,
      description: expense.description,
      debit: new Prisma.Decimal(expense.amount),
      credit: new Prisma.Decimal(0),
      source: expense.type || 'manual',
      metadata: { expenseId: expense.id, ...expense.metadata },
      reference: null,
      periodId: null
    };

    const debitEntry = await this.createGLEntry(glData);
    glEntryIds.push(debitEntry.id);

    // Create corresponding credit entry (Cash/AP)
    const creditEntry = await this.createGLEntry({
      ...glData,
      account: 'Cash',
      accountCategory: 'Assets',
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(expense.amount)
    });
    glEntryIds.push(creditEntry.id);
    
    return glEntryIds;
  }

  // Weekly financial data aggregation
  async getWeeklyFinancialData(weeks: number = 12): Promise<WeeklyFinancialData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));

    // Get all unit sales and expenses for the period
    const unitSales = await prisma.unitSales.findMany({
      where: {
        weekStarting: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const expenses = await prisma.expense.findMany({
      where: {
        weekStarting: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const glEntries = await prisma.gLEntry.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Group by week
    const weeklyData = new Map<string, WeeklyFinancialData>();

    // Process unit sales as revenue
    unitSales.forEach(sale => {
      const weekKey = format(sale.weekStarting, 'yyyy-MM-dd');
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekStarting: weekKey,
          revenue: 0,
          expenses: 0,
          profit: 0,
          glEntries: []
        });
      }
      const week = weeklyData.get(weekKey)!;
      week.revenue += Number(sale.revenue);
    });

    // Process expenses
    expenses.forEach(exp => {
      const weekKey = format(exp.weekStarting, 'yyyy-MM-dd');
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekStarting: weekKey,
          revenue: 0,
          expenses: 0,
          profit: 0,
          glEntries: []
        });
      }
      const week = weeklyData.get(weekKey)!;
      week.expenses += Number(exp.amount);
    });

    // Add GL entries to respective weeks
    glEntries.forEach(entry => {
      const weekStart = startOfWeek(entry.date);
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      if (weeklyData.has(weekKey)) {
        const weekData = weeklyData.get(weekKey);
        if (weekData) {
          weekData.glEntries.push(entry);
        }
      }
    });

    // Calculate profit for each week
    weeklyData.forEach(week => {
      week.profit = week.revenue - week.expenses;
    });

    return Array.from(weeklyData.values()).sort((a, b) => 
      new Date(b.weekStarting).getTime() - new Date(a.weekStarting).getTime()
    );
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    return await prisma.product.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const product = await prisma.product.create({
      data: data as any
    });
    this.notifySubscribers();
    return product;
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const product = await prisma.product.update({
      where: { id },
      data: data as any
    });
    this.notifySubscribers();
    return product;
  }

  // Inventory operations removed - no longer using InventoryBatch table

  // Amazon fees are now handled as regular expenses in the Expense table

  // Cleanup
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}

export default SharedFinancialDataService;