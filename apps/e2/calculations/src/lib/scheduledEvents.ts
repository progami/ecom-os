// src/lib/scheduledEvents.ts

import { SupplierPaymentTerm } from '../types/financial';

// Define the scheduled cash event interface
export interface ScheduledCashEvent {
  date: Date;
  amount: number;
  description: string;
  category: 'supplier_payment' | 'tax_payment' | 'capital_expenditure' | 'owner_draw' | 'investment' | 'other';
  isRecurring: boolean;
  recurringFrequency?: 'monthly' | 'quarterly' | 'annually';
  account?: string; // For GL integration
  referenceId?: string; // For linking to source documents (e.g., PO number)
}

// Purchase order interface for supplier payment scheduling
export interface PurchaseOrder {
  poNumber: string;
  supplierName: string;
  totalAmount: number;
  orderDate: Date;
  expectedDeliveryDate: Date;
  freightCost: number;
  tariffAmount: number;
  paymentTerms: SupplierPaymentTerm[];
}

// Month boundaries helper
interface MonthBoundary {
  start: Date;
  end: Date;
}

export class ScheduledEventManager {
  private events: ScheduledCashEvent[] = [];
  private eventIdCounter = 0;

  constructor() {
    this.events = [];
  }

  // Thread-safe event addition
  public addEvent(event: ScheduledCashEvent): void {
    // Create a deep copy to ensure immutability
    const newEvent = {
      ...event,
      date: new Date(event.date),
      referenceId: event.referenceId || `EVT-${++this.eventIdCounter}`
    };
    this.events.push(newEvent);
  }

  // Add multiple events at once
  public addEvents(events: ScheduledCashEvent[]): void {
    events.forEach(event => this.addEvent(event));
  }

  // Get all events
  public getAllEvents(): ScheduledCashEvent[] {
    return [...this.events]; // Return a copy to maintain immutability
  }

  // Clear all events
  public clearEvents(): void {
    this.events = [];
  }

  // Process events for a given month
  public processEventsForMonth(year: number, month: number): ScheduledCashEvent[] {
    const monthBoundary = this.getMonthBoundary(year, month);
    const processedEvents: ScheduledCashEvent[] = [];

    // Process one-time events
    const oneTimeEvents = this.events.filter(event => 
      !event.isRecurring && 
      event.date >= monthBoundary.start && 
      event.date <= monthBoundary.end
    );
    processedEvents.push(...oneTimeEvents);

    // Process recurring events
    const recurringEvents = this.events.filter(event => event.isRecurring);
    recurringEvents.forEach(event => {
      const eventInMonth = this.getRecurringEventForMonth(event, year, month);
      if (eventInMonth) {
        processedEvents.push(eventInMonth);
      }
    });

    return processedEvents;
  }

  // Get cash impact for a specific month
  public getCashImpactForMonth(year: number, month: number): number {
    const events = this.processEventsForMonth(year, month);
    return events.reduce((total, event) => {
      // Negative amounts represent cash outflows
      return total - event.amount;
    }, 0);
  }

  // Get cash impact by category for a month
  public getCashImpactByCategory(year: number, month: number): Record<string, number> {
    const events = this.processEventsForMonth(year, month);
    const impactByCategory: Record<string, number> = {};

    events.forEach(event => {
      if (!impactByCategory[event.category]) {
        impactByCategory[event.category] = 0;
      }
      impactByCategory[event.category] -= event.amount; // Negative for outflows
    });

    return impactByCategory;
  }

  // Helper function to get month boundaries
  private getMonthBoundary(year: number, month: number): MonthBoundary {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  // Helper to process recurring events
  private getRecurringEventForMonth(
    baseEvent: ScheduledCashEvent, 
    year: number, 
    month: number
  ): ScheduledCashEvent | null {
    const monthBoundary = this.getMonthBoundary(year, month);
    
    // Check if the base event date is after the requested month
    if (baseEvent.date > monthBoundary.end) {
      return null;
    }

    let eventDate: Date | null = null;

    switch (baseEvent.recurringFrequency) {
      case 'monthly':
        // Create event on the same day each month
        const dayOfMonth = baseEvent.date.getDate();
        eventDate = new Date(year, month - 1, Math.min(dayOfMonth, new Date(year, month, 0).getDate()));
        break;

      case 'quarterly':
        // Check if this month is a quarter month
        const baseMonth = baseEvent.date.getMonth();
        const targetMonth = month - 1; // Convert to 0-based
        if ((targetMonth - baseMonth) % 3 === 0 && targetMonth >= baseMonth) {
          const dayOfMonth = baseEvent.date.getDate();
          eventDate = new Date(year, month - 1, Math.min(dayOfMonth, new Date(year, month, 0).getDate()));
        }
        break;

      case 'annually':
        // Check if this is the anniversary month
        if (baseEvent.date.getMonth() === month - 1 && year >= baseEvent.date.getFullYear()) {
          const dayOfMonth = baseEvent.date.getDate();
          eventDate = new Date(year, month - 1, Math.min(dayOfMonth, new Date(year, month, 0).getDate()));
        }
        break;
    }

    if (eventDate && eventDate >= monthBoundary.start && eventDate <= monthBoundary.end) {
      return {
        ...baseEvent,
        date: eventDate,
        referenceId: `${baseEvent.referenceId}-${year}-${month}`
      };
    }

    return null;
  }

  // Schedule supplier payments based on purchase order
  public scheduleSupplierPayments(po: PurchaseOrder): void {
    // Schedule payments based on supplier payment terms
    po.paymentTerms.forEach(term => {
      const paymentDate = new Date(po.orderDate);
      paymentDate.setDate(paymentDate.getDate() + term.daysAfterPO);
      
      const paymentAmount = po.totalAmount * (term.percentage / 100);
      
      this.addEvent({
        date: paymentDate,
        amount: paymentAmount,
        description: `Supplier payment - ${po.supplierName} - PO#${po.poNumber} (${term.percentage}% - ${term.daysAfterPO} days)`,
        category: 'supplier_payment',
        isRecurring: false,
        account: 'accounts_payable',
        referenceId: `PO-${po.poNumber}-${term.daysAfterPO}d`
      });
    });

    // Schedule freight payment (typically paid upfront)
    if (po.freightCost > 0) {
      this.addEvent({
        date: new Date(po.orderDate),
        amount: po.freightCost,
        description: `Freight payment - PO#${po.poNumber}`,
        category: 'supplier_payment',
        isRecurring: false,
        account: 'freight_expense',
        referenceId: `PO-${po.poNumber}-FREIGHT`
      });
    }

    // Schedule tariff payment (typically paid on delivery)
    if (po.tariffAmount > 0) {
      this.addEvent({
        date: po.expectedDeliveryDate,
        amount: po.tariffAmount,
        description: `Tariff payment - PO#${po.poNumber}`,
        category: 'supplier_payment',
        isRecurring: false,
        account: 'tariff_expense',
        referenceId: `PO-${po.poNumber}-TARIFF`
      });
    }
  }

  // Schedule quarterly tax payment
  public scheduleQuarterlyTaxPayment(amount: number, quarter: number, year: number): void {
    // Tax payments are typically due on the 15th of the month following the quarter
    const taxDueDates = [
      new Date(year, 3, 15),  // Q1 - April 15
      new Date(year, 6, 15),  // Q2 - July 15
      new Date(year, 9, 15),  // Q3 - October 15
      new Date(year + 1, 0, 15)  // Q4 - January 15 (next year)
    ];

    if (quarter < 1 || quarter > 4) {
      throw new Error('Quarter must be between 1 and 4');
    }

    this.addEvent({
      date: taxDueDates[quarter - 1],
      amount: amount,
      description: `Quarterly estimated tax payment - Q${quarter} ${year}`,
      category: 'tax_payment',
      isRecurring: false,
      account: 'tax_payable',
      referenceId: `TAX-Q${quarter}-${year}`
    });
  }

  // Schedule monthly recurring expense
  public scheduleMonthlyExpense(description: string, amount: number, startDate: Date, account?: string): void {
    this.addEvent({
      date: startDate,
      amount: amount,
      description: description,
      category: 'other',
      isRecurring: true,
      recurringFrequency: 'monthly',
      account: account || 'operating_expense'
    });
  }

  // Remove events by reference ID
  public removeEventsByReferenceId(referenceId: string): number {
    const initialLength = this.events.length;
    this.events = this.events.filter(event => !event.referenceId?.startsWith(referenceId));
    return initialLength - this.events.length;
  }

  // Get upcoming events for the next N months
  public getUpcomingEvents(monthsAhead: number): ScheduledCashEvent[] {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + monthsAhead);

    const upcomingEvents: ScheduledCashEvent[] = [];

    // Process each month
    for (let i = 0; i <= monthsAhead; i++) {
      const checkDate = new Date(today);
      checkDate.setMonth(checkDate.getMonth() + i);
      const year = checkDate.getFullYear();
      const month = checkDate.getMonth() + 1;

      const monthEvents = this.processEventsForMonth(year, month);
      upcomingEvents.push(...monthEvents);
    }

    // Sort by date
    upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return upcomingEvents;
  }

  // Generate cash flow forecast
  public generateCashFlowForecast(startingCash: number, monthsAhead: number): Array<{
    year: number;
    month: number;
    beginningCash: number;
    cashOutflows: number;
    endingCash: number;
    events: ScheduledCashEvent[];
  }> {
    const forecast = [];
    let runningCash = startingCash;
    const today = new Date();

    for (let i = 0; i < monthsAhead; i++) {
      const forecastDate = new Date(today);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const year = forecastDate.getFullYear();
      const month = forecastDate.getMonth() + 1;

      const events = this.processEventsForMonth(year, month);
      const cashImpact = this.getCashImpactForMonth(year, month);

      forecast.push({
        year,
        month,
        beginningCash: runningCash,
        cashOutflows: Math.abs(cashImpact),
        endingCash: runningCash + cashImpact,
        events
      });

      runningCash += cashImpact;
    }

    return forecast;
  }
}

// Helper functions for common event types

export function scheduleSupplierPayments(
  manager: ScheduledEventManager, 
  po: PurchaseOrder
): void {
  manager.scheduleSupplierPayments(po);
}

export function scheduleQuarterlyTaxPayment(
  manager: ScheduledEventManager,
  amount: number,
  quarter: number,
  year: number
): void {
  manager.scheduleQuarterlyTaxPayment(amount, quarter, year);
}

export function scheduleMonthlyExpense(
  manager: ScheduledEventManager,
  description: string,
  amount: number,
  startDate: Date,
  account?: string
): void {
  manager.scheduleMonthlyExpense(description, amount, startDate, account);
}

// Utility function to create a batch of monthly expenses
export function scheduleMonthlyExpenses(
  manager: ScheduledEventManager,
  expenses: Array<{
    description: string;
    amount: number;
    startDate: Date;
    account?: string;
  }>
): void {
  expenses.forEach(expense => {
    manager.scheduleMonthlyExpense(
      expense.description,
      expense.amount,
      expense.startDate,
      expense.account
    );
  });
}

// Export types for external use
export type { MonthBoundary };