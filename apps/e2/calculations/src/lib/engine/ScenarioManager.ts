import { UserInputs, FinancialStatements } from '@/types/v4/financial'
import { FinancialModelEngine } from './FinancialModelEngine'
import { BalanceSheetSnapshot } from '../rules/BalanceSheetRule'
import logger from '@/utils/logger'

export interface Scenario {
  id: string
  name: string
  description: string
  inputs: UserInputs
  results?: ScenarioResults
  createdAt: Date
  updatedAt: Date
  tags: string[]
}

export interface ScenarioResults {
  financialStatements: FinancialStatements
  balanceSheetSnapshots: BalanceSheetSnapshot[]
  keyMetrics: KeyMetrics
  executionTime: number
}

export interface KeyMetrics {
  totalRevenue: number
  totalProfit: number
  profitMargin: number
  cashRunway: number
  roi: number
  breakEvenMonth: number | null
  peakCashRequirement: number
  irr: number
}

export interface ComparisonResult {
  baseScenario: Scenario
  compareScenario: Scenario
  differences: {
    revenue: { amount: number; percentage: number }
    profit: { amount: number; percentage: number }
    cashFlow: { amount: number; percentage: number }
    roi: { amount: number; percentage: number }
    breakEvenMonth: { months: number }
  }
}

export class ScenarioManager {
  private scenarios: Map<string, Scenario> = new Map()
  private activeScenarioId: string | null = null
  
  constructor() {}
  
  /**
   * Create a new scenario
   */
  createScenario(name: string, description: string, inputs: UserInputs, tags: string[] = []): Scenario {
    const scenario: Scenario = {
      id: `scenario_${Date.now()}`,
      name,
      description,
      inputs,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags
    }
    
    this.scenarios.set(scenario.id, scenario)
    return scenario
  }
  
  /**
   * Clone an existing scenario
   */
  cloneScenario(scenarioId: string, newName: string): Scenario | null {
    const original = this.scenarios.get(scenarioId)
    if (!original) return null
    
    const cloned = this.createScenario(
      newName,
      `Cloned from ${original.name}`,
      JSON.parse(JSON.stringify(original.inputs)), // Deep clone
      [...original.tags, 'cloned']
    )
    
    return cloned
  }
  
  /**
   * Update scenario inputs
   */
  updateScenario(scenarioId: string, inputs: Partial<UserInputs>): boolean {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) return false
    
    scenario.inputs = { ...scenario.inputs, ...inputs }
    scenario.updatedAt = new Date()
    scenario.results = undefined // Clear results as inputs changed
    
    return true
  }
  
  /**
   * Execute a scenario and store results
   */
  executeScenario(scenarioId: string): ScenarioResults | null {
    const scenario = this.scenarios.get(scenarioId)
    if (!scenario) return null
    
    const startTime = Date.now()
    
    // Create engine and run forecast
    const engine = new FinancialModelEngine(scenario.inputs)
    const financialStatements = engine.runForecast()
    
    // Get balance sheet snapshots
    const balanceSheetRule = engine.getBalanceSheetRule()
    const balanceSheetSnapshots = balanceSheetRule.getAllSnapshots()
    
    // Calculate key metrics
    const keyMetrics = this.calculateKeyMetrics(financialStatements, balanceSheetSnapshots)
    
    const results: ScenarioResults = {
      financialStatements,
      balanceSheetSnapshots,
      keyMetrics,
      executionTime: Date.now() - startTime
    }
    
    scenario.results = results
    scenario.updatedAt = new Date()
    
    return results
  }
  
  /**
   * Execute multiple scenarios in parallel
   */
  async executeMultipleScenarios(scenarioIds: string[]): Promise<Map<string, ScenarioResults>> {
    const results = new Map<string, ScenarioResults>()
    
    const promises = scenarioIds.map(async (id) => {
      const result = this.executeScenario(id)
      if (result) {
        results.set(id, result)
      }
    })
    
    await Promise.all(promises)
    return results
  }
  
  /**
   * Calculate key metrics from financial statements
   */
  private calculateKeyMetrics(
    statements: FinancialStatements, 
    balanceSheets: BalanceSheetSnapshot[]
  ): KeyMetrics {
    // Total revenue across all months
    const totalRevenue = statements.monthlySummaries.reduce((sum, month) => sum + month.revenue, 0)
    
    // Total profit
    const totalProfit = statements.monthlySummaries.reduce((sum, month) => sum + month.netIncome, 0)
    
    // Profit margin
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    
    // Cash runway (months until cash runs out)
    const lastMonth = statements.monthlySummaries[statements.monthlySummaries.length - 1]
    const monthlyBurnRate = lastMonth.operatingExpenses + lastMonth.cogs - lastMonth.revenue
    const currentCash = balanceSheets.length > 0 
      ? balanceSheets[balanceSheets.length - 1].accounts.cash 
      : 0
    const cashRunway = monthlyBurnRate < 0 ? currentCash / Math.abs(monthlyBurnRate) : Infinity
    
    // ROI calculation
    // Use the initial cash balance as investment amount
    const totalInvestment = balanceSheets.length > 0 && balanceSheets[0].accounts.cash > 0
      ? balanceSheets[0].accounts.cash
      : 50000 // Default if no balance sheet data
    const roi = totalInvestment > 0 ? ((totalProfit / totalInvestment) * 100) : 0
    
    // Break-even month
    let cumulativeProfit = 0
    let breakEvenMonth: number | null = null
    for (let i = 0; i < statements.monthlySummaries.length; i++) {
      cumulativeProfit += statements.monthlySummaries[i].netIncome
      if (cumulativeProfit > 0 && breakEvenMonth === null) {
        breakEvenMonth = i + 1
        break
      }
    }
    
    // Peak cash requirement (most negative cash balance)
    const cashBalances = balanceSheets.map(bs => bs.accounts.cash)
    const peakCashRequirement = Math.abs(Math.min(...cashBalances, 0))
    
    // Simple IRR calculation (approximation)
    const irr = this.calculateIRR(statements, totalInvestment)
    
    return {
      totalRevenue,
      totalProfit,
      profitMargin,
      cashRunway,
      roi,
      breakEvenMonth,
      peakCashRequirement,
      irr
    }
  }
  
  /**
   * Calculate Internal Rate of Return (simplified)
   */
  private calculateIRR(statements: FinancialStatements, initialInvestment: number): number {
    // Simplified IRR calculation using Newton's method
    // This is an approximation suitable for scenario comparison
    
    const cashFlows: number[] = [-initialInvestment]
    statements.monthlySummaries.forEach(month => {
      cashFlows.push(month.netIncome)
    })
    
    // Newton's method for IRR
    let rate = 0.1 // Initial guess 10%
    const maxIterations = 100
    const tolerance = 0.0001
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0
      let dnpv = 0
      
      for (let j = 0; j < cashFlows.length; j++) {
        const factor = Math.pow(1 + rate, j)
        npv += cashFlows[j] / factor
        dnpv -= j * cashFlows[j] / (factor * (1 + rate))
      }
      
      const newRate = rate - npv / dnpv
      
      if (Math.abs(newRate - rate) < tolerance) {
        return newRate * 100 // Convert to percentage
      }
      
      rate = newRate
    }
    
    return rate * 100
  }
  
  /**
   * Compare two scenarios
   */
  compareScenarios(baseId: string, compareId: string): ComparisonResult | null {
    const baseScenario = this.scenarios.get(baseId)
    const compareScenario = this.scenarios.get(compareId)
    
    if (!baseScenario?.results || !compareScenario?.results) {
      return null
    }
    
    const base = baseScenario.results.keyMetrics
    const compare = compareScenario.results.keyMetrics
    
    return {
      baseScenario,
      compareScenario,
      differences: {
        revenue: {
          amount: compare.totalRevenue - base.totalRevenue,
          percentage: base.totalRevenue > 0 
            ? ((compare.totalRevenue - base.totalRevenue) / base.totalRevenue) * 100 
            : 0
        },
        profit: {
          amount: compare.totalProfit - base.totalProfit,
          percentage: base.totalProfit !== 0 
            ? ((compare.totalProfit - base.totalProfit) / Math.abs(base.totalProfit)) * 100 
            : 0
        },
        cashFlow: {
          amount: compare.peakCashRequirement - base.peakCashRequirement,
          percentage: base.peakCashRequirement > 0 
            ? ((compare.peakCashRequirement - base.peakCashRequirement) / base.peakCashRequirement) * 100 
            : 0
        },
        roi: {
          amount: compare.roi - base.roi,
          percentage: base.roi !== 0 
            ? ((compare.roi - base.roi) / Math.abs(base.roi)) * 100 
            : 0
        },
        breakEvenMonth: {
          months: (compare.breakEvenMonth || 60) - (base.breakEvenMonth || 60)
        }
      }
    }
  }
  
  /**
   * Get all scenarios
   */
  getAllScenarios(): Scenario[] {
    return Array.from(this.scenarios.values())
  }
  
  /**
   * Get scenario by ID
   */
  getScenario(id: string): Scenario | null {
    return this.scenarios.get(id) || null
  }
  
  /**
   * Delete a scenario
   */
  deleteScenario(id: string): boolean {
    return this.scenarios.delete(id)
  }
  
  /**
   * Set active scenario
   */
  setActiveScenario(id: string): boolean {
    if (this.scenarios.has(id)) {
      this.activeScenarioId = id
      return true
    }
    return false
  }
  
  /**
   * Get active scenario
   */
  getActiveScenario(): Scenario | null {
    return this.activeScenarioId ? this.scenarios.get(this.activeScenarioId) || null : null
  }
  
  /**
   * Export scenarios to JSON
   */
  exportScenarios(ids?: string[]): string {
    const scenariosToExport = ids 
      ? ids.map(id => this.scenarios.get(id)).filter(Boolean) as Scenario[]
      : this.getAllScenarios()
      
    return JSON.stringify(scenariosToExport, null, 2)
  }
  
  /**
   * Import scenarios from JSON
   */
  importScenarios(json: string): number {
    try {
      const scenarios = JSON.parse(json) as Scenario[]
      let imported = 0
      
      for (const scenario of scenarios) {
        // Generate new ID to avoid conflicts
        scenario.id = `scenario_${Date.now()}_${imported}`
        scenario.createdAt = new Date(scenario.createdAt)
        scenario.updatedAt = new Date(scenario.updatedAt)
        this.scenarios.set(scenario.id, scenario)
        imported++
      }
      
      return imported
    } catch (error) {
      logger.error('Error importing scenarios:', error)
      return 0
    }
  }
}