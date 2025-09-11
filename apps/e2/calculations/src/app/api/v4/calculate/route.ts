// src/app/api/v4/calculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { UserInputs } from '@/types/v4/financial';
import { FinancialModelEngine } from '@/lib/engine/FinancialModelEngine';
import logger from '@/utils/logger';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const userInputs: UserInputs = await req.json();
    
    // Create and run the financial model engine
    const engine = new FinancialModelEngine(userInputs);
    
    // Validate inputs
    const validation = engine.validateInputs();
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid inputs', 
          errors: validation.errors 
        },
        { status: 400 }
      );
    }
    
    // Run the forecast
    const financialStatements = engine.runForecast();
    
    // Return the results
    return NextResponse.json(financialStatements);
    
  } catch (error) {
    logger.error('Calculation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Calculation failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to retrieve sample data or schema
export async function GET(req: NextRequest) {
  // Return sample/example input structure for documentation
  const sampleInputs: UserInputs = {
    salesForecast: [
      {
        sku: 'SAMPLE-001',
        monthlySales: [
          { month: 1, unitsSold: 100, ppcSpend: 500, retailPrice: 49.99 }, // example data
          { month: 2, unitsSold: 120, ppcSpend: 600, retailPrice: 49.99 } // example data
          // ... more months
        ]
      }
    ],
    operatingExpenses: [
      {
        id: 'exp_sample',
        name: 'Sample Expense',
        amount: 1000,
        startMonth: 1,
        frequency: 'Monthly',
        category: 'Rent'
      }
    ],
    inventoryRules: {
      targetMonthsOfSupply: 3,
      supplierPaymentTerms: [
        { percentage: 30, daysAfterPO: 0 },
        { percentage: 70, daysAfterPO: 30 }
      ]
    },
    productDetails: [
      {
        sku: 'SAMPLE-001',
        manufacturingCost: 15.00,
        freightCost: 2.50,
        fulfillmentFee: 3.45,
        amazonReferralFeeRate: 0.15
      }
    ],
    taxRate: 0.25, // example tax rate
    openingCash: 50000,
    openingRetainedEarnings: 0
  };
  
  return NextResponse.json({
    message: 'POST to this endpoint with UserInputs to calculate forecast',
    sampleInputStructure: sampleInputs,
    documentation: {
      salesForecast: 'Array of SKUs with monthly sales projections',
      operatingExpenses: 'Array of all operating expenses with timing and amounts',
      inventoryRules: 'Rules for inventory management and supplier payment terms',
      productDetails: 'Cost structure for each SKU',
      taxRate: 'Corporate tax rate (0-1)',
      openingCash: 'Starting cash balance',
      openingRetainedEarnings: 'Starting retained earnings (can be negative)'
    }
  });
}