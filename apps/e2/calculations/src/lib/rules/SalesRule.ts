// src/lib/rules/SalesRule.ts

import { Transaction, SalesForecastInput, ProductDetailsInput } from '@/types/v4/financial';

export class SalesRule {
  private salesForecast: SalesForecastInput[];
  private productDetails: Map<string, ProductDetailsInput>;
  private startDate: Date;
  
  constructor(salesForecast: SalesForecastInput[], productDetails: ProductDetailsInput[], startDate: Date) {
    this.salesForecast = salesForecast;
    this.productDetails = new Map(productDetails.map(p => [p.sku, p]));
    this.startDate = startDate;
  }
  
  /**
   * Generate sales transactions for a specific month
   */
  generateTransactions(currentMonth: number, currentDate: Date): Transaction[] {
    const transactions: Transaction[] = [];
    
    // Process each SKU
    this.salesForecast.forEach(skuForecast => {
      const monthData = skuForecast.monthlySales.find(m => m.month === currentMonth);
      if (!monthData || monthData.unitsSold === 0) return;
      
      const product = this.productDetails.get(skuForecast.sku);
      if (!product) {
        throw new Error(`Product details not found for SKU: ${skuForecast.sku}`);
      }
      
      // Calculate amounts
      const totalRevenue = monthData.unitsSold * monthData.retailPrice;
      const amazonReferralFee = totalRevenue * product.amazonReferralFeeRate;
      const totalFBAFees = monthData.unitsSold * product.fulfillmentFee;
      const totalAmazonFees = amazonReferralFee + totalFBAFees;
      const netRevenue = totalRevenue - totalAmazonFees;
      
      // Calculate COGS
      const unitCost = product.manufacturingCost + product.freightCost;
      const totalCOGS = monthData.unitsSold * unitCost;
      
      // Generate balanced transaction set
      
      // 1. Revenue Recognition (Credit Sales Revenue)
      transactions.push({
        date: new Date(currentDate),
        description: `Sales Revenue - ${skuForecast.sku} (${monthData.unitsSold} units @ $${monthData.retailPrice})`,
        category: 'Sales Revenue',
        account: 'SalesRevenue',
        debit: 0,
        credit: totalRevenue,
        ruleSource: 'SalesRule'
      });
      
      // 2. COGS Recognition (Debit COGS)
      transactions.push({
        date: new Date(currentDate),
        description: `COGS - ${skuForecast.sku} (${monthData.unitsSold} units)`,
        category: 'Cost of Goods Sold',
        account: 'COGS',
        debit: totalCOGS,
        credit: 0,
        ruleSource: 'SalesRule'
      });
      
      // 3. Inventory Reduction (Credit Inventory)
      transactions.push({
        date: new Date(currentDate),
        description: `Inventory Reduction - ${skuForecast.sku} (${monthData.unitsSold} units)`,
        category: 'Inventory',
        account: 'Inventory',
        debit: 0,
        credit: totalCOGS,
        ruleSource: 'SalesRule'
      });
      
      // 4. Amazon Fees (Debit OpEx)
      transactions.push({
        date: new Date(currentDate),
        description: `Amazon Fees - ${skuForecast.sku} (Referral: $${amazonReferralFee.toFixed(2)}, FBA: $${totalFBAFees.toFixed(2)})`,
        category: 'Amazon Fees',
        account: 'OpEx',
        debit: totalAmazonFees,
        credit: 0,
        ruleSource: 'SalesRule'
      });
      
      // 5. Accounts Receivable (Debit AR)
      transactions.push({
        date: new Date(currentDate),
        description: `Amazon Settlement Due - ${skuForecast.sku}`,
        category: 'Accounts Receivable',
        account: 'AccountsReceivable',
        debit: netRevenue,
        credit: 0,
        ruleSource: 'SalesRule'
      });
      
      // Note: Amazon settlement transactions (14 days later) will be handled
      // separately to avoid batch imbalance issues
      
      // 7. PPC Spend (if any)
      if (monthData.ppcSpend > 0) {
        // PPC is paid immediately
        transactions.push({
          date: new Date(currentDate),
          description: `PPC Advertising - ${skuForecast.sku}`,
          category: 'Advertising',
          account: 'OpEx',
          debit: monthData.ppcSpend,
          credit: 0,
          ruleSource: 'SalesRule'
        });
        
        transactions.push({
          date: new Date(currentDate),
          description: `PPC Payment - ${skuForecast.sku}`,
          category: 'Cash Payment',
          account: 'Cash',
          debit: 0,
          credit: monthData.ppcSpend,
          ruleSource: 'SalesRule'
        });
      }
    });
    
    return transactions;
  }
  
  /**
   * Generate settlement transactions for sales that occurred 14 days ago
   * This is called separately to ensure proper batch balancing
   */
  generateSettlementTransactions(currentMonth: number, currentDate: Date): Transaction[] {
    const transactions: Transaction[] = [];
    
    // Calculate the date 14 days ago
    const salesDate = new Date(currentDate);
    salesDate.setDate(salesDate.getDate() - 14);
    
    // Find which month the sales occurred in
    const monthsDiff = (currentDate.getFullYear() - this.getStartDate().getFullYear()) * 12 +
                      (currentDate.getMonth() - this.getStartDate().getMonth()) + 1;
    const salesMonth = monthsDiff - (currentDate.getDate() < 14 ? 1 : 0);
    
    // Only process if the sales month is valid (>= 1)
    if (salesMonth < 1) return transactions;
    
    // Process each SKU
    this.salesForecast.forEach(skuForecast => {
      const monthData = skuForecast.monthlySales.find(m => m.month === salesMonth);
      if (!monthData || monthData.unitsSold === 0) return;
      
      const product = this.productDetails.get(skuForecast.sku);
      if (!product) return;
      
      // Calculate net revenue (same as original sale)
      const totalRevenue = monthData.unitsSold * monthData.retailPrice;
      const amazonReferralFee = totalRevenue * product.amazonReferralFeeRate;
      const totalFBAFees = monthData.unitsSold * product.fulfillmentFee;
      const totalAmazonFees = amazonReferralFee + totalFBAFees;
      const netRevenue = totalRevenue - totalAmazonFees;
      
      // Cash receipt from Amazon
      transactions.push({
        date: new Date(currentDate),
        description: `Amazon Settlement Received - ${skuForecast.sku} (from ${salesDate.toDateString()})`,
        category: 'Cash Receipt',
        account: 'Cash',
        debit: netRevenue,
        credit: 0,
        ruleSource: 'SalesRule'
      });
      
      // Clear AR
      transactions.push({
        date: new Date(currentDate),
        description: `Clear Amazon AR - ${skuForecast.sku}`,
        category: 'Accounts Receivable',
        account: 'AccountsReceivable',
        debit: 0,
        credit: netRevenue,
        ruleSource: 'SalesRule'
      });
    });
    
    return transactions;
  }
  
  private getStartDate(): Date {
    return this.startDate;
  }
  
  /**
   * Get total units sold for a specific month (used by InventoryRule)
   */
  getUnitsSoldForMonth(month: number): Map<string, number> {
    const unitsSold = new Map<string, number>();
    
    this.salesForecast.forEach(skuForecast => {
      const monthData = skuForecast.monthlySales.find(m => m.month === month);
      if (monthData && monthData.unitsSold > 0) {
        unitsSold.set(skuForecast.sku, monthData.unitsSold);
      }
    });
    
    return unitsSold;
  }
  
  /**
   * Get future demand forecast (used by InventoryRule)
   */
  getFutureDemand(fromMonth: number, months: number): Map<string, number> {
    const demand = new Map<string, number>();
    
    this.salesForecast.forEach(skuForecast => {
      let totalDemand = 0;
      
      for (let m = fromMonth; m < fromMonth + months; m++) {
        const monthData = skuForecast.monthlySales.find(ms => ms.month === m);
        if (monthData) {
          totalDemand += monthData.unitsSold;
        }
      }
      
      if (totalDemand > 0) {
        demand.set(skuForecast.sku, totalDemand);
      }
    });
    
    return demand;
  }
}