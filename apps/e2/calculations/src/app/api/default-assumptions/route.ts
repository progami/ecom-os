// src/app/api/default-assumptions/route.ts

import { NextResponse } from 'next/server';
import { createDefaultAssumptions } from '@/lib/dataImporter';
import logger from '@/utils/logger';

export async function GET() {
  try {
    // Create default assumptions from CSV data
    const assumptions = await createDefaultAssumptions();
    
    return NextResponse.json(assumptions);
  } catch (error) {
    logger.error('Error creating default assumptions:', error);
    return NextResponse.json(
      { error: 'Failed to create default assumptions' },
      { status: 500 }
    );
  }
}