// Client-side inventory calculations
import { getWeekNumber } from './weekHelpers';

export interface WeeklyInventoryData {
  week: number;
  year: number;
  openingStock: number;
  ordersReceived: number;
  unitsSold: number;
  closingStock: number;
  weeksOfCoverage: number;
}

export function calculateInventoryTimeline(
  sku: string,
  initialStock: number,
  orders: Map<string, number>, // key: "year-week" e.g. "2025-40"
  sales: Map<string, number>,  // key: "year-week" e.g. "2025-40"
  startYear: number,
  startWeek: number,
  numWeeks: number = 52 * 3 // 3 years default
): WeeklyInventoryData[] {
  const timeline: WeeklyInventoryData[] = [];
  let currentStock = initialStock;
  
  // Build a list of all year-week combinations we need
  const allWeeks: Array<{year: number, week: number}> = [];
  let year = startYear;
  let week = startWeek;
  
  for (let i = 0; i < numWeeks; i++) {
    allWeeks.push({ year, week });
    week++;
    if (week > 52) {
      week = 1;
      year++;
    }
  }
  
  // Calculate inventory for each week
  allWeeks.forEach((w, index) => {
    const weekKey = `${w.year}-${w.week}`;
    const ordersThisWeek = orders.get(weekKey) || 0;
    const salesThisWeek = sales.get(weekKey) || 0;
    
    // Opening stock is previous closing (or initial for first week)
    const openingStock = currentStock;
    
    // Add orders received at start of week
    currentStock += ordersThisWeek;
    
    // Calculate weeks of coverage based on future sales
    let tempStock = currentStock;
    let weeksOfCoverage = 0;
    
    // Look forward from current week
    for (let futureIdx = index; futureIdx < allWeeks.length && futureIdx < index + 104; futureIdx++) {
      const futureWeek = allWeeks[futureIdx];
      const futureWeekKey = `${futureWeek.year}-${futureWeek.week}`;
      const futureSales = sales.get(futureWeekKey) || 0;
      
      if (futureSales > 0) {
        if (tempStock >= futureSales) {
          tempStock -= futureSales;
          weeksOfCoverage = futureIdx - index + 1;
        } else if (tempStock > 0) {
          // Partial week coverage
          weeksOfCoverage = (futureIdx - index) + (tempStock / futureSales);
          break;
        } else {
          // Out of stock
          break;
        }
      } else {
        // No sales but still counting as a week of coverage if we have stock
        if (tempStock > 0) {
          weeksOfCoverage = futureIdx - index + 1;
        }
      }
    }
    
    // Handle negative stock (backorders) or zero sales
    if (currentStock < 0 && salesThisWeek > 0) {
      weeksOfCoverage = currentStock / salesThisWeek; // Negative weeks
    } else if (currentStock > 0 && salesThisWeek === 0) {
      weeksOfCoverage = 999; // Infinite coverage when no sales but have stock
    } else if (currentStock < 0 && salesThisWeek === 0) {
      weeksOfCoverage = -999; // Negative infinite (backorders with no sales to fulfill them)
    }
    
    // Subtract sales at end of week
    currentStock -= salesThisWeek;
    
    timeline.push({
      week: w.week,
      year: w.year,
      openingStock: openingStock,
      ordersReceived: ordersThisWeek,
      unitsSold: salesThisWeek,
      closingStock: currentStock,
      weeksOfCoverage: Math.round(weeksOfCoverage * 10) / 10 // Round to 1 decimal
    });
  });
  
  return timeline;
}

// Helper to convert database records to Maps
export function buildOrdersMap(orders: Array<{weekStarting: string, sku: string, quantity: number}>): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  
  orders.forEach(order => {
    const date = new Date(order.weekStarting);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-${week}`;
    
    if (!map.has(order.sku)) {
      map.set(order.sku, new Map());
    }
    map.get(order.sku)!.set(weekKey, order.quantity);
  });
  
  return map;
}

export function buildSalesMap(sales: Array<{weekStarting: string, sku: string, units: number}>): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  
  sales.forEach(sale => {
    const date = new Date(sale.weekStarting);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-${week}`;
    
    if (!map.has(sale.sku)) {
      map.set(sale.sku, new Map());
    }
    map.get(sale.sku)!.set(weekKey, sale.units);
  });
  
  return map;
}

