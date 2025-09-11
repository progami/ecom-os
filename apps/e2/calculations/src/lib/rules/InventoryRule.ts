// src/lib/rules/InventoryRule.ts

import { Transaction, InventoryRulesInput, ProductDetailsInput } from '@/types/v4/financial';
import { SalesRule } from './SalesRule';

interface InventoryState {
  sku: string;
  unitsOnHand: number;
  unitsOnOrder: number;
  lastPODate?: Date;
}

interface PurchaseOrder {
  sku: string;
  units: number;
  totalCost: number;
  orderDate: Date;
  receiptDate: Date; // When inventory arrives
  paymentSchedule: { date: Date; amount: number }[];
}

export class InventoryRule {
  private inventoryRules: InventoryRulesInput;
  private productDetails: Map<string, ProductDetailsInput>;
  private inventoryState: Map<string, InventoryState>;
  private pendingPOs: PurchaseOrder[] = [];
  private leadTimeDays = 45; // Time from PO to receipt
  
  constructor(
    inventoryRules: InventoryRulesInput,
    productDetails: ProductDetailsInput[]
  ) {
    this.inventoryRules = inventoryRules;
    this.productDetails = new Map(productDetails.map(p => [p.sku, p]));
    
    // Initialize inventory state
    this.inventoryState = new Map();
    productDetails.forEach(product => {
      this.inventoryState.set(product.sku, {
        sku: product.sku,
        unitsOnHand: 0, // Starting with no inventory
        unitsOnOrder: 0
      });
    });
  }
  
  /**
   * Generate inventory-related transactions for a specific month
   */
  generateTransactions(
    currentMonth: number,
    currentDate: Date,
    salesRule: SalesRule
  ): Transaction[] {
    const transactions: Transaction[] = [];
    
    // 1. Process any POs that are arriving this month
    this.processPOReceipts(currentDate, transactions);
    
    // 2. Update inventory levels based on sales
    const unitsSold = salesRule.getUnitsSoldForMonth(currentMonth);
    unitsSold.forEach((units, sku) => {
      const state = this.inventoryState.get(sku);
      if (state) {
        state.unitsOnHand -= units;
        // Note: The inventory reduction transaction is already handled by SalesRule
      }
    });
    
    // 3. Check if we need to place new POs
    this.checkAndCreatePOs(currentMonth, currentDate, salesRule, transactions);
    
    // 4. Generate payment transactions for existing POs
    this.generatePOPayments(currentDate, transactions);
    
    return transactions;
  }
  
  /**
   * Process PO receipts for the current month
   */
  private processPOReceipts(currentDate: Date, transactions: Transaction[]): void {
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    this.pendingPOs.forEach(po => {
      if (po.receiptDate >= currentMonthStart && po.receiptDate <= currentMonthEnd) {
        // Update inventory state
        const state = this.inventoryState.get(po.sku);
        if (state) {
          state.unitsOnHand += po.units;
          state.unitsOnOrder -= po.units;
        }
        
        // Note: Inventory value was already recorded when PO was created
        // We don't need another transaction here, just update the state
      }
    });
  }
  
  /**
   * Check inventory levels and create POs if needed
   */
  private checkAndCreatePOs(
    currentMonth: number,
    currentDate: Date,
    salesRule: SalesRule,
    transactions: Transaction[]
  ): void {
    
    this.inventoryState.forEach((state, sku) => {
      // Get future demand
      const futureDemand = salesRule.getFutureDemand(
        currentMonth,
        this.inventoryRules.targetMonthsOfSupply
      ).get(sku) || 0;
      
      // Calculate current coverage
      const totalAvailable = state.unitsOnHand + state.unitsOnOrder;
      const needsOrder = totalAvailable < futureDemand;
      
      if (needsOrder) {
        // Calculate order quantity
        const orderQuantity = Math.ceil(futureDemand * 1.2); // Order 20% buffer
        
        // Create PO
        const po = this.createPurchaseOrder(sku, orderQuantity, currentDate);
        this.pendingPOs.push(po);
        
        // Update inventory state
        state.unitsOnOrder += orderQuantity;
        state.lastPODate = currentDate;
        
        // When PO is created, we don't record any GL transactions yet
        // The transactions will be recorded when payments are made
        // This avoids double-counting inventory
      }
    });
  }
  
  /**
   * Create a purchase order with payment schedule
   */
  private createPurchaseOrder(
    sku: string,
    units: number,
    orderDate: Date
  ): PurchaseOrder {
    const product = this.productDetails.get(sku);
    if (!product) {
      throw new Error(`Product details not found for SKU: ${sku}`);
    }
    
    const unitCost = product.manufacturingCost + product.freightCost;
    const totalCost = units * unitCost;
    
    // Calculate receipt date
    const receiptDate = new Date(orderDate);
    receiptDate.setDate(receiptDate.getDate() + this.leadTimeDays);
    
    // Create payment schedule based on supplier terms
    const paymentSchedule: { date: Date; amount: number }[] = [];
    this.inventoryRules.supplierPaymentTerms.forEach(term => {
      const paymentDate = new Date(orderDate);
      paymentDate.setDate(paymentDate.getDate() + term.daysAfterPO);
      
      paymentSchedule.push({
        date: paymentDate,
        amount: totalCost * (term.percentage / 100)
      });
    });
    
    return {
      sku,
      units,
      totalCost,
      orderDate,
      receiptDate,
      paymentSchedule
    };
  }
  
  /**
   * Generate payment transactions for POs due this month
   */
  private generatePOPayments(currentDate: Date, transactions: Transaction[]): void {
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    this.pendingPOs.forEach(po => {
      po.paymentSchedule.forEach((payment, index) => {
        if (payment.date >= currentMonthStart && payment.date <= currentMonthEnd) {
          // When paying for inventory:
          // Debit: Inventory (increase asset)
          // Credit: Cash (decrease asset)
          
          transactions.push({
            date: payment.date,
            description: `Inventory Purchase ${index + 1}/${po.paymentSchedule.length} - ${po.sku}`,
            category: 'Inventory Purchase',
            account: 'Inventory',
            debit: payment.amount,
            credit: 0,
            ruleSource: 'InventoryRule'
          });
          
          transactions.push({
            date: payment.date,
            description: `Inventory Payment ${index + 1}/${po.paymentSchedule.length} - ${po.sku}`,
            category: 'Inventory Payment',
            account: 'Cash',
            debit: 0,
            credit: payment.amount,
            ruleSource: 'InventoryRule'
          });
        }
      });
    });
  }
  
  /**
   * Get current inventory levels (for reporting)
   */
  getInventoryLevels(): Map<string, { onHand: number; onOrder: number; value: number }> {
    const levels = new Map();
    
    this.inventoryState.forEach((state, sku) => {
      const product = this.productDetails.get(sku);
      if (product) {
        const unitCost = product.manufacturingCost + product.freightCost;
        levels.set(sku, {
          onHand: state.unitsOnHand,
          onOrder: state.unitsOnOrder,
          value: state.unitsOnHand * unitCost
        });
      }
    });
    
    return levels;
  }
  
  /**
   * Get total inventory value
   */
  getTotalInventoryValue(): number {
    let total = 0;
    
    this.inventoryState.forEach((state, sku) => {
      const product = this.productDetails.get(sku);
      if (product) {
        const unitCost = product.manufacturingCost + product.freightCost;
        total += state.unitsOnHand * unitCost;
      }
    });
    
    return total;
  }
  
  /**
   * Initialize with opening inventory (if any)
   */
  setOpeningInventory(openingInventory: Map<string, number>): void {
    openingInventory.forEach((units, sku) => {
      const state = this.inventoryState.get(sku);
      if (state) {
        state.unitsOnHand = units;
      }
    });
  }
}