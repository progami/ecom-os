import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '../../../../../lib/xero-client';
import { validateSession } from '../../../../../lib/auth/session-validation';
import { structuredLogger } from '../../../../../lib/logger';

// Force dynamic rendering to ensure cookies work properly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Starting verify-counts request', { 
      component: 'verify-counts',
      headers: {
        hasCookie: !!request.headers.get('cookie'),
        host: request.headers.get('host'),
        referer: request.headers.get('referer')
      }
    });

    // Validate session
    const session = await validateSession(request);
    if (!session) {
      structuredLogger.warn('Session validation failed', { component: 'verify-counts' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    structuredLogger.debug('Session validated successfully', { 
      component: 'verify-counts',
      userId: session.userId 
    });

    // Get Xero client
    structuredLogger.debug('Attempting to get Xero client', { component: 'verify-counts' });
    const xeroClient = await getXeroClient();
    
    if (!xeroClient) {
      structuredLogger.error('No Xero client available - getXeroClient returned null', undefined, { 
        component: 'verify-counts',
        userId: session.userId 
      });
      return NextResponse.json({ error: 'Xero not connected' }, { status: 400 });
    }
    
    structuredLogger.debug('Xero client obtained successfully', { 
      component: 'verify-counts',
      hasTenants: !!xeroClient.tenants,
      tenantCount: xeroClient.tenants?.length || 0
    });

    // Update tenants to get tenant ID
    await xeroClient.updateTenants();
    const tenant = xeroClient.tenants[0];
    if (!tenant || !tenant.tenantId) {
      structuredLogger.error('No active tenant found', undefined, { component: 'verify-counts' });
      return NextResponse.json({ error: 'No active Xero organization found' }, { status: 400 });
    }

    const client = xeroClient;
    const counts: any = {};

    // Note: The Xero UI typically shows AUTHORISED and PAID invoices/bills in the main views
    // However, based on cashflow-sync.ts, we also sync VOIDED invoices
    // DRAFT, SUBMITTED, and DELETED invoices are typically excluded
    // To get accurate counts, we'll match what's being synced

    // Get total invoice count (sales invoices) - AUTHORISED, PAID, and VOIDED to match sync
    structuredLogger.info('Fetching invoice count with status filter', { 
      component: 'verify-counts',
      type: 'ACCREC',
      statuses: ['AUTHORISED', 'PAID', 'VOIDED']
    });
    
    const invoicesResponse = await client.accountingApi.getInvoices(
      tenant.tenantId,
      undefined, // ifModifiedSince
      'Type=="ACCREC"', // where clause for sales invoices
      undefined, // order
      undefined, // IDs
      undefined, // invoiceNumbers
      undefined, // contactIDs
      ['AUTHORISED', 'PAID'], // statuses - exclude VOIDED to match Xero UI
      1, // page 1
      1  // pageSize 1 - we just want the total count
    );
    counts.invoices = invoicesResponse.body.pagination?.itemCount || 0;
    
    structuredLogger.info('Invoice count result', { 
      component: 'verify-counts',
      type: 'ACCREC',
      count: counts.invoices
    });

    // Get total bill count (purchase invoices) - AUTHORISED, PAID, and VOIDED to match sync
    structuredLogger.info('Fetching bill count with status filter', { 
      component: 'verify-counts',
      type: 'ACCPAY',
      statuses: ['AUTHORISED', 'PAID', 'VOIDED']
    });
    
    const billsResponse = await client.accountingApi.getInvoices(
      tenant.tenantId,
      undefined, // ifModifiedSince
      'Type=="ACCPAY"', // where clause for bills
      undefined, // order
      undefined, // IDs
      undefined, // invoiceNumbers
      undefined, // contactIDs
      ['AUTHORISED', 'PAID'], // statuses - exclude VOIDED to match Xero UI
      1, // page 1
      1  // pageSize 1 - we just want the total count
    );
    counts.bills = billsResponse.body.pagination?.itemCount || 0;
    
    structuredLogger.info('Bill count result', { 
      component: 'verify-counts',
      type: 'ACCPAY',
      count: counts.bills
    });

    // Get bank transactions count - check all pages to get exact count
    structuredLogger.info('Starting bank transaction count', { component: 'verify-counts' });
    let transactionCount = 0;
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const transactionsResponse = await client.accountingApi.getBankTransactions(
        tenant.tenantId,
        undefined, // ifModifiedSince
        undefined, // where
        undefined, // order
        page, // page
        undefined, // unitdp
        100 // pageSize
      );
      
      const transactions = transactionsResponse.body.bankTransactions || [];
      transactionCount += transactions.length;
      hasMore = transactions.length > 0; // Continue if we got any transactions
      
      if (page % 10 === 0) {
        structuredLogger.info('Transaction count progress', { 
          component: 'verify-counts',
          page,
          currentCount: transactionCount 
        });
      }
      
      // Stop if we get an empty page
      if (transactions.length === 0) {
        break;
      }
      
      page++;
    }
    
    counts.bankTransactions = transactionCount;
    structuredLogger.info('Final bank transaction count', { 
      component: 'verify-counts',
      totalCount: transactionCount,
      pagesProcessed: page - 1
    });

    // Get contacts count
    const contactsResponse = await client.accountingApi.getContacts(
      tenant.tenantId,
      undefined, // ifModifiedSince
      undefined, // where
      undefined, // order
      undefined, // IDs
      1, // page 1
      true // includeArchived
    );
    counts.contacts = contactsResponse.body.pagination?.itemCount || 0;

    // Get accounts count
    const accountsResponse = await client.accountingApi.getAccounts(
      tenant.tenantId,
      undefined, // ifModifiedSince
      undefined, // where
      undefined // order
    );
    counts.accounts = accountsResponse.body.accounts?.length || 0;

    // Additional diagnostic: Get counts by ALL statuses to understand the full picture
    const diagnostics: any = {};
    
    try {
      // Get ALL invoices (ACCREC) without status filter for diagnostics
      const allInvoicesResponse = await client.accountingApi.getInvoices(
        tenant.tenantId,
        undefined, // ifModifiedSince
        'Type=="ACCREC"', // where clause for sales invoices
        undefined, // order
        undefined, // IDs
        undefined, // invoiceNumbers
        undefined, // contactIDs
        undefined, // statuses - no filter to get ALL
        1, // page 1
        1  // pageSize 1 - we just want the total count
      );
      diagnostics.allInvoices = allInvoicesResponse.body.pagination?.itemCount || 0;

      // Get ALL bills (ACCPAY) without status filter for diagnostics
      const allBillsResponse = await client.accountingApi.getInvoices(
        tenant.tenantId,
        undefined, // ifModifiedSince
        'Type=="ACCPAY"', // where clause for bills
        undefined, // order
        undefined, // IDs
        undefined, // invoiceNumbers
        undefined, // contactIDs
        undefined, // statuses - no filter to get ALL
        1, // page 1
        1  // pageSize 1 - we just want the total count
      );
      diagnostics.allBills = allBillsResponse.body.pagination?.itemCount || 0;
      
      // Additional check: Get count with status filter but NO type filter (like syncInvoices does)
      const allTypesWithStatusResponse = await client.accountingApi.getInvoices(
        tenant.tenantId,
        undefined, // ifModifiedSince
        undefined, // where - NO TYPE FILTER (this is what syncInvoices does!)
        undefined, // order
        undefined, // IDs
        undefined, // invoiceNumbers
        undefined, // contactIDs
        ['AUTHORISED', 'PAID', 'VOIDED'], // statuses
        1, // page 1
        1  // pageSize 1
      );
      diagnostics.allTypesWithStatusFilter = allTypesWithStatusResponse.body.pagination?.itemCount || 0;
      
      // Check if excluding VOIDED matches the Xero UI counts
      const invoicesNoVoidedResponse = await client.accountingApi.getInvoices(
        tenant.tenantId,
        undefined, // ifModifiedSince
        'Type=="ACCREC"', // where clause for sales invoices
        undefined, // order
        undefined, // IDs
        undefined, // invoiceNumbers
        undefined, // contactIDs
        ['AUTHORISED', 'PAID'], // statuses - exclude VOIDED
        1, // page 1
        1  // pageSize 1
      );
      diagnostics.invoicesExcludingVoided = invoicesNoVoidedResponse.body.pagination?.itemCount || 0;
      
      const billsNoVoidedResponse = await client.accountingApi.getInvoices(
        tenant.tenantId,
        undefined, // ifModifiedSince
        'Type=="ACCPAY"', // where clause for bills
        undefined, // order
        undefined, // IDs
        undefined, // invoiceNumbers
        undefined, // contactIDs
        ['AUTHORISED', 'PAID'], // statuses - exclude VOIDED
        1, // page 1
        1  // pageSize 1
      );
      diagnostics.billsExcludingVoided = billsNoVoidedResponse.body.pagination?.itemCount || 0;
      
      structuredLogger.info('Diagnostic counts (all statuses)', { 
        component: 'verify-counts',
        allInvoices: diagnostics.allInvoices,
        allBills: diagnostics.allBills,
        filteredInvoices: counts.invoices,
        filteredBills: counts.bills,
        allTypesWithStatusFilter: diagnostics.allTypesWithStatusFilter,
        invoicesExcludingVoided: diagnostics.invoicesExcludingVoided,
        billsExcludingVoided: diagnostics.billsExcludingVoided,
        invoiceDifference: diagnostics.allInvoices - counts.invoices,
        billDifference: diagnostics.allBills - counts.bills,
        possibleSyncIssue: 'syncInvoices() does not filter by Type, so it includes both ACCREC and ACCPAY!',
        xeroUIMatch: {
          invoices: diagnostics.invoicesExcludingVoided === 146 ? 'YES' : 'NO',
          bills: diagnostics.billsExcludingVoided === 675 ? 'YES' : 'NO'
        }
      });
    } catch (diagError) {
      structuredLogger.warn('Failed to get diagnostic counts', { 
        component: 'verify-counts',
        error: diagError instanceof Error ? diagError.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: true,
      counts,
      message: 'These are the actual counts from your Xero account (AUTHORISED, PAID, and VOIDED)',
      syncComparison: {
        invoices: { xero: counts.invoices, expected: 146, synced: 1021, match: counts.invoices === 146 },
        bills: { xero: counts.bills, expected: 675, synced: 807, match: counts.bills === 675 },
        contacts: { xero: counts.contacts, synced: 282, match: counts.contacts === 282 },
        bankTransactions: { xero: counts.bankTransactions, synced: 3305 }
      },
      diagnostics: {
        note: 'These counts include ALL statuses (DRAFT, DELETED, VOIDED, etc.)',
        allInvoices: diagnostics.allInvoices,
        allBills: diagnostics.allBills,
        allTypesWithStatusFilter: diagnostics.allTypesWithStatusFilter,
        invoicesExcludingVoided: diagnostics.invoicesExcludingVoided,
        billsExcludingVoided: diagnostics.billsExcludingVoided,
        excludedInvoices: diagnostics.allInvoices - counts.invoices,
        excludedBills: diagnostics.allBills - counts.bills,
        syncIssue: 'The syncInvoices() method does not filter by Type, so it syncs both ACCREC and ACCPAY together!',
        recommendation: diagnostics.invoicesExcludingVoided === 146 ? 
          'The Xero UI shows AUTHORISED and PAID only (excluding VOIDED)' : 
          'Additional filters may be needed to match Xero UI'
      }
    });

  } catch (error: any) {
    structuredLogger.error('Error fetching Xero counts', error);
    return NextResponse.json(
      { error: 'Failed to fetch Xero counts', details: error.message },
      { status: 500 }
    );
  }
}