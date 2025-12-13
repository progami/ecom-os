import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Fetching vendors from database');

    // Get all active suppliers/vendors from database
    const vendors = await prisma.contact.findMany({
      where: {
        isSupplier: true,
        contactStatus: 'ACTIVE'
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Transform vendors to match expected format
    const transformedVendors = vendors.map(contact => ({
      id: contact.xeroContactId,
      name: contact.name,
      email: contact.emailAddress,
      isSupplier: contact.isSupplier,
      isCustomer: contact.isCustomer,
      taxNumber: contact.taxNumber,
      accountNumber: contact.accountNumber,
      status: contact.contactStatus,
      addresses: [], // We don't store addresses in the Contact model
      phones: [], // We don't store phones in the Contact model
      // Include default currency if set
      defaultExpenseAccount: contact.defaultCurrency
    }));

    structuredLogger.info('Successfully fetched vendors from database', {
      vendorCount: transformedVendors.length
    });

    // Cache the response for 5 minutes
    return NextResponse.json(
      {
        success: true,
        vendors: transformedVendors,
        count: transformedVendors.length,
        timestamp: new Date().toISOString(),
        source: 'database' // Indicate data is from local database
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300'
        }
      }
    );
  } catch (error: any) {
    structuredLogger.error('Error fetching vendors from database:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch vendors',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}