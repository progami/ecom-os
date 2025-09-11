/**
 * Re-export SharedFinancialDataService from the database services
 * This maintains backward compatibility with existing imports
 */

export { default } from '@/services/database/SharedFinancialDataService';
export * from '@/services/database/SharedFinancialDataService';