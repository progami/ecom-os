import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { Invoice, LineItem, Contact, LineAmountTypes } from 'xero-node';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getQueue } from '@/lib/queue/queue-config';
import { structuredLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vendorId,
      vendorName,
      invoiceNumber,
      reference,
      billDate,
      dueDate,
      lineItems,
      status = 'DRAFT' // Default to draft
    } = body;

    // Validate required fields
    if (!vendorId && !vendorName) {
      return NextResponse.json(
        { error: 'Either vendorId or vendorName is required' },
        { status: 400 }
      );
    }

    if (!invoiceNumber || !reference || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceNumber, reference, and lineItems' },
        { status: 400 }
      );
    }

    // Calculate totals from line items
    let subTotal = 0;
    let totalTax = 0;
    lineItems.forEach((item: any) => {
      const lineAmount = (item.quantity || 1) * (item.unitAmount || 0);
      subTotal += lineAmount;
      // Assuming UK VAT at 20% for INPUT2 tax type
      if (item.taxType === 'INPUT2' || item.taxType === 'OUTPUT2') {
        totalTax += lineAmount * 0.20;
      }
    });
    const total = subTotal + totalTax;

    // Generate a temporary ID for the bill
    const tempBillId = crypto.randomUUID();
    const billDateObj = billDate ? new Date(billDate) : new Date();
    const dueDateObj = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      // First ensure the contact exists in our database
      let dbContact = await prisma.contact.findUnique({
        where: { xeroContactId: vendorId || '' }
      });

      if (!dbContact) {
        // Create contact in database
        dbContact = await prisma.contact.create({
          data: {
            xeroContactId: vendorId || tempBillId + '-contact',
            name: vendorName || 'Unknown Vendor',
            isSupplier: true,
            isCustomer: false,
            updatedDateUTC: new Date()
          }
        });
      }

      // Save the bill to the database with pending sync status
      const createdBill = await prisma.invoice.create({
        data: {
          xeroInvoiceId: tempBillId, // Temporary ID until synced
          invoiceNumber: invoiceNumber,
          reference: reference,
          type: 'ACCPAY',
          status: 'DRAFT', // Always start as draft in database
          total: total,
          amountDue: total, // Initially full amount is due
          amountPaid: 0,
          date: billDateObj,
          dueDate: dueDateObj,
          contactId: dbContact.xeroContactId, // Use xeroContactId for the relation
          currencyCode: 'GBP',
          subTotal: subTotal,
          totalTax: totalTax,
          updatedDateUTC: new Date(),
          needsSync: true // Flag for sync
        }
      });

      // Store line items separately for sync
      await prisma.invoiceLineItem.createMany({
        data: lineItems.map((item: any, index: number) => ({
          invoiceId: createdBill.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitAmount: item.unitAmount || 0,
          accountCode: item.accountCode,
          taxType: item.taxType || 'INPUT2',
          lineAmount: (item.quantity || 1) * (item.unitAmount || 0),
          taxAmount: item.taxType === 'INPUT2' ? ((item.quantity || 1) * (item.unitAmount || 0) * 0.20) : 0,
          itemOrder: index
        }))
      });

      // Queue the bill for sync to Xero
      const xeroSyncQueue = getQueue('xero-sync');
      await xeroSyncQueue.add('sync-new-bill', {
        billId: createdBill.id,
        invoiceNumber: invoiceNumber,
        status: status, // Desired status in Xero
        source: 'manual-creation'
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });

      structuredLogger.info('Bill created in database and queued for Xero sync', {
        component: 'bills-api',
        billId: createdBill.id,
        invoiceNumber: invoiceNumber,
        total: total
      });

      return NextResponse.json({
        success: true,
        bill: {
          invoiceID: tempBillId,
          invoiceNumber: invoiceNumber,
          reference: reference,
          status: 'DRAFT',
          total: total,
          subTotal: subTotal,
          totalTax: totalTax,
          amountDue: total,
          pendingSync: true,
          message: 'Bill created locally and queued for sync to Xero'
        },
        message: `Bill ${invoiceNumber} created successfully and will be synced to Xero`
      });

    } catch (dbError) {
      structuredLogger.error('Failed to save bill to database', dbError, {
        component: 'bills-api',
        invoiceNumber: invoiceNumber
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to create bill',
          details: dbError instanceof Error ? dbError.message : 'Database error'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    structuredLogger.error('Error processing bill creation', error, {
      component: 'bills-api'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to process bill',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch bills
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status'); // DRAFT, AUTHORISED, etc.
    const pageSize = 100;

    console.log('[Bills API] Fetching bills from SyncedInvoice table', { page, status });

    // Build where clause
    const where: any = {
      type: 'ACCPAY' // Only bills (accounts payable)
    };
    
    if (status) {
      where.status = status;
    }

    // Get total count for pagination from SyncedInvoice table
    const totalCount = await prisma.syncedInvoice.count({ where });

    // Fetch bills from SyncedInvoice table (actual data location) with pagination
    const bills = await prisma.syncedInvoice.findMany({
      where,
      orderBy: {
        lastModifiedUtc: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    // Transform bills to match expected format (SyncedInvoice has contactName directly)
    const transformedBills = bills.map(invoice => ({
      invoiceID: invoice.id, // SyncedInvoice uses id instead of xeroInvoiceId
      invoiceNumber: invoice.invoiceNumber,
      reference: invoice.reference,
      contactName: invoice.contactName, // Direct field in SyncedInvoice
      date: invoice.date,
      dueDate: invoice.dueDate,
      status: invoice.status,
      total: invoice.total.toNumber(),
      amountDue: invoice.amountDue.toNumber(),
      updatedDateUTC: invoice.lastModifiedUtc // Different field name
    }));

    console.log(`[Bills API] Successfully fetched ${transformedBills.length} bills from database`);

    return NextResponse.json({
      success: true,
      bills: transformedBills,
      count: transformedBills.length,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / pageSize),
      timestamp: new Date().toISOString(),
      source: 'database' // Indicate data is from local database
    });

  } catch (error: any) {
    console.error('Error fetching bills from database:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch bills',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}