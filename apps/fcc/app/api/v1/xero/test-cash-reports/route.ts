import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { getTenantId } from '@/lib/xero-helpers';
import { executeXeroAPICall } from '@/lib/xero-api-wrapper';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'No Xero tenant ID found' }, { status: 401 });
    }

    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      return NextResponse.json({ error: 'Xero client not available' }, { status: 500 });
    }

    const results: any = {};

    // Test 1: Try Bank Summary report
    try {
      console.log('Testing Bank Summary...');
      const bankSummary = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportBankSummary(
          tenantId,
          new Date('2024-01-01'),
          new Date('2024-12-31')
        )
      );
      results.bankSummary = {
        success: true,
        data: bankSummary?.body?.reports?.[0]
      };
    } catch (error: any) {
      results.bankSummary = {
        success: false,
        error: error.message || 'Failed to fetch bank summary'
      };
    }

    // Test 2: Get all available report types
    try {
      console.log('Getting report list...');
      // This is a workaround - try to get report list by checking method names
      const accountingApi = xeroClient.accountingApi;
      const reportMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(accountingApi))
        .filter(method => method.startsWith('getReport'))
        .sort();
      
      results.availableReportMethods = reportMethods;
    } catch (error: any) {
      results.availableReportMethods = [];
    }

    // Test 3: Try Cash Validation report
    try {
      console.log('Testing Cash Validation...');
      const cashValidation = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => (client.accountingApi as any).getReportCashValidation?.(
          tenantId,
          new Date('2024-12-31')
        )
      );
      results.cashValidation = {
        success: true,
        data: cashValidation?.body?.reports?.[0]
      };
    } catch (error: any) {
      results.cashValidation = {
        success: false,
        error: error.message || 'Cash validation not available'
      };
    }

    // Test 4: Get Bank Accounts to calculate cash position
    try {
      console.log('Getting bank accounts...');
      const accounts = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getAccounts(
          tenantId,
          undefined,
          'Type=="BANK"'
        )
      );
      
      const bankAccounts = accounts?.body?.accounts || [];
      let totalCash = 0;
      const cashAccounts = bankAccounts.map((account: any) => {
        totalCash += account.balance || 0;
        return {
          accountId: account.accountID,
          accountName: account.name,
          balance: account.balance || 0,
          code: account.code,
          status: account.status
        };
      });
      
      results.cashPosition = {
        success: true,
        totalCash,
        accounts: cashAccounts,
        asOf: new Date().toISOString()
      };
    } catch (error: any) {
      results.cashPosition = {
        success: false,
        error: error.message || 'Failed to get cash position'
      };
    }

    // Test 5: Try Statement of Cash Flows (if available)
    try {
      console.log('Testing Statement of Cash Flows...');
      // Try different possible method names
      const possibleMethods = [
        'getReportStatementOfCashFlows',
        'getReportCashFlow',
        'getReportCashFlows',
        'getStatementOfCashFlows'
      ];
      
      for (const methodName of possibleMethods) {
        try {
          const cashFlowReport = await executeXeroAPICall<any>(
            xeroClient,
            tenantId,
            (client) => {
              const method = (client.accountingApi as any)[methodName];
              if (method) {
                return method.call(
                  client.accountingApi,
                  tenantId,
                  new Date('2024-01-01'),
                  new Date('2024-12-31')
                );
              }
              throw new Error(`Method ${methodName} not found`);
            }
          );
          
          results.cashFlowStatement = {
            success: true,
            methodUsed: methodName,
            data: cashFlowReport?.body?.reports?.[0]
          };
          break;
        } catch (error) {
          // Try next method
        }
      }
      
      if (!results.cashFlowStatement) {
        results.cashFlowStatement = {
          success: false,
          error: 'No cash flow statement method found'
        };
      }
    } catch (error: any) {
      results.cashFlowStatement = {
        success: false,
        error: error.message || 'Cash flow statement not available'
      };
    }

    // Test 6: Check Finance API availability
    try {
      console.log('Checking Finance API...');
      const financeApi = (xeroClient as any).financeApi;
      if (financeApi) {
        results.financeApiAvailable = true;
        
        // Try to get cash flow from Finance API
        try {
          const financeCashFlow = await executeXeroAPICall<any>(
            xeroClient,
            tenantId,
            (client) => (client as any).financeApi.getFinancialStatementCashflow(
              tenantId,
              '2024-01-01',
              '2024-12-31'
            )
          );
          
          results.financeCashFlow = {
            success: true,
            data: financeCashFlow?.body
          };
        } catch (error: any) {
          results.financeCashFlow = {
            success: false,
            error: error.message || 'Finance API cash flow not available'
          };
        }
      } else {
        results.financeApiAvailable = false;
      }
    } catch (error: any) {
      results.financeApiAvailable = false;
    }

    structuredLogger.info('[Cash Reports Test] Completed all tests', {
      component: 'cash-reports-test',
      results
    });

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    structuredLogger.error('[Cash Reports Test] Error', error, {
      component: 'cash-reports-test'
    });

    return NextResponse.json(
      { error: 'Failed to test cash reports', details: error.message },
      { status: 500 }
    );
  }
}