import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'
import logger from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { strategyId, reports } = await request.json()
    
    if (!strategyId || !reports) {
      return NextResponse.json({ error: 'Missing strategyId or reports' }, { status: 400 })
    }
    
    // Delete existing reports for this strategy
    await prisma.$transaction([
      prisma.incomeStatement.deleteMany({ where: { strategyId } }),
      prisma.balanceSheet.deleteMany({ where: { strategyId } }),
      prisma.cashFlowStatement.deleteMany({ where: { strategyId } })
    ])
    
    let incomeStatements = []
    let balanceSheets = []
    let cashFlowStatements = []
    
    // Process each period's reports
    for (const [period, periodReports] of Object.entries(reports)) {
      const [year, quarter, month] = period.includes('Q') 
        ? [parseInt(period.split(' ')[0]), parseInt(period.split('Q')[1]), null]
        : period.includes('-') 
        ? [parseInt(period.split('-')[0]), null, parseInt(period.split('-')[1])]
        : [parseInt(period), null, null]
      
      const periodType = quarter ? 'quarterly' : month ? 'monthly' : 'yearly'
      
      // Income Statement
      if (periodReports.incomeStatement) {
        const is = periodReports.incomeStatement
        incomeStatements.push({
          strategyId,
          period,
          periodType,
          year,
          quarter,
          month,
          
          // Revenue
          amazonSales: parseFloat(is.amazonSales || 0),
          amazonFbaInventoryReimbursement: parseFloat(is.amazonFbaInventoryReimbursement || 0),
          cashbackRewards: parseFloat(is.cashbackRewards || 0),
          totalRevenue: parseFloat(is.totalRevenue || 0),
          
          // COGS
          costOfGoodsSold: parseFloat(is.costOfGoodsSold || 0),
          manufacturing: parseFloat(is.manufacturing || 0),
          freightCustomDuty: parseFloat(is.freightCustomDuty || 0),
          landFreight: parseFloat(is.landFreight || 0),
          storage3pl: parseFloat(is.storage3pl || 0),
          vatTariffs: parseFloat(is.vatTariffs || 0),
          totalCOGS: parseFloat(is.totalCOGS || 0),
          grossProfit: parseFloat(is.grossProfit || 0),
          
          // Amazon Expenses
          amazonSellerFees: parseFloat(is.amazonSellerFees || 0),
          amazonFbaFees: parseFloat(is.amazonFbaFees || 0),
          amazonStorageFees: parseFloat(is.amazonStorageFees || 0),
          inventoryAdjustments: parseFloat(is.inventoryAdjustments || 0),
          refunds: parseFloat(is.refunds || 0),
          referralFees: parseFloat(is.referralFees || 0),
          totalAmazonExpenses: parseFloat(is.totalAmazonExpenses || 0),
          
          // Operating Expenses
          payroll: parseFloat(is.payroll || 0),
          payrollTax: parseFloat(is.payrollTax || 0),
          contractSalaries: parseFloat(is.contractSalaries || 0),
          freelanceServices: parseFloat(is.freelanceServices || 0),
          membersRemuneration: parseFloat(is.membersRemuneration || 0),
          rent: parseFloat(is.rent || 0),
          utilities: parseFloat(is.utilities || 0),
          telephoneInternet: parseFloat(is.telephoneInternet || 0),
          officeSupplies: parseFloat(is.officeSupplies || 0),
          insurance: parseFloat(is.insurance || 0),
          advertising: parseFloat(is.advertising || 0),
          professionalFees: parseFloat(is.professionalFees || 0),
          legalCompliance: parseFloat(is.legalCompliance || 0),
          accounting: parseFloat(is.accounting || 0),
          itSoftware: parseFloat(is.itSoftware || 0),
          researchDevelopment: parseFloat(is.researchDevelopment || 0),
          bankFees: parseFloat(is.bankFees || 0),
          interestPaid: parseFloat(is.interestPaid || 0),
          bankRevaluations: parseFloat(is.bankRevaluations || 0),
          unrealisedCurrencyGains: parseFloat(is.unrealisedCurrencyGains || 0),
          realisedCurrencyGains: parseFloat(is.realisedCurrencyGains || 0),
          travel: parseFloat(is.travel || 0),
          mealsEntertainment: parseFloat(is.mealsEntertainment || 0),
          depreciationExpense: parseFloat(is.depreciationExpense || 0),
          generalOperatingExpenses: parseFloat(is.generalOperatingExpenses || 0),
          otherExpenses: parseFloat(is.otherExpenses || 0),
          totalOperatingExpenses: parseFloat(is.totalOperatingExpenses || 0),
          
          // Totals
          totalExpenses: parseFloat(is.totalExpenses || 0),
          netIncome: parseFloat(is.netIncome || 0)
        })
      }
      
      // Balance Sheet
      if (periodReports.balanceSheet) {
        const bs = periodReports.balanceSheet
        balanceSheets.push({
          strategyId,
          period,
          periodType,
          year,
          quarter,
          month,
          
          // Assets
          businessBankAccount: parseFloat(bs.businessBankAccount || 0),
          inventory: parseFloat(bs.inventory || 0),
          prepayments: parseFloat(bs.prepayments || 0),
          amazonReceivable: parseFloat(bs.amazonReceivable || 0),
          amazonReservedBalances: parseFloat(bs.amazonReservedBalances || 0),
          amazonSplitMonthRollovers: parseFloat(bs.amazonSplitMonthRollovers || 0),
          otherDebtors: parseFloat(bs.otherDebtors || 0),
          officeEquipment: parseFloat(bs.officeEquipment || 0),
          accumulatedDepreciation: parseFloat(bs.accumulatedDepreciation || 0),
          totalAssets: parseFloat(bs.totalAssets || 0),
          
          // Liabilities
          salesTaxPayable: parseFloat(bs.salesTaxPayable || 0),
          payrollTaxPayable: parseFloat(bs.payrollTaxPayable || 0),
          membersLoanAccount: parseFloat(bs.membersLoanAccount || 0),
          rounding: parseFloat(bs.rounding || 0),
          totalLiabilities: parseFloat(bs.totalLiabilities || 0),
          
          // Equity
          memberInvestmentJarrar: parseFloat(bs.memberInvestmentJarrar || 0),
          memberInvestmentAbdul: parseFloat(bs.memberInvestmentAbdul || 0),
          memberInvestmentAmjad: parseFloat(bs.memberInvestmentAmjad || 0),
          capitalMemberUnits: parseFloat(bs.capitalMemberUnits || 0),
          retainedEarnings: parseFloat(bs.retainedEarnings || 0),
          memberDistributions: parseFloat(bs.memberDistributions || 0),
          totalEquity: parseFloat(bs.totalEquity || 0),
          totalLiabilitiesEquity: parseFloat(bs.totalLiabilitiesEquity || 0)
        })
      }
      
      // Cash Flow Statement
      if (periodReports.cashFlowStatement) {
        const cf = periodReports.cashFlowStatement
        cashFlowStatements.push({
          strategyId,
          period,
          periodType,
          year,
          quarter,
          month,
          
          // Operating Activities
          netIncome: parseFloat(cf.netIncome || 0),
          depreciationAmortization: parseFloat(cf.depreciationAmortization || 0),
          changeInInventory: parseFloat(cf.changeInInventory || 0),
          changeInAmazonReceivable: parseFloat(cf.changeInAmazonReceivable || 0),
          changeInPrepayments: parseFloat(cf.changeInPrepayments || 0),
          changeInOtherDebtors: parseFloat(cf.changeInOtherDebtors || 0),
          changeInSalesTaxPayable: parseFloat(cf.changeInSalesTaxPayable || 0),
          changeInPayrollTaxPayable: parseFloat(cf.changeInPayrollTaxPayable || 0),
          changeInMembersLoanAccount: parseFloat(cf.changeInMembersLoanAccount || 0),
          netCashFromOperating: parseFloat(cf.netCashFromOperating || 0),
          
          // Investing Activities
          purchaseOfficeEquipment: parseFloat(cf.purchaseOfficeEquipment || 0),
          netCashFromInvesting: parseFloat(cf.netCashFromInvesting || 0),
          
          // Financing Activities
          memberInvestments: parseFloat(cf.memberInvestments || 0),
          memberDistributions: parseFloat(cf.memberDistributions || 0),
          netCashFromFinancing: parseFloat(cf.netCashFromFinancing || 0),
          
          // Cash Flow Summary
          netChangeInCash: parseFloat(cf.netChangeInCash || 0),
          beginningCashBalance: parseFloat(cf.beginningCashBalance || 0),
          endingCashBalance: parseFloat(cf.endingCashBalance || 0)
        })
      }
    }
    
    // Save all reports in a transaction
    await prisma.$transaction([
      ...(incomeStatements.length > 0 ? [prisma.incomeStatement.createMany({ data: incomeStatements })] : []),
      ...(balanceSheets.length > 0 ? [prisma.balanceSheet.createMany({ data: balanceSheets })] : []),
      ...(cashFlowStatements.length > 0 ? [prisma.cashFlowStatement.createMany({ data: cashFlowStatements })] : [])
    ])
    
    return NextResponse.json({ 
      success: true,
      saved: {
        incomeStatements: incomeStatements.length,
        balanceSheets: balanceSheets.length,
        cashFlowStatements: cashFlowStatements.length
      }
    })
    
  } catch (error) {
    logger.error('Error saving financial reports:', error)
    return NextResponse.json(
      { error: 'Failed to save financial reports' },
      { status: 500 }
    )
  }
}