import { prisma } from '@/lib/prisma';
import { XeroClient } from 'xero-node';
import { structuredLogger } from '@/lib/logger';
import { 
  addDays, 
  addMonths, 
  startOfMonth,
  endOfMonth,
  setDate,
  getQuarter,
  startOfQuarter,
  endOfQuarter,
  addQuarters,
  parse,
  format
} from 'date-fns';

interface TaxObligation {
  type: 'VAT' | 'PAYE_NI' | 'CORPORATION_TAX';
  dueDate: Date;
  amount: number;
  periodStart?: Date;
  periodEnd?: Date;
  reference?: string;
  notes?: string;
}

interface OrganizationDetails {
  financialYearEnd: { month: number; day: number };
  vatScheme: 'STANDARD' | 'CASH' | 'FLAT_RATE' | 'NONE';
  vatReturns: 'MONTHLY' | 'QUARTERLY';
  registrationNumber?: string;
}

export class UKTaxCalculator {
  private xero?: XeroClient;
  private tenantId?: string;

  constructor(xero?: XeroClient, tenantId?: string) {
    this.xero = xero;
    this.tenantId = tenantId;
  }

  async calculateUpcomingTaxes(days: number): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    const today = new Date();
    const endDate = addDays(today, days);

    // Get organization details if Xero client is available
    const orgDetails = this.xero && this.tenantId 
      ? await this.getOrganizationDetails()
      : this.getDefaultOrganizationDetails();

    // Calculate VAT obligations
    const vatObligations = await this.calculateVATObligations(today, endDate, orgDetails);
    obligations.push(...vatObligations);

    // Calculate PAYE/NI obligations
    const payeObligations = await this.calculatePAYEObligations(today, endDate);
    obligations.push(...payeObligations);

    // Calculate Corporation Tax obligations
    const ctObligations = await this.calculateCorporationTaxObligations(today, endDate, orgDetails);
    obligations.push(...ctObligations);

    return obligations;
  }

  private async getOrganizationDetails(): Promise<OrganizationDetails> {
    if (!this.tenantId) {
      return this.getDefaultOrganizationDetails();
    }

    try {
      // Get organization details from database
      const orgSettings = await prisma.systemSetting.findFirst({
        where: {
          category: 'organization',
          isActive: true
        }
      });
      
      if (!orgSettings || !orgSettings.value) {
        return this.getDefaultOrganizationDetails();
      }

      const orgData = JSON.parse(orgSettings.value as string);
      
      // Parse financial year end
      let financialYearEnd = { month: 3, day: 31 }; // Default March 31
      if (orgData.periodLockDate) {
        const lockDate = new Date(orgData.periodLockDate);
        financialYearEnd = {
          month: lockDate.getMonth() + 1,
          day: lockDate.getDate()
        };
      }

      // Determine VAT scheme from stored settings
      const vatScheme = orgData.salesTaxBasis === 'CASH' ? 'CASH' : 'STANDARD';
      const vatReturns = orgData.salesTaxPeriod === 'MONTHLY' ? 'MONTHLY' : 'QUARTERLY';

      return {
        financialYearEnd,
        vatScheme,
        vatReturns,
        registrationNumber: orgData.registrationNumber
      };
    } catch (error) {
      structuredLogger.error('Error fetching organization details from database:', error);
      return this.getDefaultOrganizationDetails();
    }
  }

  private getDefaultOrganizationDetails(): OrganizationDetails {
    return {
      financialYearEnd: { month: 3, day: 31 }, // March 31
      vatScheme: 'STANDARD',
      vatReturns: 'QUARTERLY',
    };
  }

  private async calculateVATObligations(
    startDate: Date,
    endDate: Date,
    orgDetails: OrganizationDetails
  ): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    
    // Get VAT liability from balance sheet accounts
    const vatLiability = await this.getVATLiability();
    
    // Validate VAT liability
    if (isNaN(vatLiability) || vatLiability < 0) {
      structuredLogger.warn('[UKTaxCalculator] Invalid VAT liability:', vatLiability);
      return obligations;
    }
    
    if (orgDetails.vatReturns === 'QUARTERLY') {
      // Calculate quarterly VAT obligations
      let currentDate = startDate;
      
      while (currentDate <= endDate) {
        const quarterEnd = endOfQuarter(currentDate);
        const dueDate = addDays(quarterEnd, 37); // 1 month + 7 days
        
        if (dueDate >= startDate && dueDate <= endDate) {
          const quarterlyAmount = vatLiability / 4;
          obligations.push({
            type: 'VAT',
            dueDate,
            amount: isNaN(quarterlyAmount) ? 0 : quarterlyAmount, // Estimate quarterly portion
            periodStart: startOfQuarter(currentDate),
            periodEnd: quarterEnd,
            reference: `VAT Q${getQuarter(currentDate)} ${format(currentDate, 'yyyy')}`,
            notes: 'Quarterly VAT return'
          });
        }
        
        currentDate = addQuarters(currentDate, 1);
      }
    } else {
      // Monthly VAT returns
      let currentDate = startOfMonth(startDate);
      
      while (currentDate <= endDate) {
        const monthEnd = endOfMonth(currentDate);
        const dueDate = addDays(monthEnd, 37); // 1 month + 7 days
        
        if (dueDate >= startDate && dueDate <= endDate) {
          const monthlyAmount = vatLiability / 12;
          obligations.push({
            type: 'VAT',
            dueDate,
            amount: isNaN(monthlyAmount) ? 0 : monthlyAmount, // Estimate monthly portion
            periodStart: currentDate,
            periodEnd: monthEnd,
            reference: `VAT ${format(currentDate, 'MMM yyyy')}`,
            notes: 'Monthly VAT return'
          });
        }
        
        currentDate = addMonths(currentDate, 1);
      }
    }

    return obligations;
  }

  private async calculatePAYEObligations(
    startDate: Date,
    endDate: Date
  ): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    
    // Get PAYE/NI liabilities from balance sheet
    const payeLiability = await this.getPAYELiability();
    
    // Validate PAYE liability
    if (isNaN(payeLiability) || payeLiability < 0) {
      structuredLogger.warn('[UKTaxCalculator] Invalid PAYE liability:', payeLiability);
      return obligations;
    }
    
    // PAYE is due by 22nd of following month (19th if paying electronically)
    let currentDate = startOfMonth(startDate);
    
    while (currentDate <= endDate) {
      const dueDate = setDate(addMonths(currentDate, 1), 22);
      
      if (dueDate >= startDate && dueDate <= endDate) {
        obligations.push({
          type: 'PAYE_NI',
          dueDate,
          amount: payeLiability, // Monthly amount
          periodStart: currentDate,
          periodEnd: endOfMonth(currentDate),
          reference: `PAYE/NI ${format(currentDate, 'MMM yyyy')}`,
          notes: 'Monthly PAYE and NI payment'
        });
      }
      
      currentDate = addMonths(currentDate, 1);
    }

    return obligations;
  }

  private async calculateCorporationTaxObligations(
    startDate: Date,
    endDate: Date,
    orgDetails: OrganizationDetails
  ): Promise<TaxObligation[]> {
    const obligations: TaxObligation[] = [];
    
    // Get annual profit estimate
    const annualProfit = await this.getAnnualProfitEstimate();
    
    // Determine tax rate
    const taxRate = annualProfit > 250000 ? 0.25 : 0.19;
    const taxAmount = annualProfit * taxRate;
    
    // Validate tax amount
    if (isNaN(taxAmount) || taxAmount < 0) {
      structuredLogger.warn('[UKTaxCalculator] Invalid tax amount calculated:', { annualProfit, taxRate, taxAmount });
      return obligations;
    }
    
    // Calculate year end for current and next year
    const currentYear = new Date().getFullYear();
    
    for (let year = currentYear; year <= currentYear + 1; year++) {
      const yearEnd = new Date(
        year,
        orgDetails.financialYearEnd.month - 1,
        orgDetails.financialYearEnd.day
      );
      
      // CT is due 9 months and 1 day after year end
      const dueDate = addDays(addMonths(yearEnd, 9), 1);
      
      if (dueDate >= startDate && dueDate <= endDate) {
        obligations.push({
          type: 'CORPORATION_TAX',
          dueDate,
          amount: taxAmount,
          periodStart: addDays(yearEnd, -364), // Approximate year start
          periodEnd: yearEnd,
          reference: `CT FY${format(yearEnd, 'yyyy')}`,
          notes: `Corporation tax for year ending ${format(yearEnd, 'dd/MM/yyyy')}`
        });
      }
    }

    return obligations;
  }

  private async getVATLiability(): Promise<number> {
    try {
      // Get VAT liability from database GL accounts instead of Xero
      if (!this.tenantId) {
        structuredLogger.warn('[UKTaxCalculator] No tenant ID available for VAT calculation');
        return 0;
      }

      // Fetch VAT liability from database GL accounts
      const vatAccounts = await prisma.gLAccount.findMany({
        where: {
          OR: [
            { code: { in: ['820', '821', '822', '823', '824', '825'] } }, // Common UK VAT codes
            { name: { contains: 'VAT', mode: 'insensitive' } },
            { name: { contains: 'GST', mode: 'insensitive' } },
            { reportingCode: { in: ['LIAB.CUR.OUTPUT', 'LIAB.CUR.INPUT'] } }
          ],
          class: 'LIABILITY',
          status: 'ACTIVE'
        }
      });

      // Calculate total VAT liability from account balances
      let totalVATLiability = 0;
      for (const account of vatAccounts) {
        if (account.balance) {
          // Liability accounts typically have negative balances
          totalVATLiability += account.balance.abs().toNumber();
        }
      }
      
      structuredLogger.info('[UKTaxCalculator] VAT liability from database:', {
        vatLiability: totalVATLiability,
        accountCount: vatAccounts.length,
        source: 'database_gl_accounts'
      });

      // For cash flow purposes, only return positive liabilities
      return Math.max(0, totalVATLiability);
    } catch (error) {
      structuredLogger.error('[UKTaxCalculator] Error fetching VAT liability from database:', error);
      return 0;
    }
  }

  private async getPAYELiability(): Promise<number> {
    try {
      // Get PAYE liability from GL account balances instead of calculating from transactions
      if (!this.tenantId) {
        structuredLogger.warn('[UKTaxCalculator] No tenant ID available for PAYE calculation');
        return 0;
      }

      // Get PAYE/NI liability accounts from GL accounts
      const payeAccounts = await prisma.gLAccount.findMany({
        where: {
          OR: [
            { code: { in: ['814', '825', '826'] } }, // Common PAYE/NI codes
            { name: { contains: 'PAYE' } },
            { name: { contains: 'National Insurance' } }
          ],
          class: 'LIABILITY',
          status: 'ACTIVE'
        }
      });

      if (payeAccounts.length === 0) {
        structuredLogger.info('[UKTaxCalculator] No PAYE liability accounts found');
        return 0;
      }

      // Sum up the balances from PAYE liability accounts
      // These balances are from Xero's authoritative GL data
      let totalPAYELiability = 0;
      for (const account of payeAccounts) {
        const balance = account.balance?.toNumber() || 0;
        // Liability accounts typically have negative balances in Xero
        totalPAYELiability += Math.abs(balance);
        
        structuredLogger.debug('[UKTaxCalculator] PAYE account:', {
          code: account.code,
          name: account.name,
          balance: balance,
          absBalance: Math.abs(balance)
        });
      }

      structuredLogger.info('[UKTaxCalculator] PAYE liability from GL accounts:', {
        totalPAYELiability,
        accountCount: payeAccounts.length,
        source: 'database_gl_accounts'
      });

      return totalPAYELiability;
    } catch (error) {
      structuredLogger.error('[UKTaxCalculator] Error fetching PAYE liability from GL accounts:', error);
      return 0;
    }
  }

  private async getAnnualProfitEstimate(): Promise<number> {
    try {
      // Get annual profit from database GL accounts
      if (!this.tenantId) {
        structuredLogger.warn('[UKTaxCalculator] No tenant ID available for profit calculation');
        return 0;
      }

      // Get revenue and expense accounts from database
      const [revenueAccounts, expenseAccounts] = await Promise.all([
        prisma.gLAccount.findMany({
          where: {
            class: 'REVENUE',
            status: 'ACTIVE'
          }
        }),
        prisma.gLAccount.findMany({
          where: {
            class: 'EXPENSE',
            status: 'ACTIVE'
          }
        })
      ]);
      
      // Calculate totals
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      for (const account of revenueAccounts) {
        if (account.balance) {
          totalRevenue += account.balance.abs().toNumber();
        }
      }
      
      for (const account of expenseAccounts) {
        if (account.balance) {
          totalExpenses += account.balance.abs().toNumber();
        }
      }
      
      const netProfit = totalRevenue - totalExpenses;
      
      structuredLogger.info('[UKTaxCalculator] Annual profit from database:', {
        netProfit,
        revenue: totalRevenue,
        expenses: totalExpenses,
        period: 'current GL balances',
        source: 'database_gl_accounts'
      });

      // For tax estimation purposes, only return positive profits
      // Losses should be handled separately for tax calculations
      return Math.max(0, netProfit);
    } catch (error) {
      structuredLogger.error('[UKTaxCalculator] Error fetching annual profit from database:', error);
      return 0;
    }
  }

  // Helper method to store calculated tax obligations
  async storeTaxObligations(obligations: TaxObligation[]): Promise<void> {
    for (const obligation of obligations) {
      // Check if obligation already exists
      const existing = await prisma.taxObligation.findFirst({
        where: {
          type: obligation.type,
          dueDate: obligation.dueDate,
          status: 'PENDING'
        }
      });

      if (!existing) {
        await prisma.taxObligation.create({
          data: {
            ...obligation,
            status: 'PENDING'
          }
        });
      }
    }
  }

  // Calculate tax payments for a specific date range
  async getTaxPaymentsForDateRange(startDate: Date, endDate: Date): Promise<TaxObligation[]> {
    const obligations = await prisma.taxObligation.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate
        },
        status: 'PENDING'
      },
      orderBy: { dueDate: 'asc' }
    });

    return obligations.map(ob => ({
      type: ob.type as 'VAT' | 'PAYE_NI' | 'CORPORATION_TAX',
      dueDate: ob.dueDate,
      amount: ob.amount,
      periodStart: ob.periodStart || undefined,
      periodEnd: ob.periodEnd || undefined,
      reference: ob.reference || undefined,
      notes: ob.notes || undefined
    }));
  }
}