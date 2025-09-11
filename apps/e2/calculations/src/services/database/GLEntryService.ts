
import { prisma } from '@/utils/database';
import type { GLEntry as GLEntryType } from '@/lib/services/GLDataService';
import logger from '@/utils/logger';

class GLEntryService {
  private static instance: GLEntryService;
  private subscribers: (() => void)[] = [];

  static getInstance(): GLEntryService {
    if (!GLEntryService.instance) {
      GLEntryService.instance = new GLEntryService();
    }
    return GLEntryService.instance;
  }

  // Create or replace all GL entries
  async setEntries(entries: GLEntryType[]): Promise<void> {
    try {
      logger.info('GLEntryService: setEntries called with', entries.length, 'entries');
      
      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Clear existing entries
        const deleteResult = await tx.gLEntry.deleteMany({});
        logger.info('GLEntryService: Deleted', deleteResult.count, 'existing entries');
        
        // Create new entries
        const dbEntries = entries.map(entry => ({
          date: entry.date,
          account: entry.accountCode || entry.category,
          accountCategory: entry.accountType || 'Expense',
          description: entry.description,
          debit: entry.amount > 0 ? entry.amount : 0,
          credit: entry.amount < 0 ? Math.abs(entry.amount) : 0,
          reference: entry.category,
          source: entry.isProjection ? 'projection' : 'manual',
          metadata: {
            category: entry.category,
            isProjection: entry.isProjection || false,
            isReconciled: entry.isReconciled || false,
            isActual: entry.isActual || false,
            runningBalance: entry.runningBalance || 0
          }
        }));
        
        const createResult = await tx.gLEntry.createMany({
          data: dbEntries
        });
        logger.info('GLEntryService: Created', createResult.count, 'new entries');
      });
      
      logger.info('GLEntryService: Successfully saved all entries to database');
      this.notifySubscribers();
    } catch (error) {
      logger.error('Error saving GL entries to database:', error);
      throw error;
    }
  }

  // Get all GL entries
  async getEntries(): Promise<GLEntryType[]> {
    try {
      const entries = await prisma.gLEntry.findMany({
        orderBy: { date: 'asc' }
      });
      
      return entries.map(entry => {
        const metadata = entry.metadata as any || {};
        return {
          date: entry.date,
          description: entry.description,
          category: metadata.category || entry.reference || entry.account,
          accountCode: entry.account,
          accountType: entry.accountCategory as any,
          amount: entry.debit.toNumber() > 0 ? entry.debit.toNumber() : -entry.credit.toNumber(),
          runningBalance: metadata.runningBalance,
          isProjection: metadata.isProjection || entry.source === 'projection',
          isReconciled: metadata.isReconciled || false,
          isActual: metadata.isActual || false
        };
      });
    } catch (error) {
      logger.error('Error loading GL entries from database:', error);
      return [];
    }
  }

  // Get entries by date range
  async getEntriesByDateRange(startDate: Date, endDate: Date): Promise<GLEntryType[]> {
    try {
      const entries = await prisma.gLEntry.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      });
      
      return entries.map(entry => {
        const metadata = entry.metadata as any || {};
        return {
          date: entry.date,
          description: entry.description,
          category: metadata.category || entry.reference || entry.account,
          accountCode: entry.account,
          accountType: entry.accountCategory as any,
          amount: entry.debit.toNumber() > 0 ? entry.debit.toNumber() : -entry.credit.toNumber(),
          runningBalance: metadata.runningBalance,
          isProjection: metadata.isProjection || entry.source === 'projection',
          isReconciled: metadata.isReconciled || false,
          isActual: metadata.isActual || false
        };
      });
    } catch (error) {
      logger.error('Error loading GL entries by date range:', error);
      return [];
    }
  }

  // Add a single GL entry
  async addEntry(entry: GLEntryType): Promise<void> {
    try {
      const dbEntry = {
        date: entry.date,
        account: entry.accountCode || entry.category,
        accountCategory: entry.accountType || 'Expense',
        description: entry.description,
        debit: entry.amount > 0 ? entry.amount : 0,
        credit: entry.amount < 0 ? Math.abs(entry.amount) : 0,
        reference: entry.category,
        source: entry.isProjection ? 'projection' : 'manual',
        metadata: {
          category: entry.category,
          isProjection: entry.isProjection || false,
          isReconciled: entry.isReconciled || false,
          isActual: entry.isActual || false,
          runningBalance: entry.runningBalance || 0
        }
      };
      
      await prisma.gLEntry.create({
        data: dbEntry
      });
      
      logger.info('GLEntryService: Successfully added entry');
      this.notifySubscribers();
    } catch (error) {
      logger.error('Error adding GL entry to database:', error);
      throw error;
    }
  }

  // Get filtered entries
  async getFilteredEntries(filters: {
    startDate?: Date;
    endDate?: Date;
    accountType?: string;
    accountCode?: string;
    category?: string;
    isProjection?: boolean;
    isReconciled?: boolean;
    isActual?: boolean;
  }): Promise<{ entries: GLEntryType[]; summary: any }> {
    try {
      // Build where clause
      const where: any = {};
      
      if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate) where.date.gte = filters.startDate;
        if (filters.endDate) where.date.lte = filters.endDate;
      }
      
      if (filters.accountType) {
        where.accountCategory = filters.accountType;
      }
      
      if (filters.accountCode) {
        where.account = filters.accountCode;
      }
      
      // Fetch entries with filters
      const entries = await prisma.gLEntry.findMany({
        where,
        orderBy: { date: 'asc' }
      });
      
      // Transform entries
      let transformedEntries = entries.map(entry => {
        const metadata = entry.metadata as any || {};
        return {
          date: entry.date,
          description: entry.description,
          category: metadata.category || entry.reference || entry.account,
          accountCode: entry.account,
          accountType: entry.accountCategory as any,
          amount: entry.debit.toNumber() > 0 ? entry.debit.toNumber() : -entry.credit.toNumber(),
          runningBalance: metadata.runningBalance,
          isProjection: metadata.isProjection || entry.source === 'projection',
          isReconciled: metadata.isReconciled || false,
          isActual: metadata.isActual || false,
          source: entry.source || 'unknown' // Include the source field!
        };
      });
      
      // Apply metadata-based filters
      if (filters.category) {
        transformedEntries = transformedEntries.filter(entry => entry.category === filters.category);
      }
      
      if (filters.isProjection !== undefined) {
        transformedEntries = transformedEntries.filter(entry => entry.isProjection === filters.isProjection);
      }
      
      if (filters.isReconciled !== undefined) {
        transformedEntries = transformedEntries.filter(entry => entry.isReconciled === filters.isReconciled);
      }
      
      if (filters.isActual !== undefined) {
        transformedEntries = transformedEntries.filter(entry => entry.isActual === filters.isActual);
      }
      
      // Calculate summary
      const summary = {
        totalEntries: transformedEntries.length,
        projectionCount: transformedEntries.filter(e => e.isProjection).length,
        reconciledCount: transformedEntries.filter(e => e.isReconciled).length,
        actualCount: transformedEntries.filter(e => e.isActual).length,
        totalDebits: transformedEntries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0),
        totalCredits: transformedEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0),
      };
      
      return { entries: transformedEntries, summary };
    } catch (error) {
      logger.error('Error fetching filtered GL entries:', error);
      throw error;
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

export default GLEntryService;