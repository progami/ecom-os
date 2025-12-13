import { ReportType } from '@/components/reports/import-history/types'

export interface ApiHistoryEntry {
  timestamp: number
  reportType: ReportType
  periodStart?: string
  periodEnd: string
  source: 'xero'
  metadata?: Record<string, any>
}

export class ApiHistoryTracker {
  private static readonly STORAGE_KEY_PREFIX = 'api-history-'
  private static readonly MAX_ENTRIES = 50
  
  /**
   * Track an API fetch
   */
  static track(
    reportType: ReportType,
    periodStart: Date | undefined,
    periodEnd: Date,
    metadata?: Record<string, any>
  ) {
    const entry: ApiHistoryEntry = {
      timestamp: Date.now(),
      reportType,
      periodStart: periodStart?.toISOString(),
      periodEnd: periodEnd.toISOString(),
      source: 'xero',
      metadata
    }
    
    // Get existing history
    const key = `${this.STORAGE_KEY_PREFIX}${reportType}`
    const existing = this.getHistory(reportType)
    
    // Add new entry at the beginning
    const updated = [entry, ...existing].slice(0, this.MAX_ENTRIES)
    
    // Save to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(updated))
      
      // Also update the "all" history
      const allKey = `${this.STORAGE_KEY_PREFIX}all`
      const allHistory = this.getHistory()
      const allUpdated = [entry, ...allHistory].slice(0, this.MAX_ENTRIES)
      localStorage.setItem(allKey, JSON.stringify(allUpdated))
    } catch (e) {
      console.error('Failed to save API history:', e)
    }
  }
  
  /**
   * Get API history for a report type (or all if not specified)
   */
  static getHistory(reportType?: ReportType): ApiHistoryEntry[] {
    const key = reportType 
      ? `${this.STORAGE_KEY_PREFIX}${reportType}`
      : `${this.STORAGE_KEY_PREFIX}all`
    
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : []
    } catch (e) {
      console.error('Failed to load API history:', e)
      return []
    }
  }
  
  /**
   * Clear history for a report type (or all if not specified)
   */
  static clearHistory(reportType?: ReportType) {
    if (reportType) {
      localStorage.removeItem(`${this.STORAGE_KEY_PREFIX}${reportType}`)
    } else {
      // Clear all history
      Object.keys(localStorage)
        .filter(key => key.startsWith(this.STORAGE_KEY_PREFIX))
        .forEach(key => localStorage.removeItem(key))
    }
  }
  
  /**
   * Get the latest API fetch for a report type
   */
  static getLatest(reportType: ReportType): ApiHistoryEntry | null {
    const history = this.getHistory(reportType)
    return history.length > 0 ? history[0] : null
  }
}