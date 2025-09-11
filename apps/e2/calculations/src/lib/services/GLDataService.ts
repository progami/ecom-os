// GLDataService.ts
// Service to store and manage General Ledger entries globally
import GLEntryService from '@/services/database/GLEntryService'
import logger from '@/utils/logger'

interface GLEntry {
  date: Date
  description: string
  category: string
  accountCode?: string
  accountType?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  amount: number
  runningBalance?: number
  isProjection?: boolean
  isReconciled?: boolean
  isActual?: boolean  // Indicates if this entry represents actual bank transaction
}

interface GLFilters {
  startDate?: Date
  endDate?: Date
  accountType?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  accountCode?: string
  category?: string
  isProjection?: boolean
  isReconciled?: boolean
  isActual?: boolean
}

class GLDataService {
  private static instance: GLDataService
  private glEntryService?: GLEntryService
  
  // In-memory cache for GL entries
  private entries: GLEntry[] = []
  private isLoaded = false
  
  // Event listeners for data changes
  private listeners: Set<() => void> = new Set()
  
  private constructor() {
    // Only initialize database service on server side
    if (typeof window === 'undefined') {
      this.glEntryService = GLEntryService.getInstance()
      // Load data from database on initialization
      this.loadFromDatabase()
      
      // Subscribe to database changes
      this.glEntryService.subscribe(() => {
        this.loadFromDatabase()
      })
    }
  }
  
  static getInstance(): GLDataService {
    if (!GLDataService.instance) {
      GLDataService.instance = new GLDataService()
    }
    return GLDataService.instance
  }
  
  // Database methods
  private async loadFromDatabase() {
    if (!this.glEntryService) return;
    
    try {
      this.entries = await this.glEntryService.getEntries()
      this.isLoaded = true
      this.notifyListeners()
    } catch (error) {
      logger.error('Failed to load GL data from database:', error)
      this.entries = []
    }
  }
  
  private async saveToDatabase() {
    if (!this.glEntryService) return;
    
    try {
      logger.info('GLDataService: Saving', this.entries.length, 'entries to database')
      await this.glEntryService.setEntries(this.entries)
      logger.info('GLDataService: Successfully saved entries to database')
    } catch (error) {
      logger.error('Failed to save GL data to database:', error)
      // Keep in-memory data even if save fails
    }
  }

  // Core methods for managing entries
  setEntries(entries: GLEntry[]) {
    // Ensure dates are Date objects
    this.entries = entries.map(entry => ({
      ...entry,
      date: entry.date instanceof Date ? entry.date : new Date(entry.date)
    }))
    console.log('GLDataService: setEntries called with', entries.length, 'entries')
    // Don't save to database from client side - only update in-memory data
    this.notifyListeners()
  }
  
  getEntries(): GLEntry[] {
    return [...this.entries] // Return a copy to prevent external mutations
  }
  
  // Add a single entry
  addEntry(entry: GLEntry) {
    const newEntry = {
      ...entry,
      date: entry.date instanceof Date ? entry.date : new Date(entry.date)
    }
    this.entries.push(newEntry)
    if (this.glEntryService) {
      this.glEntryService.addEntry(newEntry) // Save to database (async)
    }
    this.notifyListeners()
  }
  
  // Add multiple entries
  addEntries(entries: GLEntry[]) {
    const newEntries = entries.map(entry => ({
      ...entry,
      date: entry.date instanceof Date ? entry.date : new Date(entry.date)
    }))
    this.entries.push(...newEntries)
    this.saveToDatabase() // Save to database (async)
    this.notifyListeners()
  }
  
  // Clear all entries
  clearEntries() {
    this.entries = []
    this.saveToDatabase() // Save to database (async)
    this.notifyListeners()
  }
  
  // Filter methods
  getEntriesByDateRange(startDate: Date, endDate: Date): GLEntry[] {
    return this.entries.filter(entry => {
      const entryDate = new Date(entry.date)
      return entryDate >= startDate && entryDate <= endDate
    })
  }
  
  getEntriesByAccountType(accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'): GLEntry[] {
    return this.entries.filter(entry => entry.accountType === accountType)
  }
  
  getEntriesByAccountCode(accountCode: string): GLEntry[] {
    return this.entries.filter(entry => entry.accountCode === accountCode)
  }
  
  getEntriesByCategory(category: string): GLEntry[] {
    return this.entries.filter(entry => entry.category === category)
  }
  
  // Advanced filtering with multiple criteria
  getEntriesFiltered(filters: GLFilters): GLEntry[] {
    return this.entries.filter(entry => {
      // Date range filter
      if (filters.startDate || filters.endDate) {
        const entryDate = new Date(entry.date)
        if (filters.startDate && entryDate < filters.startDate) return false
        if (filters.endDate && entryDate > filters.endDate) return false
      }
      
      // Account type filter
      if (filters.accountType && entry.accountType !== filters.accountType) {
        return false
      }
      
      // Account code filter
      if (filters.accountCode && entry.accountCode !== filters.accountCode) {
        return false
      }
      
      // Category filter
      if (filters.category && entry.category !== filters.category) {
        return false
      }
      
      // Projection filter
      if (filters.isProjection !== undefined && entry.isProjection !== filters.isProjection) {
        return false
      }
      
      // Reconciled filter
      if (filters.isReconciled !== undefined && entry.isReconciled !== filters.isReconciled) {
        return false
      }
      
      // Actual filter
      if (filters.isActual !== undefined && entry.isActual !== filters.isActual) {
        return false
      }
      
      return true
    })
  }
  
  // Utility methods
  getUniqueCategories(): string[] {
    const categories = new Set(this.entries.map(entry => entry.category))
    return Array.from(categories).sort()
  }
  
  getUniqueAccountCodes(): string[] {
    const codes = new Set(this.entries.filter(entry => entry.accountCode).map(entry => entry.accountCode!))
    return Array.from(codes).sort()
  }
  
  getDateRange(): { startDate: Date | null; endDate: Date | null } {
    if (this.entries.length === 0) {
      return { startDate: null, endDate: null }
    }
    
    const dates = this.entries.map(entry => new Date(entry.date))
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())))
    
    return { startDate, endDate }
  }
  
  // Calculate balances by account
  getBalanceByAccount(accountCode: string, asOfDate?: Date): number {
    const entries = accountCode 
      ? this.getEntriesByAccountCode(accountCode)
      : this.entries
    
    return entries
      .filter(entry => !asOfDate || new Date(entry.date) <= asOfDate)
      .reduce((balance, entry) => balance + entry.amount, 0)
  }
  
  // Calculate balances by account type
  getBalanceByAccountType(accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense', asOfDate?: Date): number {
    const entries = this.getEntriesByAccountType(accountType)
    
    return entries
      .filter(entry => !asOfDate || new Date(entry.date) <= asOfDate)
      .reduce((balance, entry) => balance + entry.amount, 0)
  }
  
  // Event listener methods
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }
  
  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }
  
  // Method to get summary statistics
  getSummaryStats() {
    const totalEntries = this.entries.length
    const dateRange = this.getDateRange()
    const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const
    
    const balancesByType = accountTypes.reduce((acc, type) => {
      acc[type] = this.getBalanceByAccountType(type)
      return acc
    }, {} as Record<string, number>)
    
    const projectionCount = this.entries.filter(e => e.isProjection).length
    const reconciledCount = this.entries.filter(e => e.isReconciled).length
    const actualCount = this.entries.filter(e => e.isActual).length
    
    return {
      totalEntries,
      dateRange,
      balancesByType,
      projectionCount,
      reconciledCount,
      actualCount,
      historicalCount: totalEntries - projectionCount
    }
  }
}

export default GLDataService
export type { GLEntry, GLFilters }