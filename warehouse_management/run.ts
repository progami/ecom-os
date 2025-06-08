#!/usr/bin/env ts-node

/**
 * WMS Automation Script
 * 
 * This headless script performs warehouse management background tasks
 * by consuming the API provided by the main application.
 * 
 * Current functionality: Generates daily "low stock" report
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const API_KEY = process.env.WMS_API_KEY;
const NEXT_AUTH_SESSION = process.env.NEXT_AUTH_SESSION; // For authentication
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD || '100');

interface InventoryItem {
  skuCode: string;
  description: string;
  warehouseCode: string;
  warehouseName: string;
  currentUnits: number;
  currentCartons: number;
  batchLot: string;
}

interface LowStockItem extends InventoryItem {
  percentageOfThreshold: number;
}

/**
 * Fetches inventory data from the API
 */
async function fetchInventory(): Promise<InventoryItem[]> {
  try {
    const headers: any = {
      'Content-Type': 'application/json'
    };

    // Use API key if available, otherwise use session
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    } else if (NEXT_AUTH_SESSION) {
      headers['Cookie'] = `next-auth.session-token=${NEXT_AUTH_SESSION}`;
    }

    const response = await fetch(`${API_BASE_URL}/wms/inventory?lowStock=false`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    throw error;
  }
}

/**
 * Analyzes inventory and identifies low stock items
 */
function analyzeLowStock(inventory: InventoryItem[]): LowStockItem[] {
  return inventory
    .filter(item => item.currentUnits < LOW_STOCK_THRESHOLD)
    .map(item => ({
      ...item,
      percentageOfThreshold: Math.round((item.currentUnits / LOW_STOCK_THRESHOLD) * 100)
    }))
    .sort((a, b) => a.currentUnits - b.currentUnits);
}

/**
 * Generates and logs the daily low stock report
 */
function generateReport(lowStockItems: LowStockItem[]): void {
  console.log('\n========================================');
  console.log('DAILY LOW STOCK REPORT');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Threshold: ${LOW_STOCK_THRESHOLD} units`);
  console.log('========================================\n');

  if (lowStockItems.length === 0) {
    console.log('✅ No items below stock threshold');
    return;
  }

  console.log(`⚠️  ${lowStockItems.length} items below threshold:\n`);

  lowStockItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.skuCode} - ${item.description}`);
    console.log(`   Warehouse: ${item.warehouseName} (${item.warehouseCode})`);
    console.log(`   Batch/Lot: ${item.batchLot}`);
    console.log(`   Current Stock: ${item.currentUnits} units (${item.currentCartons} cartons)`);
    console.log(`   ${item.percentageOfThreshold}% of threshold`);
    console.log('');
  });

  console.log('========================================\n');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('Starting WMS automation script...');

    // Validate configuration
    if (!API_KEY) {
      throw new Error('WMS_API_KEY environment variable is required');
    }

    // Fetch inventory data
    console.log('Fetching inventory data...');
    const inventory = await fetchInventory();
    console.log(`Retrieved ${inventory.length} inventory records`);

    // Analyze for low stock
    const lowStockItems = analyzeLowStock(inventory);

    // Generate report
    generateReport(lowStockItems);

    console.log('WMS automation script completed successfully');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Execute if running directly
if (require.main === module) {
  main();
}