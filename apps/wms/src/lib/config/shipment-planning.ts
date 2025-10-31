// Shipment Planning Configuration
// TODO: Move these to database settings in the future

export const SHIPMENT_PLANNING_CONFIG = {
 // Target inventory days - how many days of stock to maintain at FBA
 TARGET_DAYS_OF_STOCK: 30,
 
 // Reorder point - when to trigger reorder (in days)
 REORDER_DAYS: 14,
 
 // Low stock threshold - triggers notifications (in days)
 LOW_STOCK_THRESHOLD_DAYS: 20,
 
 // Default cartons per pallet if not specified on SKU
 DEFAULT_CARTONS_PER_PALLET: 48,
 
 // Minimum pallets to ship (to optimize shipping costs)
 MINIMUM_PALLETS_TO_SHIP: 1,
 
 // Stock level urgency thresholds (in days)
 URGENCY_LEVELS: {
 CRITICAL: 7, // Less than 7 days
 HIGH: 14, // 7-14 days
 MEDIUM: 20, // 14-20 days
 },
 
 // Default sales velocity if no data available
 DEFAULT_DAILY_SALES_VELOCITY: 1,
}

// Helper function to get urgency level
export function getStockUrgency(daysOfStock: number): 'critical' | 'high' | 'medium' | 'low' {
 if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.URGENCY_LEVELS.CRITICAL) {
 return 'critical'
 } else if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.URGENCY_LEVELS.HIGH) {
 return 'high'
 } else if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.URGENCY_LEVELS.MEDIUM) {
 return 'medium'
 }
 return 'low'
}

// Helper function to get urgency reason
export function getUrgencyReason(daysOfStock: number, urgency: string): string {
 switch (urgency) {
 case 'critical':
 return `Only ${daysOfStock} days of stock remaining`
 case 'high':
 return `Stock will run out in ${daysOfStock} days`
 case 'medium':
 return `Stock below ${SHIPMENT_PLANNING_CONFIG.LOW_STOCK_THRESHOLD_DAYS}-day threshold (${daysOfStock} days left)`
 default:
 return ''
 }
}