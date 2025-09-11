// src/app/api/csv-data/route.ts

import { NextResponse } from 'next/server';
import { importAllCSVData } from '@/lib/dataImporter';
import { validateCSVData } from '@/lib/dataValidator';
import logger from '@/utils/logger';

export async function GET() {
  try {
    // Import all CSV data
    const csvData = await importAllCSVData();
    
    // Validate the data
    const validation = validateCSVData(csvData);
    
    // Return data with validation info
    return NextResponse.json({
      ...csvData,
      _validation: validation
    });
  } catch (error) {
    logger.error('Error loading CSV data:', error);
    return NextResponse.json(
      { error: 'Failed to load CSV data' },
      { status: 500 }
    );
  }
}