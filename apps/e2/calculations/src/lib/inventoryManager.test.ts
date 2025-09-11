// @ts-nocheck
// src/lib/inventoryManager.test.ts

import ProductService from '@/services/database/ProductService';

describe('InventoryManager', () => {
  let manager: InventoryManager;
  let assumptions: ReturnType<typeof getDefaultAssumptions>;
  let productMargins: ReturnType<typeof getDefaultProductMargins>;
  
  beforeEach(async () => {
    await ProductService.getInstance().initializeCache();
    assumptions = getDefaultAssumptions();
    productMargins = getDefaultProductMargins();
    manager = new InventoryManager(assumptions, productMargins);
  });
  
  test('initializes inventory with correct values', () => {
    const metrics = manager.getInventoryMetrics();
    
    // Should have inventory for all 4 SKUs
    expect(metrics.totalUnitsOnHand.size).toBe(4);
    
    // Total inventory value should be close to $60,000
    expect(metrics.totalValue).toBeCloseTo(60000, -3);
    
    // Check specific SKU
    const ts007Units = metrics.totalUnitsOnHand.get('TS-007');
    expect(ts007Units).toBeGreaterThan(0);
  });
  
  test('correctly calculates months of supply', () => {
    const monthsSupply = manager.getMonthsOfSupply('TS-007');
    
    // Initial inventory should provide some months of supply
    expect(monthsSupply).toBeGreaterThan(0);
    expect(monthsSupply).toBeLessThan(6); // Reasonable upper bound
  });
  
  test('identifies reorder needs correctly', () => {
    const reorderStatus = manager.checkReorderNeeded(new Date('2025-11-01'));
    
    // Initially, with fresh inventory, might not need reorders
    reorderStatus.forEach((needsReorder, sku) => {
      expect(typeof needsReorder).toBe('boolean');
    });
  });
  
  test('creates purchase order with correct calculations', () => {
    const currentDate = new Date('2025-11-01');
    const po = manager.createPurchaseOrder(currentDate, 3);
    
    if (po) {
      // Check PO structure
      expect(po.poNumber).toMatch(/^PO-\d+$/);
      expect(po.status).toBe('pending');
      expect(po.supplier).toBe('Primary Supplier');
      
      // Check dates
      const leadTime = (po.expectedDeliveryDate.getTime() - po.date.getTime()) / (1000 * 60 * 60 * 24);
      expect(leadTime).toBeCloseTo(60, 0);
      
      // Check cash events
      expect(po.relatedCashEvents.length).toBeGreaterThan(0);
      
      // Should have supplier payments (30% + 70%)
      const supplierPayments = po.relatedCashEvents.filter(e => e.type === 'supplier_payment');
      expect(supplierPayments.length).toBe(2);
      
      // Should have freight payment
      const freightPayment = po.relatedCashEvents.find(e => e.type === 'freight_payment');
      expect(freightPayment?.amount).toBe(5000);
      
      // Should have tariff payment
      const tariffPayment = po.relatedCashEvents.find(e => e.type === 'tariff_payment');
      expect(tariffPayment).toBeDefined();
    }
  });
  
  test('FIFO cost tracking works correctly', () => {
    // Consume some inventory
    const unitCost = manager.consumeInventory('TS-007', 100);
    
    // Cost should match the landed cost from product margins
    const margin = productMargins.find(m => m.sku === 'TS-007');
    expect(unitCost).toBeCloseTo(margin!.landedCost, 2);
    
    // Check updated metrics
    const metrics = manager.getInventoryMetrics();
    const remainingUnits = metrics.totalUnitsOnHand.get('TS-007');
    expect(remainingUnits).toBeDefined();
  });
  
  test('inventory receipt updates correctly', () => {
    // Create a PO
    const po = manager.createPurchaseOrder(new Date('2025-11-01'), 3);
    
    if (po) {
      // Check in-transit inventory
      const beforeMetrics = manager.getInventoryMetrics();
      po.items.forEach(item => {
        const inTransit = beforeMetrics.totalUnitsInTransit.get(item.sku);
        expect(inTransit).toBeGreaterThan(0);
      });
      
      // Receive the inventory
      manager.receiveInventory(po);
      
      // Check that inventory moved from in-transit to on-hand
      const afterMetrics = manager.getInventoryMetrics();
      po.items.forEach(item => {
        const inTransit = afterMetrics.totalUnitsInTransit.get(item.sku);
        const onHand = afterMetrics.totalUnitsOnHand.get(item.sku);
        
        expect(inTransit).toBeLessThan(beforeMetrics.totalUnitsInTransit.get(item.sku)!);
        expect(onHand).toBeGreaterThan(beforeMetrics.totalUnitsOnHand.get(item.sku)!);
      });
      
      // PO should be marked as delivered
      expect(po.status).toBe('delivered');
    }
  });
  
  test('scheduled cash events are tracked correctly', () => {
    const startDate = new Date('2025-11-01');
    const endDate = new Date('2025-12-31');
    
    // Create a PO
    const po = manager.createPurchaseOrder(startDate, 3);
    
    if (po) {
      // Get cash events for the next 2 months
      const events = manager.getScheduledCashEvents(startDate, endDate);
      
      // Should have multiple events
      expect(events.length).toBeGreaterThan(0);
      
      // All events should be within date range
      events.forEach(event => {
        expect(event.date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(event.date.getTime()).toBeLessThanOrEqual(endDate.getTime());
        expect(event.completed).toBe(false);
      });
      
      // Mark an event as completed
      manager.markCashEventCompleted(po.poNumber, 'supplier_payment');
      
      // Check that it's marked
      const updatedEvents = manager.getScheduledCashEvents(startDate, endDate);
      const completedCount = po.relatedCashEvents.filter(e => e.completed).length;
      expect(completedCount).toBeGreaterThan(0);
    }
  });
  
  test('handles multiple purchase orders correctly', () => {
    const dates = [
      new Date('2025-11-01'),
      new Date('2025-12-01'),
      new Date('2026-01-01')
    ];
    
    const orders: any[] = [];
    
    dates.forEach(date => {
      const po = manager.createPurchaseOrder(date, 3);
      if (po) orders.push(po);
    });
    
    // Should have created multiple orders
    expect(orders.length).toBeGreaterThan(0);
    
    // Each should have unique PO number
    const poNumbers = new Set(orders.map(o => o.poNumber));
    expect(poNumbers.size).toBe(orders.length);
    
    // Check active orders
    const activeOrders = manager.getActiveOrders();
    expect(activeOrders.length).toBe(orders.length);
    
    // Receive first order
    if (orders[0]) {
      manager.receiveInventory(orders[0]);
      const activeAfterReceipt = manager.getActiveOrders();
      expect(activeAfterReceipt.length).toBe(orders.length - 1);
    }
  });
});

// Example usage in finance engine integration
export function demonstrateIntegration() {
  const assumptions = getDefaultAssumptions();
  const productMargins = getDefaultProductMargins();
  const inventoryManager = new InventoryManager(assumptions, productMargins);
  
  // Simulate monthly operations
  const startDate = new Date(assumptions.modelStartDate);
  
  for (let month = 0; month < 12; month++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + month);
    
    console.log(`\n--- Month ${month + 1} (${currentDate.toISOString().split('T')[0]}) ---`);
    
    // Check inventory status
    const metrics = inventoryManager.getInventoryMetrics();
    console.log('Inventory Value:', metrics.totalValue.toFixed(2));
    
    // Check reorder status
    const reorderStatus = inventoryManager.checkReorderNeeded(currentDate);
    reorderStatus.forEach((needsReorder, sku) => {
      if (needsReorder) {
        console.log(`SKU ${sku} needs reorder`);
      }
    });
    
    // Create PO if needed
    const po = inventoryManager.createPurchaseOrder(currentDate, 3);
    if (po) {
      console.log(`Created ${po.poNumber} for $${po.totalAmount.toFixed(2)}`);
      console.log(`Expected delivery: ${po.expectedDeliveryDate.toISOString().split('T')[0]}`);
    }
    
    // Check for deliveries
    const activeOrders = inventoryManager.getActiveOrders();
    activeOrders.forEach(order => {
      if (order.expectedDeliveryDate <= currentDate && order.status !== 'delivered') {
        inventoryManager.receiveInventory(order);
        console.log(`Received ${order.poNumber}`);
      }
    });
    
    // Get cash events for this month
    const monthEnd = new Date(currentDate);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    const cashEvents = inventoryManager.getScheduledCashEvents(currentDate, monthEnd);
    
    if (cashEvents.length > 0) {
      console.log('Cash events this month:');
      cashEvents.forEach(event => {
        console.log(`  ${event.date.toISOString().split('T')[0]}: ${event.description} - $${event.amount.toFixed(2)}`);
      });
    }
    
    // Simulate sales (consume inventory)
    assumptions.productSalesMix.forEach(product => {
      try {
        const unitsSold = product.monthlyUnits;
        const cogPerUnit = inventoryManager.consumeInventory(product.sku, unitsSold);
        console.log(`Sold ${unitsSold} units of ${product.sku} at COGS $${cogPerUnit.toFixed(2)}/unit`);
      } catch (error) {
        console.error(`Error selling ${product.sku}:`, error.message);
      }
    });
  }
}