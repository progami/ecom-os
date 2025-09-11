// src/lib/inventoryManager.ts

import {
  Assumptions,
  ProductMargin,
  SupplierPaymentTerm
} from '../types/financial';

// Interfaces for inventory management
export interface InventoryItem {
  sku: string;
  unitsOnHand: number;
  unitsInTransit: number;
  unitCost: number; // FIFO cost
  lastReceiptDate: Date;
  reorderPoint: number;
  safetyStock: number;
}

export interface PurchaseOrder {
  poNumber: string;
  date: Date;
  supplier: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  paymentTerms: SupplierPaymentTerm[];
  expectedDeliveryDate: Date;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  relatedCashEvents: ScheduledCashEvent[];
  lclShipmentCost: number;
  tariffAmount: number;
}

export interface PurchaseOrderItem {
  sku: string;
  units: number;
  unitCost: number; // FOB cost
  landedCost: number; // FOB + tariff + freight allocation
}

export interface ScheduledCashEvent {
  date: Date;
  amount: number;
  description: string;
  type: 'supplier_payment' | 'freight_payment' | 'tariff_payment';
  poNumber: string;
  completed: boolean;
}

export interface InventoryReceipt {
  date: Date;
  poNumber: string;
  items: Array<{
    sku: string;
    units: number;
    totalCost: number; // Including all landed costs
  }>;
}

// FIFO cost tracking
interface CostLayer {
  units: number;
  unitCost: number;
  receiptDate: Date;
  poNumber: string;
}

export class InventoryManager {
  private inventory: Map<string, InventoryItem>;
  private costLayers: Map<string, CostLayer[]>;
  private purchaseOrders: PurchaseOrder[];
  private receipts: InventoryReceipt[];
  private scheduledCashEvents: ScheduledCashEvent[];
  private poCounter: number;
  
  constructor(
    private assumptions: Assumptions,
    private productMargins: ProductMargin[]
  ) {
    this.inventory = new Map();
    this.costLayers = new Map();
    this.purchaseOrders = [];
    this.receipts = [];
    this.scheduledCashEvents = [];
    this.poCounter = 1000;
    
    // Initialize inventory for all SKUs
    this.initializeInventory();
  }
  
  private initializeInventory(): void {
    // Calculate initial inventory from $60,000 investment
    const initialInventoryBudget = this.assumptions.investmentUseInventory;
    
    // Distribute based on product mix
    this.assumptions.productSalesMix.forEach((product: any) => {
      const margin = this.productMargins.find(m => m.sku === product.sku);
      if (!margin) return;
      
      // Calculate how many units we can buy with allocated budget
      const allocatedBudget = initialInventoryBudget * product.percentage;
      const landedCostPerUnit = margin.landedCost || margin.manufacturing;
      const initialUnits = Math.floor(allocatedBudget / landedCostPerUnit);
      
      // Calculate safety stock (1 month of supply)
      const monthlyDemand = product.monthlyUnits;
      const safetyStock = Math.ceil(monthlyDemand * 0.5); // 50% safety factor
      const reorderPoint = Math.ceil(monthlyDemand * (this.assumptions.leadTimeDays / 30) + safetyStock);
      
      this.inventory.set(product.sku, {
        sku: product.sku,
        unitsOnHand: initialUnits,
        unitsInTransit: 0,
        unitCost: landedCostPerUnit,
        lastReceiptDate: new Date(this.assumptions.modelStartDate),
        reorderPoint: reorderPoint,
        safetyStock: safetyStock
      });
      
      // Initialize cost layer for FIFO
      this.costLayers.set(product.sku, [{
        units: initialUnits,
        unitCost: landedCostPerUnit,
        receiptDate: new Date(this.assumptions.modelStartDate),
        poNumber: 'INITIAL'
      }]);
    });
  }
  
  public checkReorderNeeded(currentDate: Date): Map<string, boolean> {
    const reorderStatus = new Map<string, boolean>();
    
    this.inventory.forEach((item, sku) => {
      const totalAvailable = item.unitsOnHand + item.unitsInTransit;
      const needsReorder = totalAvailable <= item.reorderPoint;
      reorderStatus.set(sku, needsReorder);
    });
    
    return reorderStatus;
  }
  
  public createPurchaseOrder(currentDate: Date, targetMonthsSupply: number = 3): PurchaseOrder | null {
    const itemsToOrder: PurchaseOrderItem[] = [];
    let totalFOBCost = 0;
    
    // Check each SKU for reorder needs
    this.assumptions.productSalesMix.forEach((product: any) => {
      const item = this.inventory.get(product.sku);
      if (!item) return;
      
      const margin = this.productMargins.find(m => m.sku === product.sku);
      if (!margin) return;
      
      // Calculate order quantity
      const monthlyDemand = product.monthlyUnits;
      const targetInventory = monthlyDemand * targetMonthsSupply;
      const currentTotal = item.unitsOnHand + item.unitsInTransit;
      const orderQuantity = Math.max(0, targetInventory - currentTotal + item.safetyStock);
      
      if (orderQuantity > 0) {
        const fobCost = margin.fobCost || margin.manufacturing;
        totalFOBCost += orderQuantity * fobCost;
        
        itemsToOrder.push({
          sku: product.sku,
          units: orderQuantity,
          unitCost: fobCost,
          landedCost: margin.landedCost || margin.manufacturing
        });
      }
    });
    
    // Only create PO if there are items to order
    if (itemsToOrder.length === 0) return null;
    
    // Calculate total costs
    const tariffAmount = totalFOBCost * this.assumptions.tariffRate;
    const totalWithTariff = totalFOBCost + tariffAmount + this.assumptions.lclShipmentCost;
    
    // Generate PO
    const poNumber = `PO-${this.poCounter++}`;
    const expectedDeliveryDate = new Date(currentDate);
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + this.assumptions.leadTimeDays);
    
    // Create cash events based on payment terms
    const cashEvents: ScheduledCashEvent[] = [];
    
    // Supplier payments
    this.assumptions.supplierPaymentTerms.forEach((term: any) => {
      const paymentDate = new Date(currentDate);
      paymentDate.setDate(paymentDate.getDate() + term.daysAfterPO);
      
      cashEvents.push({
        date: paymentDate,
        amount: totalFOBCost * term.percentage,
        description: `Supplier payment (${term.percentage * 100}%) for ${poNumber}`,
        type: 'supplier_payment',
        poNumber: poNumber,
        completed: false
      });
    });
    
    // Freight payment (on shipment)
    const freightDate = new Date(currentDate);
    freightDate.setDate(freightDate.getDate() + 30); // Assume 30 days to ship
    cashEvents.push({
      date: freightDate,
      amount: this.assumptions.lclShipmentCost,
      description: `LCL freight for ${poNumber}`,
      type: 'freight_payment',
      poNumber: poNumber,
      completed: false
    });
    
    // Tariff payment (on arrival)
    cashEvents.push({
      date: expectedDeliveryDate,
      amount: tariffAmount,
      description: `Import tariff (25%) for ${poNumber}`,
      type: 'tariff_payment',
      poNumber: poNumber,
      completed: false
    });
    
    const purchaseOrder: PurchaseOrder = {
      poNumber: poNumber,
      date: currentDate,
      supplier: 'Primary Supplier',
      items: itemsToOrder,
      totalAmount: totalWithTariff,
      paymentTerms: this.assumptions.supplierPaymentTerms,
      expectedDeliveryDate: expectedDeliveryDate,
      status: 'pending',
      relatedCashEvents: cashEvents,
      lclShipmentCost: this.assumptions.lclShipmentCost,
      tariffAmount: tariffAmount
    };
    
    // Update in-transit inventory
    itemsToOrder.forEach(item => {
      const invItem = this.inventory.get(item.sku);
      if (invItem) {
        invItem.unitsInTransit += item.units;
      }
    });
    
    // Store PO and cash events
    this.purchaseOrders.push(purchaseOrder);
    this.scheduledCashEvents.push(...cashEvents);
    
    return purchaseOrder;
  }
  
  public receiveInventory(po: PurchaseOrder): void {
    if (po.status === 'delivered') {
      throw new Error(`PO ${po.poNumber} has already been delivered`);
    }
    
    const receipt: InventoryReceipt = {
      date: new Date(),
      poNumber: po.poNumber,
      items: []
    };
    
    // Allocate freight cost proportionally
    const totalUnits = po.items.reduce((sum, item) => sum + item.units, 0);
    const freightPerUnit = po.lclShipmentCost / totalUnits;
    
    po.items.forEach(item => {
      const invItem = this.inventory.get(item.sku);
      if (!invItem) return;
      
      // Calculate landed cost including freight allocation
      const landedCostPerUnit = item.landedCost;
      const totalCost = item.units * landedCostPerUnit;
      
      // Update inventory
      invItem.unitsOnHand += item.units;
      invItem.unitsInTransit -= item.units;
      invItem.lastReceiptDate = new Date();
      
      // Add to FIFO cost layers
      const layers = this.costLayers.get(item.sku) || [];
      layers.push({
        units: item.units,
        unitCost: landedCostPerUnit,
        receiptDate: new Date(),
        poNumber: po.poNumber
      });
      this.costLayers.set(item.sku, layers);
      
      receipt.items.push({
        sku: item.sku,
        units: item.units,
        totalCost: totalCost
      });
    });
    
    // Update PO status
    po.status = 'delivered';
    this.receipts.push(receipt);
  }
  
  public consumeInventory(sku: string, units: number): number {
    const layers = this.costLayers.get(sku);
    if (!layers || layers.length === 0) {
      throw new Error(`No inventory available for SKU ${sku}`);
    }
    
    const invItem = this.inventory.get(sku);
    if (!invItem || invItem.unitsOnHand < units) {
      throw new Error(`Insufficient inventory for SKU ${sku}. Available: ${invItem?.unitsOnHand || 0}, Requested: ${units}`);
    }
    
    let remainingUnits = units;
    let totalCost = 0;
    const consumedLayers: number[] = [];
    
    // Consume from oldest layers first (FIFO)
    for (let i = 0; i < layers.length && remainingUnits > 0; i++) {
      const layer = layers[i];
      const unitsFromLayer = Math.min(layer.units, remainingUnits);
      
      totalCost += unitsFromLayer * layer.unitCost;
      remainingUnits -= unitsFromLayer;
      layer.units -= unitsFromLayer;
      
      if (layer.units === 0) {
        consumedLayers.push(i);
      }
    }
    
    // Remove fully consumed layers
    for (let i = consumedLayers.length - 1; i >= 0; i--) {
      layers.splice(consumedLayers[i], 1);
    }
    
    // Update on-hand inventory
    invItem.unitsOnHand -= units;
    
    // Return average cost per unit
    return totalCost / units;
  }
  
  public getInventoryValue(): number {
    let totalValue = 0;
    
    this.costLayers.forEach((layers, sku) => {
      layers.forEach(layer => {
        totalValue += layer.units * layer.unitCost;
      });
    });
    
    return totalValue;
  }
  
  public getMonthsOfSupply(sku: string): number {
    const item = this.inventory.get(sku);
    if (!item) return 0;
    
    const product = this.assumptions.productSalesMix.find((p: any) => p.sku === sku);
    if (!product) return 0;
    
    const monthlyDemand = product.monthlyUnits;
    const totalAvailable = item.unitsOnHand + item.unitsInTransit;
    
    return monthlyDemand > 0 ? totalAvailable / monthlyDemand : 0;
  }
  
  public getScheduledCashEvents(startDate: Date, endDate: Date): ScheduledCashEvent[] {
    return this.scheduledCashEvents.filter(event => 
      event.date >= startDate && 
      event.date <= endDate && 
      !event.completed
    );
  }
  
  public markCashEventCompleted(poNumber: string, eventType: string): void {
    const event = this.scheduledCashEvents.find(e => 
      e.poNumber === poNumber && 
      e.type === eventType && 
      !e.completed
    );
    
    if (event) {
      event.completed = true;
    }
  }
  
  public getInventoryMetrics(): {
    totalValue: number;
    totalUnitsOnHand: Map<string, number>;
    totalUnitsInTransit: Map<string, number>;
    monthsOfSupply: Map<string, number>;
    reorderStatus: Map<string, boolean>;
  } {
    const unitsOnHand = new Map<string, number>();
    const unitsInTransit = new Map<string, number>();
    const monthsOfSupply = new Map<string, number>();
    
    this.inventory.forEach((item, sku) => {
      unitsOnHand.set(sku, item.unitsOnHand);
      unitsInTransit.set(sku, item.unitsInTransit);
      monthsOfSupply.set(sku, this.getMonthsOfSupply(sku));
    });
    
    return {
      totalValue: this.getInventoryValue(),
      totalUnitsOnHand: unitsOnHand,
      totalUnitsInTransit: unitsInTransit,
      monthsOfSupply: monthsOfSupply,
      reorderStatus: this.checkReorderNeeded(new Date())
    };
  }
  
  public getPurchaseOrderHistory(): PurchaseOrder[] {
    return [...this.purchaseOrders];
  }
  
  public getActiveOrders(): PurchaseOrder[] {
    return this.purchaseOrders.filter(po => 
      po.status === 'pending' || po.status === 'in_transit'
    );
  }
}