// src/lib/scheduledEventsIntegration.ts

import { 
  ScheduledEventManager, 
  PurchaseOrder,
  scheduleSupplierPayments,
  scheduleQuarterlyTaxPayment,
  scheduleMonthlyExpenses
} from './scheduledEvents';
import { 
  Assumptions, 
  MonthlyData,
  SupplierPaymentTerm 
} from '../types/financial';

/**
 * Integration layer between scheduled events and the finance engine
 */
export class ScheduledEventsFinanceIntegration {
  private eventManager: ScheduledEventManager;
  private assumptions: Assumptions;

  constructor(assumptions: Assumptions) {
    this.eventManager = new ScheduledEventManager();
    this.assumptions = assumptions;
    this.initializeRecurringExpenses();
  }

  /**
   * Initialize all recurring monthly expenses based on assumptions
   */
  private initializeRecurringExpenses(): void {
    const startDate = new Date(this.assumptions.modelStartDate);

    const monthlyExpenses = [
      {
        description: 'Office Rent',
        amount: this.assumptions.officeRentMonthly,
        startDate,
        account: 'rent_expense'
      },
      {
        description: 'Utilities',
        amount: this.assumptions.utilitiesMonthly,
        startDate,
        account: 'utilities_expense'
      },
      {
        description: 'QuickBooks Subscription',
        amount: this.assumptions.quickbooksMonthly,
        startDate,
        account: 'software_expense'
      },
      {
        description: 'Google Workspace',
        amount: this.assumptions.googleWorkspaceMonthly,
        startDate,
        account: 'software_expense'
      },
      {
        description: 'Claude AI Subscription',
        amount: this.assumptions.claudeAiMonthly,
        startDate,
        account: 'software_expense'
      },
      {
        description: 'Accounting Services',
        amount: this.assumptions.accountingFeesMonthly,
        startDate,
        account: 'professional_fees'
      },
      {
        description: 'Office Supplies',
        amount: this.assumptions.officeSuppliesMonthly,
        startDate,
        account: 'office_supplies'
      }
    ];

    scheduleMonthlyExpenses(this.eventManager, monthlyExpenses);

    // Schedule annual insurance
    const insuranceDate = new Date(startDate);
    insuranceDate.setMonth(insuranceDate.getMonth() + 1); // Start one month after model start
    
    this.eventManager.addEvent({
      date: insuranceDate,
      amount: this.assumptions.liabilityInsuranceAnnual,
      description: 'Annual Liability Insurance',
      category: 'other',
      isRecurring: true,
      recurringFrequency: 'annually',
      account: 'insurance_expense'
    });

    // Schedule one-time capital expenditures
    if (this.assumptions.trademarkCost > 0) {
      this.eventManager.addEvent({
        date: new Date(this.assumptions.trademarkDate),
        amount: this.assumptions.trademarkCost,
        description: 'Trademark Registration',
        category: 'capital_expenditure',
        isRecurring: false,
        account: 'intangible_assets'
      });
    }

    if (this.assumptions.grsRegistration > 0) {
      const grsDate = new Date(startDate);
      grsDate.setMonth(grsDate.getMonth() + 2); // 2 months after start
      
      this.eventManager.addEvent({
        date: grsDate,
        amount: this.assumptions.grsRegistration,
        description: 'GRS Registration',
        category: 'capital_expenditure',
        isRecurring: false,
        account: 'intangible_assets'
      });
    }
  }

  /**
   * Create a purchase order and schedule its payments
   */
  public createPurchaseOrder(
    poNumber: string,
    supplierName: string,
    totalAmount: number,
    orderDate: Date,
    includeFreightAndTariff: boolean = true
  ): void {
    const expectedDeliveryDate = new Date(orderDate);
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + this.assumptions.leadTimeDays);

    const po: PurchaseOrder = {
      poNumber,
      supplierName,
      totalAmount,
      orderDate,
      expectedDeliveryDate,
      freightCost: includeFreightAndTariff ? this.assumptions.lclShipmentCost : 0,
      tariffAmount: includeFreightAndTariff ? totalAmount * this.assumptions.tariffRate : 0,
      paymentTerms: this.assumptions.supplierPaymentTerms
    };

    scheduleSupplierPayments(this.eventManager, po);
  }

  /**
   * Schedule quarterly tax payments based on projected income
   */
  public scheduleQuarterlyTaxes(year: number, quarterlyIncome: number[]): void {
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (quarterlyIncome[quarter - 1] > 0) {
        const taxAmount = quarterlyIncome[quarter - 1] * this.assumptions.corporateTaxRate;
        scheduleQuarterlyTaxPayment(this.eventManager, taxAmount, quarter, year);
      }
    }
  }

  /**
   * Schedule owner draws (distributions)
   */
  public scheduleOwnerDraw(date: Date, amount: number, description: string = 'Owner Draw'): void {
    this.eventManager.addEvent({
      date,
      amount,
      description,
      category: 'owner_draw',
      isRecurring: false,
      account: 'owner_draws'
    });
  }

  /**
   * Schedule recurring owner draws
   */
  public scheduleRecurringOwnerDraw(
    startDate: Date, 
    amount: number, 
    frequency: 'monthly' | 'quarterly' | 'annually'
  ): void {
    this.eventManager.addEvent({
      date: startDate,
      amount,
      description: `Recurring Owner Draw (${frequency})`,
      category: 'owner_draw',
      isRecurring: true,
      recurringFrequency: frequency,
      account: 'owner_draws'
    });
  }

  /**
   * Get cash requirements for a specific month
   */
  public getMonthCashRequirements(year: number, month: number): {
    totalOutflows: number;
    byCategory: Record<string, number>;
    events: Array<{ date: Date; description: string; amount: number; category: string }>;
  } {
    const events = this.eventManager.processEventsForMonth(year, month);
    const byCategory = this.eventManager.getCashImpactByCategory(year, month);
    const totalOutflows = Math.abs(this.eventManager.getCashImpactForMonth(year, month));

    return {
      totalOutflows,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k, Math.abs(v)])
      ),
      events: events.map(e => ({
        date: e.date,
        description: e.description,
        amount: e.amount,
        category: e.category
      }))
    };
  }

  /**
   * Integrate scheduled cash events into monthly financial data
   */
  public applyScheduledEventsToMonth(monthlyData: MonthlyData, year: number, month: number): MonthlyData {
    const cashRequirements = this.getMonthCashRequirements(year, month);
    
    // Create a copy of the monthly data to avoid mutation
    const updatedData = { ...monthlyData };

    // Apply scheduled cash outflows
    const scheduledOutflows = cashRequirements.totalOutflows;
    
    // Update cash position
    updatedData.cash = (updatedData.cash || 0) - scheduledOutflows;
    
    // Update cash flow from operations
    updatedData.cashFromOperations = (updatedData.cashFromOperations || 0) - scheduledOutflows;
    
    // Update net cash flow
    updatedData.netCashFlow = (updatedData.netCashFlow || 0) - scheduledOutflows;

    // Track scheduled payments in accounts payable
    const supplierPayments = Math.abs(cashRequirements.byCategory.supplier_payment || 0);
    if (supplierPayments > 0) {
      updatedData.accountsPayable = Math.max(0, (updatedData.accountsPayable || 0) - supplierPayments);
    }

    // Track tax payments
    const taxPayments = Math.abs(cashRequirements.byCategory.tax_payment || 0);
    if (taxPayments > 0) {
      updatedData.accruedExpenses = Math.max(0, (updatedData.accruedExpenses || 0) - taxPayments);
    }

    return updatedData;
  }

  /**
   * Generate a cash flow forecast
   */
  public generateCashFlowForecast(startingCash: number, monthsAhead: number): Array<{
    year: number;
    month: number;
    beginningCash: number;
    scheduledOutflows: number;
    endingCash: number;
    minimumCashRequired: number;
    cashShortfall: number;
  }> {
    const forecast = this.eventManager.generateCashFlowForecast(startingCash, monthsAhead);
    
    // Add minimum cash requirements and shortfall analysis
    return forecast.map(month => {
      // Assume minimum cash is 1 month of operating expenses
      const minimumCashRequired = this.calculateMinimumCashRequired();
      const cashShortfall = Math.max(0, minimumCashRequired - month.endingCash);
      
      return {
        year: month.year,
        month: month.month,
        beginningCash: month.beginningCash,
        scheduledOutflows: month.cashOutflows,
        endingCash: month.endingCash,
        minimumCashRequired,
        cashShortfall
      };
    });
  }

  /**
   * Calculate minimum cash required (1 month of operating expenses)
   */
  private calculateMinimumCashRequired(): number {
    const monthlyExpenses = 
      this.assumptions.ownerSalary +
      this.assumptions.officeRentMonthly +
      this.assumptions.utilitiesMonthly +
      this.assumptions.quickbooksMonthly +
      this.assumptions.googleWorkspaceMonthly +
      this.assumptions.claudeAiMonthly +
      this.assumptions.accountingFeesMonthly +
      this.assumptions.officeSuppliesMonthly +
      (this.assumptions.liabilityInsuranceAnnual / 12);
    
    return monthlyExpenses * 1.5; // 1.5x for safety margin
  }

  /**
   * Get the event manager for direct access
   */
  public getEventManager(): ScheduledEventManager {
    return this.eventManager;
  }

  /**
   * Clear all events and reinitialize
   */
  public reset(): void {
    this.eventManager.clearEvents();
    this.initializeRecurringExpenses();
  }
}

/**
 * Factory function to create an integrated scheduled events manager
 */
export function createScheduledEventsIntegration(assumptions: Assumptions): ScheduledEventsFinanceIntegration {
  return new ScheduledEventsFinanceIntegration(assumptions);
}