/**
 * Type definitions for expense rules
 */

export interface ExpenseRuleContext {
  week: number
  year: number
  quarter: number
  strategyId: string
}

export interface GLEntry {
  date: string
  account: string
  accountCategory: string
  description: string
  debit: number
  credit: number
  reference: string
  source: string
  metadata?: Record<string, any>
}

export interface ExpenseRule {
  name: string
  account: string
  accountCategory: string
  description?: string
  calculate: (context: ExpenseRuleContext) => Promise<GLEntry[]>
}