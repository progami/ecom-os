
import { prisma } from '@/utils/database';
import logger from '@/utils/logger';

// Get the Monday of the week for a given date
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Get Sunday
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

export interface GLExpenseData {
  id: string;
  date: Date;
  weekStarting: Date;
  weekEnding: Date;
  account: string;
  accountName: string;
  category: string;
  subcategory: string;
  description: string;
  amount: number;
  reference?: string;
  source: string;
  metadata?: any;
}

// Chart of Accounts mapping for expense accounts (5000-5999 range)
const expenseAccountMap: Record<string, { name: string; category: string; subcategory: string }> = {
  // Cost of Goods Sold (5000-5099)
  '5000': { name: 'Cost of Goods Sold', category: 'Cost of Goods Sold', subcategory: 'General COGS' },
  '5010': { name: 'Raw Materials', category: 'Cost of Goods Sold', subcategory: 'Raw Materials' },
  '5020': { name: 'Packaging Materials', category: 'Cost of Goods Sold', subcategory: 'Packaging Materials' },
  '5030': { name: 'Manufacturing Labor', category: 'Cost of Goods Sold', subcategory: 'Manufacturing Labor' },
  '5040': { name: 'Manufacturing Overhead', category: 'Cost of Goods Sold', subcategory: 'Manufacturing Overhead' },
  '5050': { name: 'Freight & Shipping', category: 'Cost of Goods Sold', subcategory: 'Freight & Shipping' },
  
  // Operating Expenses (5100-5199)
  '5100': { name: 'Operating Expenses', category: 'Operating Expenses', subcategory: 'General Operating' },
  '5110': { name: 'Salaries & Wages', category: 'Operating Expenses', subcategory: 'Salaries & Wages' },
  '5120': { name: 'Rent', category: 'Operating Expenses', subcategory: 'Rent' },
  '5130': { name: 'Utilities', category: 'Operating Expenses', subcategory: 'Utilities' },
  '5140': { name: 'Insurance', category: 'Operating Expenses', subcategory: 'Insurance' },
  '5150': { name: 'Marketing & Advertising', category: 'Operating Expenses', subcategory: 'Marketing & Advertising' },
  '5160': { name: 'Professional Fees', category: 'Operating Expenses', subcategory: 'Professional Fees' },
  '5170': { name: 'Office Supplies', category: 'Operating Expenses', subcategory: 'Office Supplies' },
  '5180': { name: 'Travel & Entertainment', category: 'Operating Expenses', subcategory: 'Travel & Entertainment' },
  '5190': { name: 'Depreciation', category: 'Operating Expenses', subcategory: 'Depreciation' },
  
  // Financial Expenses (5200-5299)
  '5200': { name: 'Interest Expense', category: 'Financial Expenses', subcategory: 'Interest Expense' },
  
  // Amazon Expenses (5310-5399) - Note: 5300 removed
  '5310': { name: 'Amazon Advertising', category: 'Amazon Expenses', subcategory: 'Advertising' },
  
  // Other Expenses (5400-5899)
  '5400': { name: 'Other Expenses', category: 'Other Expenses', subcategory: 'Miscellaneous' },
  
  // Tax Expenses (5900-5999)
  '5900': { name: 'Income Tax Expense', category: 'Tax Expenses', subcategory: 'Income Tax' }
};

class GLExpenseService {
  private static instance: GLExpenseService;
  private subscribers: (() => void)[] = [];

  static getInstance(): GLExpenseService {
    if (!GLExpenseService.instance) {
      GLExpenseService.instance = new GLExpenseService();
    }
    return GLExpenseService.instance;
  }

  // Get expenses from GL entries by date range
  async getExpensesByDateRange(startDate: Date, endDate: Date): Promise<GLExpenseData[]> {
    try {
      const glEntries = await prisma.gLEntry.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          },
          account: {
            gte: '5000',
            lte: '5999'
          }
        },
        orderBy: { date: 'asc' }
      });
      
      return glEntries.map(entry => {
        const weekBounds = getWeekBounds(entry.date);
        const accountInfo = expenseAccountMap[entry.account] || {
          name: `Account ${entry.account}`,
          category: 'Other Expenses',
          subcategory: `Account ${entry.account}`
        };
        
        // For expense accounts, debits increase expenses
        const amount = Number(entry.debit) - Number(entry.credit);
        
        return {
          id: entry.id,
          date: entry.date,
          weekStarting: weekBounds.start,
          weekEnding: weekBounds.end,
          account: entry.account,
          accountName: accountInfo.name,
          category: accountInfo.category,
          subcategory: accountInfo.subcategory,
          description: entry.description,
          amount,
          reference: entry.reference || undefined,
          source: entry.source,
          metadata: entry.metadata
        };
      });
    } catch (error) {
      logger.error('Error loading expenses from GL:', error);
      return [];
    }
  }

  // Get expenses by week grouped by category
  async getExpensesByWeekGrouped(weekStarting: Date): Promise<{
    categories: Array<{
      category: string;
      subcategories: Array<{
        subcategory: string;
        amount: number;
        entries: GLExpenseData[];
      }>;
      total: number;
    }>;
    weekTotal: number;
  }> {
    try {
      const weekBounds = getWeekBounds(weekStarting);
      const expenses = await this.getExpensesByDateRange(weekBounds.start, weekBounds.end);
      
      // Group by category and subcategory
      const categoryMap = new Map<string, Map<string, GLExpenseData[]>>();
      
      expenses.forEach(expense => {
        if (!categoryMap.has(expense.category)) {
          categoryMap.set(expense.category, new Map());
        }
        
        const subcategoryMap = categoryMap.get(expense.category);
        if (!subcategoryMap) return; // Use return instead of continue in forEach
        
        if (!subcategoryMap.has(expense.subcategory)) {
          subcategoryMap.set(expense.subcategory, []);
        }
        
        const subcategoryList = subcategoryMap.get(expense.subcategory);
        if (subcategoryList) {
          subcategoryList.push(expense);
        }
      });
      
      // Convert to structured format
      const categories = Array.from(categoryMap.entries()).map(([category, subcategoryMap]) => {
        const subcategories = Array.from(subcategoryMap.entries()).map(([subcategory, entries]) => {
          const amount = entries.reduce((sum, entry) => sum + entry.amount, 0);
          return {
            subcategory,
            amount,
            entries
          };
        }).sort((a, b) => b.amount - a.amount);
        
        const total = subcategories.reduce((sum, sub) => sum + sub.amount, 0);
        
        return {
          category,
          subcategories,
          total
        };
      }).sort((a, b) => b.total - a.total);
      
      const weekTotal = categories.reduce((sum, cat) => sum + cat.total, 0);
      
      return {
        categories,
        weekTotal
      };
    } catch (error) {
      logger.error('Error loading grouped expenses from GL:', error);
      return {
        categories: [],
        weekTotal: 0
      };
    }
  }

  // Get weekly expense summary for a date range
  async getWeeklyExpenseSummary(startDate: Date, endDate: Date): Promise<Array<{
    weekStarting: Date;
    weekEnding: Date;
    categories: Record<string, number>;
    total: number;
  }>> {
    try {
      const expenses = await this.getExpensesByDateRange(startDate, endDate);
      
      // Group by week
      const weekMap = new Map<string, {
        weekStarting: Date;
        weekEnding: Date;
        categories: Map<string, number>;
      }>();
      
      expenses.forEach(expense => {
        const weekKey = expense.weekStarting.toISOString();
        
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            weekStarting: expense.weekStarting,
            weekEnding: expense.weekEnding,
            categories: new Map()
          });
        }
        
        const week = weekMap.get(weekKey)!;
        week.categories.set(
          expense.category,
          (week.categories.get(expense.category) || 0) + expense.amount
        );
      });
      
      // Convert to array format
      return Array.from(weekMap.values())
        .map(week => {
          const categories = Object.fromEntries(week.categories);
          const total = Array.from(week.categories.values()).reduce((sum, val) => sum + val, 0);
          
          return {
            weekStarting: week.weekStarting,
            weekEnding: week.weekEnding,
            categories,
            total
          };
        })
        .sort((a, b) => a.weekStarting.getTime() - b.weekStarting.getTime());
    } catch (error) {
      logger.error('Error loading weekly expense summary from GL:', error);
      return [];
    }
  }

  // Create GL entries for expenses
  async createExpenseGLEntries(expenses: Array<{
    date: Date;
    account: string;
    description: string;
    amount: number;
    reference?: string;
    metadata?: any;
  }>): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        for (const expense of expenses) {
          // Validate account exists
          if (!expenseAccountMap[expense.account]) {
            console.warn(`Unknown expense account: ${expense.account}`);
            continue;
          }
          
          // Create GL entry (debit increases expenses)
          await tx.gLEntry.create({
            data: {
              date: expense.date,
              account: expense.account,
              accountCategory: 'Expense',
              description: expense.description,
              debit: expense.amount,
              credit: 0,
              reference: expense.reference,
              source: 'automated',
              metadata: expense.metadata
            }
          });
        }
      });
      
      this.notifySubscribers();
    } catch (error) {
      logger.error('Error creating expense GL entries:', error);
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

export default GLExpenseService;
export { expenseAccountMap };