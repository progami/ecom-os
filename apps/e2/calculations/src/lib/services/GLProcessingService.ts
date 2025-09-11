import { GeneralLedger } from '../engine/GeneralLedger'
import { Transaction } from '@/types/v4/financial'
import ProductService, { ProductMargin } from '@/services/database/ProductService'
import SystemConfigService from '@/services/database/SystemConfigService'
import logger from '@/utils/logger'

export interface RevenueData {
  [yearMonth: string]: {
    [sku: string]: number // units sold
  }
}

export interface ExpenseData {
  setup: {
    payroll: { [role: string]: number }
    rent: number
    advertising: number
    software: { [name: string]: number }
    insurance: number
    other?: { [category: string]: number }
  }
  inventory: Array<{
    yearMonth: string
    amount: number
    paymentSchedule: Array<{
      percentage: number
      monthsDelay: number
    }>
  }>
}

export interface FreightData {
  containerType: '20ft' | '40ft' | '40HQ'
  totalFreightCost: number
  containerCBM: number
}

export interface ProductPriceOverride {
  sku: string
  retailPrice?: number
  manufacturing?: number
  amazonReferralFee?: number
  fulfillmentFee?: number
}

export interface ProcessingResult {
  ledger: GeneralLedger
  transactions: Transaction[]
  summary: {
    totalRevenue: number
    totalCOGS: number
    totalOpEx: number
    netIncome: number
  }
}

export class GLProcessingService {
  private ledger: GeneralLedger
  private configService: SystemConfigService
  private systemDates: any
  private businessRules: any

  private constructor() {
    this.ledger = new GeneralLedger()
    this.configService = SystemConfigService.getInstance()
  }

  static async create(startingCash: number = 0, openingRetainedEarnings: number = 0): Promise<GLProcessingService> {
    const service = new GLProcessingService()
    await service.initialize(startingCash, openingRetainedEarnings)
    return service
  }

  private async initialize(startingCash: number = 0, openingRetainedEarnings: number = 0) {
    // Load config from database
    this.systemDates = await this.configService.getSystemDates()
    this.businessRules = await this.configService.getBusinessRules()

    // Initialize with starting cash if provided
    if (startingCash > 0) {
      this.ledger.addTransaction({
        date: new Date(this.systemDates.historicalDataStart),
        description: 'Initial Cash Investment',
        category: 'Initial Investment',
        account: 'Cash',
        debit: startingCash,
        credit: 0,
        ruleSource: 'Initial'
      })
      this.ledger.addTransaction({
        date: new Date(this.systemDates.historicalDataStart),
        description: 'Initial Cash Investment',
        category: 'Initial Investment',
        account: 'Equity',
        debit: 0,
        credit: startingCash,
        ruleSource: 'Initial'
      })
    }

    // Initialize retained earnings if provided
    if (openingRetainedEarnings !== 0) {
      if (openingRetainedEarnings < 0) {
        // Negative retained earnings (accumulated losses)
        this.ledger.addTransaction({
          date: new Date(this.systemDates.historicalDataStart),
          description: 'Opening Retained Earnings (Accumulated Losses)',
          category: 'Initial Investment',
          account: 'Equity',
          debit: Math.abs(openingRetainedEarnings),
          credit: 0,
          ruleSource: 'Initial'
        })
        this.ledger.addTransaction({
          date: new Date(this.systemDates.historicalDataStart),
          description: 'Opening Retained Earnings (Accumulated Losses)',
          category: 'Initial Investment',
          account: 'Equity',
          debit: 0,
          credit: Math.abs(openingRetainedEarnings),
          ruleSource: 'Initial'
        })
      } else {
        // Positive retained earnings
        this.ledger.addTransaction({
          date: new Date(this.systemDates.historicalDataStart),
          description: 'Opening Retained Earnings',
          category: 'Initial Investment',
          account: 'Equity',
          debit: 0,
          credit: openingRetainedEarnings,
          ruleSource: 'Initial'
        })
        this.ledger.addTransaction({
          date: new Date(this.systemDates.historicalDataStart),
          description: 'Opening Retained Earnings',
          category: 'Initial Investment',
          account: 'Equity',
          debit: openingRetainedEarnings,
          credit: 0,
          ruleSource: 'Initial'
        })
      }
    }
  }

  processMultiYearPlan(
    revenueData: RevenueData,
    expenseData: ExpenseData,
    freightData: FreightData,
    startYear: number = 2025,
    endYear: number = 2030,
    productPriceOverrides: ProductPriceOverride[] = []
  ): ProcessingResult {
    // Process each month in the planning period
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`
        const currentDate = new Date(year, month - 1, 1)
        
        // Process sales for this month
        this.processMonthlySales(yearMonth, currentDate, revenueData, freightData, productPriceOverrides)
        
        // Process expenses for this month
        this.processMonthlyExpenses(yearMonth, currentDate, expenseData)
        
        // Process inventory purchases
        this.processInventoryPurchases(yearMonth, currentDate, expenseData)
        
        // Process quarterly payroll tax payments
        if (month % 3 === 0) {
          this.processPayrollTaxPayment(currentDate)
        }
      }
    }

    // Validate the ledger is balanced
    const balanceCheck = this.ledger.validateBalance()
    if (!balanceCheck.isBalanced) {
      // Log imbalance details for debugging
      logger.error('GL IMBALANCE DETECTED:')
      logger.error(`Total Debits: ${balanceCheck.totalDebits.toFixed(2)}`)
      logger.error(`Total Credits: ${balanceCheck.totalCredits.toFixed(2)}`)
      logger.error(`Difference: ${balanceCheck.difference.toFixed(2)}`)
      
      const imbalanceBySource = this.ledger.getImbalanceByRuleSource()
      logger.error('\nImbalance by Rule Source:')
      Object.entries(imbalanceBySource).forEach(([source, data]) => {
        if (Math.abs(data.difference) > 0.01) {
          logger.error(`${source}: ${data.difference.toFixed(2)} (D: ${data.debits.toFixed(2)}, C: ${data.credits.toFixed(2)})`)
        }
      })
    }

    // Calculate summary
    const transactions = this.ledger.getTransactions()
    const summary = {
      totalRevenue: transactions
        .filter(t => t.account === 'SalesRevenue' && t.credit > 0)
        .reduce((sum, t) => sum + t.credit, 0),
      totalCOGS: transactions
        .filter(t => t.account === 'COGS' && t.debit > 0)
        .reduce((sum, t) => sum + t.debit, 0),
      totalOpEx: transactions
        .filter(t => t.account === 'OpEx' && t.debit > 0)
        .reduce((sum, t) => sum + t.debit, 0),
      netIncome: 0
    }
    
    // Net income is now correctly calculated as Net Revenue - COGS - OpEx
    summary.netIncome = summary.totalRevenue - summary.totalCOGS - summary.totalOpEx

    return {
      ledger: this.ledger,
      transactions,
      summary
    }
  }

  private processMonthlySales(
    yearMonth: string,
    currentDate: Date,
    revenueData: RevenueData,
    freightData: FreightData,
    productPriceOverrides: ProductPriceOverride[] = []
  ) {
    const monthData = revenueData[yearMonth]
    if (!monthData) return

    // Create a map of overrides for quick lookup
    const overrideMap = new Map(productPriceOverrides.map(o => [o.sku, o]))

    // Process each product sold this month
    Object.entries(monthData).forEach(([sku, units]) => {
      if (units <= 0) return
      
      const productService = ProductService.getInstance()
      const productMargins = productService.getProductMargins()
      const product = productMargins.find(p => p.sku === sku)
      if (!product) {
        console.warn(`Product ${sku} not found in margins data`)
        return
      }

      // Apply overrides if they exist
      const override = overrideMap.get(sku)
      const retailPrice = override?.retailPrice ?? product.retailPrice
      const manufacturing = override?.manufacturing ?? product.manufacturing
      const amazonReferralFee = override?.amazonReferralFee ?? product.amazonReferralFee
      const fulfillmentFee = override?.fulfillmentFee ?? product.fulfillmentFee

      const grossRevenue = units * retailPrice
      const cogs = units * manufacturing
      const freight = units * product.freight
      const tariffs = units * (manufacturing * (product.tariffRate / 100))
      const thirdPL = units * product.thirdPLStorage
      const amazonReferral = units * amazonReferralFee
      const fulfillmentFeeTotal = units * fulfillmentFee
      const refundAllowance = units * (retailPrice * this.businessRules.amazonReturnAllowance) // Return allowance from config
      const ppc = grossRevenue * this.businessRules.amazonReferralRate // Amazon referral fee rate
      
      // Calculate NET revenue (what Amazon actually pays us)
      const netRevenue = grossRevenue - amazonReferral - fulfillmentFeeTotal - refundAllowance - ppc
      
      // Revenue recognition - ONLY NET REVENUE
      this.ledger.addTransaction({
        date: currentDate,
        description: `Net Sales Revenue - ${product.name}`,
        category: 'Sales',
        account: 'AccountsReceivable',
        debit: netRevenue,
        credit: 0,
        ruleSource: 'Sales'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: `Net Sales Revenue - ${product.name}`,
        category: 'Sales',
        account: 'SalesRevenue',
        debit: 0,
        credit: netRevenue,
        ruleSource: 'Sales'
      })
      
      // COGS recognition
      const totalCogs = cogs + freight + tariffs + thirdPL
      this.ledger.addTransaction({
        date: currentDate,
        description: `COGS - ${product.name}`,
        category: 'COGS',
        account: 'COGS',
        debit: totalCogs,
        credit: 0,
        ruleSource: 'Sales'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: `COGS - ${product.name}`,
        category: 'COGS',
        account: 'Inventory',
        debit: 0,
        credit: totalCogs,
        ruleSource: 'Sales'
      })
      
      // Settlement from Amazon (14 days later)
      const settlementDate = new Date(currentDate)
      settlementDate.setDate(settlementDate.getDate() + 14)
      this.ledger.addTransaction({
        date: settlementDate,
        description: `Amazon Settlement - ${product.name}`,
        category: 'Settlement',
        account: 'Cash',
        debit: netRevenue,
        credit: 0,
        ruleSource: 'Settlement'
      })
      this.ledger.addTransaction({
        date: settlementDate,
        description: `Amazon Settlement - ${product.name}`,
        category: 'Settlement',
        account: 'AccountsReceivable',
        debit: 0,
        credit: netRevenue,
        ruleSource: 'Settlement'
      })
    })
  }

  private processMonthlyExpenses(
    yearMonth: string,
    currentDate: Date,
    expenseData: ExpenseData
  ) {
    const { setup } = expenseData
    
    // Payroll expenses
    const payrollTotal = Object.values(setup.payroll).reduce((sum, amount) => sum + amount, 0)
    if (payrollTotal > 0) {
      // Payroll expense
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Monthly Payroll',
        category: 'Payroll',
        account: 'OpEx',
        debit: payrollTotal,
        credit: 0,
        ruleSource: 'OpEx'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Monthly Payroll',
        category: 'Payroll',
        account: 'Cash',
        debit: 0,
        credit: payrollTotal,
        ruleSource: 'OpEx'
      })

      // Payroll tax from config
      const payrollTax = payrollTotal * this.businessRules.payrollTaxRate
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Payroll Tax',
        category: 'Tax',
        account: 'OpEx',
        debit: payrollTax,
        credit: 0,
        ruleSource: 'PayrollTax'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Payroll Tax',
        category: 'Tax',
        account: 'PayrollTaxPayable',
        debit: 0,
        credit: payrollTax,
        ruleSource: 'PayrollTax'
      })
    }

    // Rent
    if (setup.rent > 0) {
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Office Rent',
        category: 'Rent',
        account: 'OpEx',
        debit: setup.rent,
        credit: 0,
        ruleSource: 'OpEx'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Office Rent',
        category: 'Rent',
        account: 'Cash',
        debit: 0,
        credit: setup.rent,
        ruleSource: 'OpEx'
      })
    }

    // Advertising
    if (setup.advertising > 0) {
      this.ledger.addTransaction({
        date: currentDate,
        description: 'PPC Advertising',
        category: 'Marketing',
        account: 'OpEx',
        debit: setup.advertising,
        credit: 0,
        ruleSource: 'OpEx'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'PPC Advertising',
        category: 'Marketing',
        account: 'Cash',
        debit: 0,
        credit: setup.advertising,
        ruleSource: 'OpEx'
      })
    }

    // Software subscriptions
    const softwareTotal = Object.values(setup.software).reduce((sum, amount) => sum + amount, 0)
    if (softwareTotal > 0) {
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Software Subscriptions',
        category: 'Software',
        account: 'OpEx',
        debit: softwareTotal,
        credit: 0,
        ruleSource: 'OpEx'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Software Subscriptions',
        category: 'Software',
        account: 'Cash',
        debit: 0,
        credit: softwareTotal,
        ruleSource: 'OpEx'
      })
    }

    // Insurance
    if (setup.insurance > 0) {
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Business Insurance',
        category: 'Insurance',
        account: 'OpEx',
        debit: setup.insurance,
        credit: 0,
        ruleSource: 'OpEx'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Business Insurance',
        category: 'Insurance',
        account: 'Cash',
        debit: 0,
        credit: setup.insurance,
        ruleSource: 'OpEx'
      })
    }
    
    // Other custom expenses
    if (setup.other) {
      Object.entries(setup.other).forEach(([category, amount]) => {
        if (amount > 0) {
          this.ledger.addTransaction({
            date: currentDate,
            description: category,
            category: 'Other',
            account: 'OpEx',
            debit: amount,
            credit: 0,
            ruleSource: 'OpEx'
          })
          this.ledger.addTransaction({
            date: currentDate,
            description: category,
            category: 'Other',
            account: 'Cash',
            debit: 0,
            credit: amount,
            ruleSource: 'OpEx'
          })
        }
      })
    }
  }

  private processInventoryPurchases(
    yearMonth: string,
    currentDate: Date,
    expenseData: ExpenseData
  ) {
    // First, record new inventory purchases
    expenseData.inventory.forEach(purchase => {
      if (purchase.yearMonth === yearMonth) {
        // Record the full inventory purchase with accounts payable
        this.ledger.addTransaction({
          date: currentDate,
          description: `Inventory Purchase Order`,
          category: 'Inventory Purchase',
          account: 'Inventory',
          debit: purchase.amount,
          credit: 0,
          ruleSource: 'Inventory'
        })
        this.ledger.addTransaction({
          date: currentDate,
          description: `Inventory Purchase Order`,
          category: 'Inventory Purchase',
          account: 'AccountsPayable',
          debit: 0,
          credit: purchase.amount,
          ruleSource: 'Inventory'
        })
      }
    })

    // Then, process payments according to payment schedules
    expenseData.inventory.forEach(purchase => {
      purchase.paymentSchedule.forEach(schedule => {
        const purchaseDate = new Date(purchase.yearMonth + '-01')
        const paymentDate = new Date(purchaseDate)
        paymentDate.setMonth(paymentDate.getMonth() + schedule.monthsDelay)
        
        const paymentYearMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`
        
        if (paymentYearMonth === yearMonth) {
          const paymentAmount = purchase.amount * (schedule.percentage / 100)
          
          // Pay down accounts payable
          this.ledger.addTransaction({
            date: currentDate,
            description: `Inventory Payment - ${schedule.percentage}% of order`,
            category: 'Inventory Purchase',
            account: 'AccountsPayable',
            debit: paymentAmount,
            credit: 0,
            ruleSource: 'Inventory'
          })
          this.ledger.addTransaction({
            date: currentDate,
            description: `Inventory Payment - ${schedule.percentage}% of order`,
            category: 'Inventory Purchase',
            account: 'Cash',
            debit: 0,
            credit: paymentAmount,
            ruleSource: 'Inventory'
          })
        }
      })
    })
  }

  private processPayrollTaxPayment(currentDate: Date) {
    // Get the current payroll tax liability
    const payrollTaxBalance = this.ledger.getAccountBalance('PayrollTaxPayable', currentDate)
    
    if (payrollTaxBalance > 0) {
      // Pay the quarterly payroll tax
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Quarterly Payroll Tax Payment',
        category: 'Tax Payment',
        account: 'PayrollTaxPayable',
        debit: payrollTaxBalance,
        credit: 0,
        ruleSource: 'PayrollTax'
      })
      this.ledger.addTransaction({
        date: currentDate,
        description: 'Quarterly Payroll Tax Payment',
        category: 'Tax Payment',
        account: 'Cash',
        debit: 0,
        credit: payrollTaxBalance,
        ruleSource: 'PayrollTax'
      })
    }
  }
}