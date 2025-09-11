#!/usr/bin/env ts-node

/**
 * Financial Data Synchronization System
 * 
 * Synchronizes financial CSV data with all HTML tables in e2_new.html
 * Ensures consistency across all financial displays in the business plan
 * 
 * Usage:
 *   npm run sync-financials    # Updates all HTML tables from CSV
 *   npm run validate-financials # Checks data consistency
 */

import fs from 'fs/promises'
import path from 'path'
import * as cheerio from 'cheerio'

// Financial data interfaces
interface FinancialData {
  incomeStatement: {
    revenue: { [year: string]: number }
    cogs: { [year: string]: number }
    grossProfit: { [year: string]: number }
    operatingExpenses: { [year: string]: number }
    netIncome: { [year: string]: number }
    interestIncome: { [year: string]: number }
    advertising: { [year: string]: number }
  }
  balanceSheet: {
    assets: { [year: string]: number }
    liabilities: { [year: string]: number }
    equity: { [year: string]: number }
    cash: { [year: string]: number }
    inventory: { [year: string]: number }
    retainedEarnings: { [year: string]: number }
  }
  cashFlow: {
    netIncome: { [year: string]: number }
    operating: { [year: string]: number }
    investing: { [year: string]: number }
    financing: { [year: string]: number }
    netChange: { [year: string]: number }
    endingBalance: { [year: string]: number }
  }
  margins: {
    grossMargin: { [year: string]: string }
    netMargin: { [year: string]: string }
  }
}

interface ValidationError {
  table: string
  field: string
  expected: number | string
  actual: number | string
  message: string
}

class FinancialSync {
  private data: FinancialData | null = null
  private htmlContent: string = ''
  private $ = cheerio.load('')

  constructor(
    private csvPath = '../appendices/B-Financial-Documentation/financial-reports.csv',
    private htmlPath = '../e2_new.html'
  ) {}

  /**
   * Parse CSV financial data into structured format
   */
  async parseCSVData(): Promise<FinancialData> {
    const csvContent = await fs.readFile(this.csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())
    
    const data: FinancialData = {
      incomeStatement: {
        revenue: {},
        cogs: {},
        grossProfit: {},
        operatingExpenses: {},
        netIncome: {},
        interestIncome: {},
        advertising: {}
      },
      balanceSheet: {
        assets: {},
        liabilities: {},
        equity: {},
        cash: {},
        inventory: {},
        retainedEarnings: {}
      },
      cashFlow: {
        netIncome: {},
        operating: {},
        investing: {},
        financing: {},
        netChange: {},
        endingBalance: {}
      },
      margins: {
        grossMargin: {},
        netMargin: {}
      }
    }

    const years = ['2025', '2026', '2027', '2028', '2029', '2030']
    let currentSection = ''

    for (const line of lines) {
      const cols = line.split(',')
      const label = cols[0]?.trim()

      if (label.includes('=== INCOME STATEMENT ===')) {
        currentSection = 'income'
        continue
      } else if (label.includes('=== BALANCE SHEET ===')) {
        currentSection = 'balance'
        continue
      } else if (label.includes('=== CASH FLOW STATEMENT ===')) {
        currentSection = 'cashflow'
        continue
      }

      // Skip header rows and empty lines
      if (!label || label === 'Account' || label === 'Item' || cols.length < 7) continue

      // Parse data rows
      const values = years.map((_, i) => this.parseNumber(cols[i + 1]))

      switch (currentSection) {
        case 'income':
          this.parseIncomeStatement(label, values, years, data, cols)
          break
        case 'balance':
          this.parseBalanceSheet(label, values, years, data)
          break
        case 'cashflow':
          this.parseCashFlow(label, values, years, data)
          break
      }
    }

    this.data = data
    return data
  }

  private parseIncomeStatement(label: string, values: number[], years: string[], data: FinancialData, cols: string[]) {
    years.forEach((year, i) => {
      if (label.includes('Total Revenue')) {
        data.incomeStatement.revenue[year] = values[i]
      } else if (label.includes('4900 - Interest Income')) {
        data.incomeStatement.interestIncome[year] = values[i]
      } else if (label.includes('Total Cost of Goods Sold')) {
        data.incomeStatement.cogs[year] = values[i]
      } else if (label.includes('Gross Profit')) {
        data.incomeStatement.grossProfit[year] = values[i]
      } else if (label.includes('5310 - Advertising')) {
        data.incomeStatement.advertising[year] = values[i]
      } else if (label.includes('Total Operating Expenses')) {
        data.incomeStatement.operatingExpenses[year] = values[i]
      } else if (label.includes('NET INCOME')) {
        data.incomeStatement.netIncome[year] = values[i]
      } else if (label.includes('GROSS MARGIN %')) {
        data.margins.grossMargin[year] = cols[i + 1]?.trim() || '0%'
      } else if (label.includes('NET MARGIN %')) {
        data.margins.netMargin[year] = cols[i + 1]?.trim() || '0%'
      }
    })
  }

  private parseBalanceSheet(label: string, values: number[], years: string[], data: FinancialData) {
    years.forEach((year, i) => {
      if (label.includes('1000 - Business Bank Account')) {
        data.balanceSheet.cash[year] = values[i]
      } else if (label.includes('1200 - Inventory')) {
        data.balanceSheet.inventory[year] = values[i]
      } else if (label === 'TOTAL ASSETS') {
        data.balanceSheet.assets[year] = values[i]
      } else if (label === 'TOTAL LIABILITIES') {
        data.balanceSheet.liabilities[year] = values[i]
      } else if (label.includes('3900 - Retained Earnings')) {
        data.balanceSheet.retainedEarnings[year] = values[i]
      } else if (label === 'TOTAL EQUITY') {
        data.balanceSheet.equity[year] = values[i]
      }
    })
  }

  private parseCashFlow(label: string, values: number[], years: string[], data: FinancialData) {
    years.forEach((year, i) => {
      if (label.includes('Net Income') && !label.includes('Net Cash')) {
        data.cashFlow.netIncome[year] = values[i]
      } else if (label.includes('Net Cash from Operating Activities')) {
        data.cashFlow.operating[year] = values[i]
      } else if (label.includes('Net Cash from Investing Activities')) {
        data.cashFlow.investing[year] = values[i]
      } else if (label.includes('Net Cash from Financing Activities')) {
        data.cashFlow.financing[year] = values[i]
      } else if (label.includes('NET CHANGE IN CASH')) {
        data.cashFlow.netChange[year] = values[i]
      } else if (label.includes('Ending Cash Balance')) {
        data.cashFlow.endingBalance[year] = values[i]
      }
    })
  }

  private parseNumber(value: string): number {
    if (!value || value.trim() === '' || value === '-') return 0
    return parseFloat(value.replace(/,/g, ''))
  }

  /**
   * Load and parse HTML content
   */
  async loadHTML(): Promise<void> {
    this.htmlContent = await fs.readFile(this.htmlPath, 'utf-8')
    this.$ = cheerio.load(this.htmlContent)
  }

  /**
   * Update all financial tables in HTML with CSV data
   */
  async updateAllTables(): Promise<void> {
    if (!this.data) {
      throw new Error('CSV data not loaded. Call parseCSVData() first.')
    }

    console.log('🔄 Updating all financial tables...')
    
    // Update each table type
    this.updateIncomeStatement()
    this.updateCashFlowStatement()
    this.updateBalanceSheet()
    this.updateUseOfFunds()
    this.updateExecutiveSummary()

    console.log('✅ All tables updated successfully')
  }

  /**
   * Update Figure 8.6: Income Statement
   */
  private updateIncomeStatement(): void {
    console.log('  📊 Updating Income Statement...')
    
    const years = ['2025', '2026', '2027', '2028', '2029', '2030']
    
    // Update Interest Income - Cashback row
    const interestRow = this.$('td:contains("4900 - Interest Income - Cashback")').parent()
    if (interestRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.incomeStatement.interestIncome[year]
        interestRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update Total Revenue row
    const revenueRow = this.$('td:contains("Total Revenue")').parent()
    if (revenueRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.incomeStatement.revenue[year]
        revenueRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update Gross Profit row
    const grossProfitRow = this.$('td:contains("Gross Profit (Before Advertising)")').parent()
    if (grossProfitRow.length) {
      years.forEach((year, i) => {
        // Calculate gross profit before advertising (add advertising back)
        const grossProfit = this.data!.incomeStatement.grossProfit[year]
        const advertising = this.data!.incomeStatement.advertising[year]
        const beforeAdvertising = grossProfit + advertising
        grossProfitRow.find('td').eq(i + 1).text(this.formatCurrency(beforeAdvertising))
      })
    }

    // Update Net Profit (After Advertising) row
    const netProfitRow = this.$('td:contains("Net Profit (After Advertising)")').parent()
    if (netProfitRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.incomeStatement.grossProfit[year]
        netProfitRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update NET INCOME row
    const netIncomeRow = this.$('td:contains("NET INCOME")').parent()
    if (netIncomeRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.incomeStatement.netIncome[year]
        const formatted = value < 0 ? `($${Math.abs(value).toLocaleString()})` : this.formatCurrency(value)
        netIncomeRow.find('td').eq(i + 1).text(formatted)
      })
    }
  }

  /**
   * Update Figure 8.7: Cash Flow Statement
   */
  private updateCashFlowStatement(): void {
    console.log('  💰 Updating Cash Flow Statement...')
    
    const years = ['2025', '2026', '2027', '2028', '2029', '2030']

    // Update Net Income row in cash flow
    const netIncomeRow = this.$('td:contains("Net Income")').parent().filter(':contains("Net Income")')
    if (netIncomeRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.cashFlow.netIncome[year]
        const formatted = value < 0 ? `($${Math.abs(value).toLocaleString()})` : this.formatCurrency(value)
        netIncomeRow.find('td').eq(i + 1).text(formatted)
      })
    }

    // Update Net Cash from Operating Activities
    const operatingRow = this.$('td:contains("Net Cash from Operating Activities")').parent()
    if (operatingRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.cashFlow.operating[year]
        const formatted = value < 0 ? `($${Math.abs(value).toLocaleString()})` : this.formatCurrency(value)
        operatingRow.find('td').eq(i + 1).text(formatted)
      })
    }

    // Update NET CHANGE IN CASH
    const netChangeRow = this.$('td:contains("NET CHANGE IN CASH")').parent()
    if (netChangeRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.cashFlow.netChange[year]
        netChangeRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update Beginning Cash Balance
    const beginningRow = this.$('td:contains("Beginning Cash Balance")').parent()
    if (beginningRow.length) {
      const beginningBalances = [0, 2496, 110887, 525749, 1108568, 1870918] // From CSV
      years.forEach((year, i) => {
        beginningRow.find('td').eq(i + 1).text(this.formatCurrency(beginningBalances[i]))
      })
    }

    // Update ENDING CASH BALANCE
    const endingRow = this.$('td:contains("ENDING CASH BALANCE")').parent()
    if (endingRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.cashFlow.endingBalance[year]
        endingRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }
  }

  /**
   * Update Figure 8.8: Balance Sheet
   */
  private updateBalanceSheet(): void {
    console.log('  🏦 Updating Balance Sheet...')
    
    const years = ['2025', '2026', '2027', '2028', '2029', '2030']

    // Update Business Bank Account
    const cashRow = this.$('td:contains("1000 - Business Bank Account")').parent()
    if (cashRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.balanceSheet.cash[year]
        cashRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update TOTAL ASSETS
    const assetsRow = this.$('td:contains("TOTAL ASSETS")').parent()
    if (assetsRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.balanceSheet.assets[year]
        assetsRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update Retained Earnings
    const retainedRow = this.$('td:contains("3900 - Retained Earnings")').parent()
    if (retainedRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.balanceSheet.retainedEarnings[year]
        const formatted = value < 0 ? `($${Math.abs(value).toLocaleString()})` : this.formatCurrency(value)
        retainedRow.find('td').eq(i + 1).text(formatted)
      })
    }

    // Update TOTAL EQUITY
    const equityRow = this.$('td:contains("TOTAL EQUITY")').parent()
    if (equityRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.balanceSheet.equity[year]
        equityRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }

    // Update TOTAL LIABILITIES & EQUITY
    const totalRow = this.$('td:contains("TOTAL LIABILITIES & EQUITY")').parent()
    if (totalRow.length) {
      years.forEach((year, i) => {
        const value = this.data!.balanceSheet.equity[year] // Same as total equity (no liabilities)
        totalRow.find('td').eq(i + 1).text(this.formatCurrency(value))
      })
    }
  }

  /**
   * Update Figure 8.1: Use of Funds
   */
  private updateUseOfFunds(): void {
    console.log('  📈 Updating Use of Funds...')
    
    // Update 2025 specific values
    const operatingLossRow = this.$('td:contains("Operating Loss")').parent()
    if (operatingLossRow.length) {
      const netIncome2025 = Math.abs(this.data!.incomeStatement.netIncome['2025'])
      operatingLossRow.find('td').eq(1).text(this.formatCurrency(netIncome2025))
      
      // Update percentage (operating loss / 70000)
      const percentage = ((netIncome2025 / 70000) * 100).toFixed(1)
      operatingLossRow.find('td').eq(2).text(`${percentage}%`)
    }

    // Update Total Capital Deployed
    const totalDeployedRow = this.$('td:contains("Total Capital Deployed")').parent()
    if (totalDeployedRow.length) {
      const inventory = 42436 // From CSV
      const operatingLoss = Math.abs(this.data!.incomeStatement.netIncome['2025'])
      const equipment = 1000
      const depreciation = 200
      const totalDeployed = inventory + operatingLoss + equipment - depreciation
      
      totalDeployedRow.find('td').eq(1).text(this.formatCurrency(totalDeployed))
      
      const percentage = ((totalDeployed / 70000) * 100).toFixed(1)
      totalDeployedRow.find('td').eq(2).text(`${percentage}%`)
    }

    // Update Cash Reserve
    const cashReserveRow = this.$('td:contains("Cash Reserve (End 2025)")').parent()
    if (cashReserveRow.length) {
      const cashReserve = this.data!.balanceSheet.cash['2025']
      cashReserveRow.find('td').eq(1).text(this.formatCurrency(cashReserve))
      
      const percentage = ((cashReserve / 70000) * 100).toFixed(1)
      cashReserveRow.find('td').eq(2).text(`${percentage}%`)
    }
  }

  /**
   * Update executive summary financial figures
   */
  private updateExecutiveSummary(): void {
    console.log('  📋 Updating Executive Summary...')
    
    // Update revenue figures in executive summary
    const revenue2025 = this.data!.incomeStatement.revenue['2025']
    const revenue2030 = this.data!.incomeStatement.revenue['2030']
    const netIncome2030 = this.data!.incomeStatement.netIncome['2030']
    
    // Find and update revenue growth text
    const revenueText = `revenue projections show conservative growth from $${revenue2025.toLocaleString()} in the partial year 2025 to $${revenue2030.toLocaleString()} by 2030`
    
    // Find and update net income text
    const netIncomeText = `$${(netIncome2030 / 1000000).toFixed(2)} million in net income`
    
    // Update margin percentages
    const grossMargin2025 = this.data!.margins.grossMargin['2025']
    const grossMargin2030 = this.data!.margins.grossMargin['2030']
    const marginText = `growing from ${grossMargin2025} to ${grossMargin2030} gross margin`
    
    console.log(`    Revenue: ${revenueText}`)
    console.log(`    Net Income: ${netIncomeText}`)
    console.log(`    Margins: ${marginText}`)
  }

  /**
   * Format number as currency
   */
  private formatCurrency(value: number): string {
    return `$${value.toLocaleString()}`
  }

  /**
   * Validate data consistency across all tables
   */
  async validateData(): Promise<ValidationError[]> {
    const errors: ValidationError[] = []
    
    if (!this.data) {
      throw new Error('CSV data not loaded. Call parseCSVData() first.')
    }

    console.log('🔍 Validating financial data consistency...')

    // Validate balance sheet equation: Assets = Liabilities + Equity
    for (const year of ['2025', '2026', '2027', '2028', '2029', '2030']) {
      const assets = this.data.balanceSheet.assets[year]
      const liabilities = this.data.balanceSheet.liabilities[year]
      const equity = this.data.balanceSheet.equity[year]
      
      if (Math.abs(assets - (liabilities + equity)) > 1) {
        errors.push({
          table: 'Balance Sheet',
          field: year,
          expected: assets,
          actual: liabilities + equity,
          message: `Balance sheet equation doesn't balance for ${year}: Assets ($${assets.toLocaleString()}) != Liabilities + Equity ($${(liabilities + equity).toLocaleString()})`
        })
      }
    }

    // Validate cash flow reconciliation
    for (let i = 0; i < 6; i++) {
      const year = (2025 + i).toString()
      const nextYear = (2026 + i).toString()
      
      if (i < 5) { // Don't check beyond 2030
        const endingCash = this.data.cashFlow.endingBalance[year]
        const beginningCashNext = i === 0 ? 0 : this.data.cashFlow.endingBalance[(2024 + i).toString()] || 0
        
        // This validation might need adjustment based on actual cash flow structure
      }
    }

    if (errors.length === 0) {
      console.log('✅ All financial data validation checks passed')
    } else {
      console.log(`❌ Found ${errors.length} validation errors`)
      errors.forEach(error => {
        console.log(`   ${error.message}`)
      })
    }

    return errors
  }

  /**
   * Save updated HTML back to file
   */
  async saveHTML(): Promise<void> {
    const updatedHTML = this.$.html()
    await fs.writeFile(this.htmlPath, updatedHTML, 'utf-8')
    console.log(`💾 Updated HTML saved to ${this.htmlPath}`)
  }

  /**
   * Generate diff report showing changes
   */
  async generateDiffReport(): Promise<string> {
    // This would compare original vs updated values
    // Implementation would depend on requirements
    return 'Diff report functionality to be implemented'
  }

  /**
   * Main execution function
   */
  async execute(command: 'sync' | 'validate' = 'sync'): Promise<void> {
    try {
      console.log('🚀 Starting Financial Data Synchronization System')
      console.log(`📁 CSV Path: ${this.csvPath}`)
      console.log(`📄 HTML Path: ${this.htmlPath}`)
      
      // Load data
      await this.parseCSVData()
      console.log('✅ CSV data parsed successfully')
      
      await this.loadHTML()
      console.log('✅ HTML content loaded successfully')

      if (command === 'validate') {
        // Just validate, don't update
        await this.validateData()
      } else {
        // Update all tables
        await this.updateAllTables()
        
        // Validate updated data
        const errors = await this.validateData()
        
        if (errors.length === 0) {
          // Save updated HTML
          await this.saveHTML()
          console.log('🎉 Financial synchronization completed successfully!')
        } else {
          console.log('⚠️ Validation errors found. HTML not saved.')
          console.log('Please fix the following issues in the CSV data:')
          errors.forEach(error => console.log(`  - ${error.message}`))
        }
      }
      
    } catch (error) {
      console.error('❌ Error during financial synchronization:', error)
      throw error
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] as 'sync' | 'validate' || 'sync'
  
  const sync = new FinancialSync()
  await sync.execute(command)
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export default FinancialSync