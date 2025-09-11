/**
 * Land Freight Expense Rule (Account 5031)
 * 
 * Business Justification:
 * Domestic shipping costs for delivering products to Amazon warehouses
 * Covers AWD (Amazon Warehousing & Distribution) shipments from port to fulfillment centers
 * Only occurs when inventory shipments are made
 * 
 * Cost Breakdown:
 * - Per shipment AWD cost: $100
 * - Includes fuel surcharges and handling fees
 * - Covers multiple shipments to different fulfillment centers
 * 
 * Cost per Shipment: $100
 * Payment Frequency: Only on weeks with inventory orders
 * Started: From business start week defined in business logic
 * 
 * Note: This is a COGS expense as it's directly related to getting inventory 
 * to Amazon for sale, not an operating expense
 */

import { TIMELINE } from '../business-logic'

export const LAND_FREIGHT_RULE = {
  code: '5031',
  name: 'Land Freight',
  amount: 100,
  frequency: 'weekly',
  description: 'AWD shipping to Amazon fulfillment centers - weekly operational cost',
  
  getExpense(year: number, week: number, quarter: number) {
    // Land freight runs from business start week (W40 2025) to end of timeline (2030)
    if (year === 2025 && week < 40) {
      return null // Before business operations start
    }
    
    if (year > 2030) {
      return null // After timeline ends
    }
    
    return {
      code: this.code,
      amount: this.amount
    }
  }
}