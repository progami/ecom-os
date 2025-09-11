import { structuredLogger } from '@/lib/logger'

interface ParsedAgedContact {
  contactName: string
  contactId?: string
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  days91Plus: number
  totalOutstanding: number
}

interface AgedReportStructure {
  contacts: ParsedAgedContact[]
  totals: {
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days91Plus: number
    totalOutstanding: number
  }
}

export class XeroAgedReportsParser {
  /**
   * Parse Xero Aged Payables/Receivables data
   * Handles both CSV format and pre-formatted object data
   */
  static parse(data: string[][] | any[], reportType: 'payables' | 'receivables' = 'payables'): AgedReportStructure {
    // Check if data is pre-formatted objects
    if (this.isPreformattedData(data)) {
      return this.parsePreformattedData(data as any[], reportType)
    }
    
    // Otherwise parse as CSV
    return this.parseCSVData(data as string[][], reportType)
  }

  /**
   * Check if data is pre-formatted objects rather than CSV arrays
   */
  private static isPreformattedData(data: any): boolean {
    if (!Array.isArray(data) || data.length === 0) return false
    
    const firstItem = data[0]
    if (typeof firstItem !== 'object' || Array.isArray(firstItem)) return false
    
    // Check for typical aged report object properties
    const hasContactProperties = 'contactName' in firstItem || 'contact' in firstItem || 'Contact' in firstItem || 
                                'supplierName' in firstItem || 'customerName' in firstItem
    const hasAgingProperties = 'current' in firstItem || 'Current' in firstItem || 
                              'days1to30' in firstItem || 'days31to60' in firstItem ||
                              'totalOutstanding' in firstItem || 'total' in firstItem
    
    return hasContactProperties || hasAgingProperties
  }

  /**
   * Parse pre-formatted object data
   */
  private static parsePreformattedData(data: any[], reportType: 'payables' | 'receivables'): AgedReportStructure {
    const result: AgedReportStructure = {
      contacts: [],
      totals: {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
        totalOutstanding: 0
      }
    }

    for (const item of data) {
      const contactName = (item.contactName || item.contact || item.Contact || 
                          item.supplierName || item.customerName || '').toString().trim()
      
      if (!contactName || contactName.toLowerCase().includes('total')) continue

      const current = this.parseAmount((item.current || item.Current || item['0-30'] || '0').toString())
      const days1to30 = this.parseAmount((item.days1to30 || item['1-30'] || item['31-60'] || item['Month 1'] || '0').toString())
      const days31to60 = this.parseAmount((item.days31to60 || item['31-60'] || item['61-90'] || item['Month 2'] || '0').toString())
      const days61to90 = this.parseAmount((item.days61to90 || item['61-90'] || item['91-120'] || item['Month 3'] || '0').toString())
      const days91Plus = this.parseAmount((item.days91Plus || item['91+'] || item['>90'] || item['Over 90'] || item['Month 4'] || '0').toString())
      
      let totalOutstanding = this.parseAmount((item.totalOutstanding || item.total || item.Total || '0').toString())
      
      // Calculate total if not provided
      if (totalOutstanding === 0) {
        totalOutstanding = current + days1to30 + days31to60 + days61to90 + days91Plus
      }

      // Skip if all amounts are zero
      if (totalOutstanding === 0 && current === 0 && days1to30 === 0 && 
          days31to60 === 0 && days61to90 === 0 && days91Plus === 0) {
        continue
      }

      const contact: ParsedAgedContact = {
        contactName,
        contactId: item.contactId || item.id || `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        current,
        days1to30,
        days31to60,
        days61to90,
        days91Plus,
        totalOutstanding
      }

      result.contacts.push(contact)
      
      // Add to totals
      result.totals.current += current
      result.totals.days1to30 += days1to30
      result.totals.days31to60 += days31to60
      result.totals.days61to90 += days61to90
      result.totals.days91Plus += days91Plus
      result.totals.totalOutstanding += totalOutstanding
    }

    structuredLogger.info(`[XeroAgedReportsParser] Parsed pre-formatted aged ${reportType} data`, {
      contactCount: result.contacts.length,
      totalOutstanding: result.totals.totalOutstanding,
      current: result.totals.current,
      overdue: result.totals.totalOutstanding - result.totals.current
    })

    return result
  }

  /**
   * Parse Xero Aged Payables/Receivables CSV format
   * Handles various column layouts and summaries
   */
  private static parseCSVData(csvData: string[][], reportType: 'payables' | 'receivables' = 'payables'): AgedReportStructure {
    const result: AgedReportStructure = {
      contacts: [],
      totals: {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
        totalOutstanding: 0
      }
    }

    // Find header row
    let headerRowIndex = -1
    let headers: string[] = []
    
    for (let i = 0; i < Math.min(10, csvData.length); i++) {
      const row = csvData[i]
      if (row && row.length > 0) {
        // Check if this row contains aging headers
        const hasContactHeader = row.some(cell => 
          cell && (cell.toLowerCase().includes('contact') || 
                   cell.toLowerCase().includes('supplier') ||
                   cell.toLowerCase().includes('customer') ||
                   cell.toLowerCase().includes('vendor'))
        )
        const hasAgingHeader = row.some(cell => 
          cell && (cell.toLowerCase().includes('current') || 
                   cell.toLowerCase().includes('days') ||
                   cell.toLowerCase().includes('month'))
        )
        
        if (hasContactHeader || hasAgingHeader) {
          headerRowIndex = i
          headers = row.map(h => (h || '').toLowerCase().trim())
          break
        }
      }
    }

    if (headerRowIndex === -1) {
      structuredLogger.warn('[XeroAgedReportsParser] Could not find header row')
      return result
    }

    // Identify column indices
    const columnMap = this.identifyColumns(headers)
    
    // Parse data rows
    let skipNextRow = false
    for (let i = headerRowIndex + 1; i < csvData.length; i++) {
      if (skipNextRow) {
        skipNextRow = false
        continue
      }

      const row = csvData[i]
      
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue
      }

      // Check if this is a total row
      const firstCell = (row[0] || '').trim().toLowerCase()
      if (firstCell.includes('total') || firstCell === 'grand total') {
        // Extract totals if this is the grand total row
        if (firstCell === 'total' || firstCell === 'grand total') {
          const totals = this.parseContactRow(row, columnMap)
          if (totals) {
            result.totals = {
              current: totals.current,
              days1to30: totals.days1to30,
              days31to60: totals.days31to60,
              days61to90: totals.days61to90,
              days91Plus: totals.days91Plus,
              totalOutstanding: totals.totalOutstanding
            }
          }
        }
        continue
      }

      // Skip date range headers (e.g., "As at 30 June 2025")
      if (firstCell.includes('as at') || firstCell.includes('as of')) {
        continue
      }

      const contact = this.parseContactRow(row, columnMap)
      if (contact && contact.totalOutstanding !== 0) {
        result.contacts.push(contact)
      }
    }

    // Calculate totals if not found
    if (result.totals.totalOutstanding === 0 && result.contacts.length > 0) {
      result.contacts.forEach(contact => {
        result.totals.current += contact.current
        result.totals.days1to30 += contact.days1to30
        result.totals.days31to60 += contact.days31to60
        result.totals.days61to90 += contact.days61to90
        result.totals.days91Plus += contact.days91Plus
        result.totals.totalOutstanding += contact.totalOutstanding
      })
    }

    structuredLogger.info(`[XeroAgedReportsParser] Parsed aged ${reportType}`, {
      contactCount: result.contacts.length,
      totalOutstanding: result.totals.totalOutstanding,
      current: result.totals.current,
      overdue: result.totals.totalOutstanding - result.totals.current
    })

    return result
  }

  private static identifyColumns(headers: string[]): Record<string, number> {
    const columnMap: Record<string, number> = {
      contact: -1,
      current: -1,
      days1to30: -1,
      days31to60: -1,
      days61to90: -1,
      days91Plus: -1,
      total: -1
    }

    headers.forEach((header, index) => {
      if (header.includes('contact') || header.includes('supplier') || 
          header.includes('customer') || header.includes('vendor') ||
          header.includes('name')) {
        columnMap.contact = index
      } else if (header === 'current' || header.includes('not yet due') || 
                 header.includes('0 days')) {
        columnMap.current = index
      } else if (header.includes('1-30') || header.includes('1 - 30') || 
                 header === 'month 1' || header.includes('30 days')) {
        columnMap.days1to30 = index
      } else if (header.includes('31-60') || header.includes('31 - 60') || 
                 header === 'month 2' || header.includes('60 days')) {
        columnMap.days31to60 = index
      } else if (header.includes('61-90') || header.includes('61 - 90') || 
                 header === 'month 3' || header.includes('90 days')) {
        columnMap.days61to90 = index
      } else if (header.includes('91+') || header.includes('> 90') || 
                 header.includes('older') || header === 'month 4' ||
                 header.includes('over 90')) {
        columnMap.days91Plus = index
      } else if (header === 'total' || header.includes('total due') || 
                 header.includes('balance')) {
        columnMap.total = index
      }
    })

    return columnMap
  }

  private static parseContactRow(row: string[], columnMap: Record<string, number>): ParsedAgedContact | null {
    // Extract contact name
    let contactName = ''
    if (columnMap.contact !== -1 && row[columnMap.contact]) {
      contactName = row[columnMap.contact].trim()
    } else if (row[0]) {
      // Use first non-empty column if contact column not identified
      contactName = row[0].trim()
    }

    if (!contactName) return null

    // Extract amounts
    const current = columnMap.current !== -1 ? this.parseAmount(row[columnMap.current]) : 0
    const days1to30 = columnMap.days1to30 !== -1 ? this.parseAmount(row[columnMap.days1to30]) : 0
    const days31to60 = columnMap.days31to60 !== -1 ? this.parseAmount(row[columnMap.days31to60]) : 0
    const days61to90 = columnMap.days61to90 !== -1 ? this.parseAmount(row[columnMap.days61to90]) : 0
    const days91Plus = columnMap.days91Plus !== -1 ? this.parseAmount(row[columnMap.days91Plus]) : 0
    
    // Get total from column or calculate
    let totalOutstanding = 0
    if (columnMap.total !== -1 && row[columnMap.total]) {
      totalOutstanding = this.parseAmount(row[columnMap.total])
    } else {
      totalOutstanding = current + days1to30 + days31to60 + days61to90 + days91Plus
    }

    // Skip if all amounts are zero
    if (totalOutstanding === 0 && current === 0 && days1to30 === 0 && 
        days31to60 === 0 && days61to90 === 0 && days91Plus === 0) {
      return null
    }

    return {
      contactName,
      contactId: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      current,
      days1to30,
      days31to60,
      days61to90,
      days91Plus,
      totalOutstanding
    }
  }

  private static parseAmount(value: string | undefined): number {
    if (!value) return 0
    
    // Remove currency symbols, commas, spaces
    let cleaned = value.replace(/[£$€¥,\s]/g, '').trim()
    
    // Handle negative values in parentheses
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1)
    }
    
    // Handle dash or hyphen as zero
    if (cleaned === '-' || cleaned === '–' || cleaned === '—') {
      return 0
    }
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Convert parsed structure to database format
   */
  static toImportFormat(parsed: AgedReportStructure, asAtDate: Date, reportType: 'payables' | 'receivables' = 'payables') {
    const totalOutstanding = parsed.totals.totalOutstanding
    const totalOverdue = parsed.totals.days1to30 + parsed.totals.days31to60 + 
                         parsed.totals.days61to90 + parsed.totals.days91Plus
    const criticalAmount = parsed.totals.days61to90 + parsed.totals.days91Plus

    return {
      totalOutstanding,
      current: parsed.totals.current,
      days1to30: parsed.totals.days1to30,
      days31to60: parsed.totals.days31to60,
      days61to90: parsed.totals.days61to90,
      days91Plus: parsed.totals.days91Plus,
      contacts: parsed.contacts.map((contact, index) => ({
        contactId: contact.contactId || `contact-${index + 1}`,
        contactName: contact.contactName,
        totalOutstanding: contact.totalOutstanding,
        current: contact.current,
        days1to30: contact.days1to30,
        days31to60: contact.days31to60,
        days61to90: contact.days61to90,
        days91Plus: contact.days91Plus
      })),
      summary: {
        totalOutstanding,
        percentageCurrent: totalOutstanding > 0 ? (parsed.totals.current / totalOutstanding) * 100 : 0,
        percentageOverdue: totalOutstanding > 0 ? (totalOverdue / totalOutstanding) * 100 : 0,
        criticalAmount,
        criticalPercentage: totalOutstanding > 0 ? (criticalAmount / totalOutstanding) * 100 : 0
      },
      reportDate: asAtDate.toISOString(),
      fromDate: asAtDate.toISOString(),
      toDate: asAtDate.toISOString()
    }
  }
}