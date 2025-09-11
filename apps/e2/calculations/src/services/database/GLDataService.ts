
import { GLEntry } from '@prisma/client';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';
import { prisma } from '@/utils/database';

export interface GLAccountSummary {
  account: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface GLPeriodSummary {
  period: string;
  startDate: Date;
  endDate: Date;
  entries: GLEntry[];
  accountSummaries: GLAccountSummary[];
  totals: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
  };
}

class GLDataService {
  private static instance: GLDataService;

  private constructor() {
    // Use shared prisma instance
  }

  static getInstance(): GLDataService {
    if (!GLDataService.instance) {
      GLDataService.instance = new GLDataService();
    }
    return GLDataService.instance;
  }

  // Create a new GL entry
  async createEntry(entry: Omit<GLEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<GLEntry> {
    return await prisma.gLEntry.create({
      data: entry as any
    });
  }

  // Create multiple GL entries in a transaction
  async createEntries(entries: Omit<GLEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<GLEntry[]> {
    const createdEntries = await prisma.$transaction(
      entries.map(entry => prisma.gLEntry.create({ data: entry as any }))
    );
    return createdEntries;
  }

  // Get GL entries with filtering
  async getEntries(filters?: {
    startDate?: Date;
    endDate?: Date;
    account?: string;
    category?: string;
    source?: string;
  }): Promise<GLEntry[]> {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters?.account) where.account = filters.account;
    if (filters?.category) where.accountCategory = filters.category;
    if (filters?.source) where.source = filters.source;

    return await prisma.gLEntry.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  // Get entries for current week
  async getCurrentWeekEntries(): Promise<GLEntry[]> {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    return await this.getEntries({
      startDate: weekStart,
      endDate: weekEnd
    });
  }

  // Get account summaries
  async getAccountSummaries(startDate?: Date, endDate?: Date): Promise<GLAccountSummary[]> {
    const entries = await this.getEntries({ startDate, endDate });
    
    const summaryMap = new Map<string, GLAccountSummary>();

    entries.forEach(entry => {
      const key = `${entry.account}|${entry.accountCategory}`;
      
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          account: entry.account,
          category: entry.accountCategory,
          debit: 0,
          credit: 0,
          balance: 0
        });
      }

      const summary = summaryMap.get(key)!;
      summary.debit += Number(entry.debit);
      summary.credit += Number(entry.credit);
    });

    // Calculate balances based on account type
    summaryMap.forEach(summary => {
      const isDebitAccount = ['Assets', 'Expenses', 'Cost of Goods'].includes(summary.category);
      summary.balance = isDebitAccount 
        ? summary.debit - summary.credit 
        : summary.credit - summary.debit;
    });

    return Array.from(summaryMap.values()).sort((a, b) => {
      // Sort by category first, then by account name
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.account.localeCompare(b.account);
    });
  }

  // Get period summary (weekly, monthly, etc.)
  async getPeriodSummary(startDate: Date, endDate: Date, periodName: string): Promise<GLPeriodSummary> {
    const entries = await this.getEntries({ startDate, endDate });
    const accountSummaries = await this.getAccountSummaries(startDate, endDate);

    const totals = entries.reduce((acc, entry) => {
      acc.totalDebits += Number(entry.debit);
      acc.totalCredits += Number(entry.credit);
      return acc;
    }, { totalDebits: 0, totalCredits: 0, difference: 0 });

    totals.difference = Math.abs(totals.totalDebits - totals.totalCredits);

    return {
      period: periodName,
      startDate,
      endDate,
      entries,
      accountSummaries,
      totals
    };
  }

  // Get weekly summaries
  async getWeeklySummaries(weeks: number = 12): Promise<GLPeriodSummary[]> {
    const summaries: GLPeriodSummary[] = [];
    const now = new Date();

    for (let i = 0; i < weeks; i++) {
      const weekStart = startOfWeek(new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000)));
      const weekEnd = endOfWeek(weekStart);
      const periodName = format(weekStart, 'yyyy-MM-dd');

      const summary = await this.getPeriodSummary(weekStart, weekEnd, periodName);
      summaries.push(summary);
    }

    return summaries;
  }

  // Trial balance
  async getTrialBalance(date?: Date): Promise<{
    date: Date;
    accounts: GLAccountSummary[];
    totals: {
      totalDebits: number;
      totalCredits: number;
      difference: number;
    };
    isBalanced: boolean;
  }> {
    const effectiveDate = date || new Date();
    const summaries = await this.getAccountSummaries(undefined, effectiveDate);

    const totals = summaries.reduce((acc, summary) => {
      acc.totalDebits += summary.debit;
      acc.totalCredits += summary.credit;
      return acc;
    }, { totalDebits: 0, totalCredits: 0, difference: 0 });

    totals.difference = Math.abs(totals.totalDebits - totals.totalCredits);

    return {
      date: effectiveDate,
      accounts: summaries,
      totals,
      isBalanced: totals.difference < 0.01 // Allow for small rounding differences
    };
  }

  // Update an entry
  async updateEntry(id: string, data: Partial<GLEntry>): Promise<GLEntry> {
    return await prisma.gLEntry.update({
      where: { id },
      data: data as any
    });
  }

  // Delete an entry
  async deleteEntry(id: string): Promise<void> {
    await prisma.gLEntry.delete({
      where: { id }
    });
  }

  // Bulk operations for automation
  async createAutomatedEntries(source: string, entries: Omit<GLEntry, 'id' | 'createdAt' | 'updatedAt' | 'source'>[]): Promise<GLEntry[]> {
    const entriesWithSource = entries.map(entry => ({
      ...entry,
      source
    }));

    return await this.createEntries(entriesWithSource);
  }

  // Get entries by reference
  async getEntriesByReference(reference: string): Promise<GLEntry[]> {
    return await prisma.gLEntry.findMany({
      where: { reference },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Cleanup
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}

export default GLDataService;