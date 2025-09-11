import { NextRequest, NextResponse } from 'next/server'
import { getWeekNumber, getWeekDateRange, getWeeksInYear } from '@/lib/utils/weekHelpers'
import { v4 as uuidv4 } from 'uuid'
import logger from '@/utils/logger'
import { getAccount, CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'
import { prisma } from '@/utils/database'

// Helper function to safely convert to number with NaN validation
function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value)
  if (isNaN(num) || !isFinite(num)) {
    logger.warn(`Invalid number conversion: ${value}`)
    return fallback
  }
  return num
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const quarter = parseInt(searchParams.get('quarter') || '1')
    
    // Calculate week range for the quarter
    const startWeek = (quarter - 1) * 13 + 1
    const weeksInYear = getWeeksInYear(year)
    const endWeek = quarter === 4 ? weeksInYear : Math.min(quarter * 13, 52)
    
    // Get date range for the quarter
    const startWeekRange = getWeekDateRange(year, startWeek)
    const endWeekRange = getWeekDateRange(year, endWeek)
    
    // Get active strategy first
    const activeStrategy = await prisma.budgetStrategy.findFirst({
      where: { isActive: true }
    })
    
    // Run remaining queries in parallel
    const [recurringExpenses, amazonGLEntries, cogsGLEntries] = await Promise.all([
      // This will be executed after activeStrategy is retrieved but we'll filter in memory
      prisma.expense.findMany({
        where: {
          weekStarting: {
            gte: startWeekRange.start,
            lte: endWeekRange.end
          },
          isCOGS: false,
          category: { not: 'advertising' },
          ...(activeStrategy && { strategyId: activeStrategy.id })
        },
        orderBy: [
          { weekStarting: 'asc' },
          { category: 'asc' }
        ]
      }),
      
      // Fetch Amazon fees from expense table (created by unit sales)
      prisma.expense.findMany({
        where: {
          weekStarting: {
            gte: startWeekRange.start,
            lte: endWeekRange.end
          },
          OR: [
            { category: 'FBA Fulfillment Fee' },
            { category: 'FBA_FEES' },
            { category: 'Referral Fee' },
            { category: 'Amazon Storage' },
            { category: 'Advertising' }
          ],
          ...(activeStrategy && { strategyId: activeStrategy.id })
        },
        orderBy: [
          { weekStarting: 'asc' },
          { category: 'asc' }
        ]
      }),
      
      // Fetch COGS data from expense table (created by Order Timeline)
      prisma.expense.findMany({
        where: {
          weekStarting: {
            gte: startWeekRange.start,
            lte: endWeekRange.end
          },
          type: 'order-generated',
          isCOGS: true,
          ...(activeStrategy && { strategyId: activeStrategy.id })
        },
        orderBy: [
          { weekStarting: 'asc' },
          { category: 'asc' }
        ]
      })
    ])
    
    // Filter by strategy if active
    const filteredExpenses = activeStrategy 
      ? recurringExpenses.filter(e => e.strategyId === activeStrategy.id)
      : recurringExpenses
      
    const filteredAmazonFees = activeStrategy
      ? amazonGLEntries.filter(e => e.strategyId === activeStrategy.id)
      : amazonGLEntries
      
    const filteredCOGS = activeStrategy
      ? cogsGLEntries.filter(e => e.strategyId === activeStrategy.id)
      : cogsGLEntries
    
    // Group expenses by week and category
    const expensesByWeek: Record<string, any[]> = {}
    filteredExpenses.forEach(expense => {
      const week = getWeekNumber(expense.weekStarting)
      if (!expensesByWeek[week]) expensesByWeek[week] = []
      expensesByWeek[week].push({
        category: expense.category,
        amount: safeNumber(expense.amount),
        date: expense.weekStarting
      })
    })
    
    // Group Amazon fees by week and category  
    const amazonFeesByWeek: Record<string, any[]> = {}
    filteredAmazonFees.forEach(expense => {
      const week = getWeekNumber(expense.weekStarting)
      if (!amazonFeesByWeek[week]) amazonFeesByWeek[week] = []
      
      // Map expense categories to GL account codes
      let accountCode = ''
      switch(expense.category) {
        case 'FBA Fulfillment Fee':
        case 'FBA_FEES':
          accountCode = '5051'
          break
        case 'Referral Fee':
          accountCode = '5050'
          break
        case 'Amazon Storage':
          accountCode = '5032'
          break
        case 'Advertising':
          accountCode = '5310'
          break
      }
      
      amazonFeesByWeek[week].push({
        category: accountCode,
        amount: safeNumber(expense.amount),
        date: expense.weekStarting,
        sku: expense.sku
      })
    })
    
    // Group COGS by week and category
    const cogsByWeek: Record<string, any[]> = {}
    filteredCOGS.forEach(expense => {
      const week = getWeekNumber(expense.weekStarting)
      if (!cogsByWeek[week]) cogsByWeek[week] = []
      
      // Map COGS categories to display format
      let category = 'manufacturing'
      if (expense.category.includes('Freight')) category = 'freight'
      else if (expense.category.includes('Tariff')) category = 'tariff'
      else if (expense.category.includes('AWD')) category = 'land_freight'
      
      cogsByWeek[week].push({
        category,
        amount: safeNumber(expense.amount),
        date: expense.weekStarting,
        sku: expense.sku
      })
    })
    
    // Convert amounts to numbers in the main arrays and map category names to account codes
    const expensesWithNumbers = filteredExpenses.map(e => {
      // Find the account code for this category name
      let accountCode = e.category
      for (const [code, account] of Object.entries(CHART_OF_ACCOUNTS)) {
        if (account.name === e.category) {
          accountCode = code
          break
        }
      }
      
      // Calculate week number from weekStarting date
      const weekNum = getWeekNumber(e.weekStarting)
      
      return {
        ...e,
        category: accountCode, // Return account code instead of name
        amount: safeNumber(e.amount),
        weekNum // Add week number
      }
    })
    
    const amazonFeesWithNumbers = filteredAmazonFees.map(e => ({
      ...e,
      amount: safeNumber(e.amount)
    }))
    
    const cogsWithNumbers = filteredCOGS.map(e => ({
      ...e,
      amount: safeNumber(e.amount)
    }))
    
    return NextResponse.json(
      {
        expenses: expensesWithNumbers,
        amazonFees: amazonFeesWithNumbers,
        cogsData: cogsWithNumbers,
        expensesByWeek,
        amazonFeesByWeek,
        cogsByWeek
      }
    )
  } catch (error) {
    logger.error('Error fetching expense forecast:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense forecast' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { changes, year, quarter, strategyId } = body;
    
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      );
    }
    
    // Get active strategy if not provided
    let activeStrategyId = strategyId;
    if (!activeStrategyId) {
      const activeStrategy = await prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      });
      activeStrategyId = activeStrategy?.id;
    }
    
    if (!activeStrategyId) {
      return NextResponse.json(
        { error: 'No active strategy. Please create and activate a budget strategy first.' },
        { status: 400 }
      );
    }
    
    // Process all changes in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const processedChanges = [];
      
      for (const change of changes) {
        const { week, rowId: accountCode, value: amount } = change;
        
        // Skip if amount is 0
        if (amount === 0) {
          // Delete any existing expense for this week/category
          const weekRange = getWeekDateRange(year, week);
          const account = getAccount(accountCode);
          const category = account?.name || accountCode;
          
          await tx.expense.deleteMany({
            where: {
              strategyId: activeStrategyId,
              weekStarting: weekRange.start,
              category,
              type: 'manual'
            }
          });
          
          processedChanges.push({
            week,
            accountCode,
            amount: 0,
            action: 'deleted'
          });
          continue;
        }
        
        // Calculate week dates
        const weekRange = getWeekDateRange(year, week);
        const weekStarting = weekRange.start;
        const weekEnding = weekRange.end;
        
        // Get category from account code
        const account = getAccount(accountCode);
        const category = account?.name || accountCode;
        
        // First delete any existing GL entries for this expense
        const existingExpense = await tx.expense.findFirst({
          where: {
            date: weekStarting,
            category,
            subcategory: '',
            vendor: '',
            strategyId: activeStrategyId
          }
        });
        
        if (existingExpense) {
          // Find and delete existing GL entries
          const expenseGLLinks = await tx.expenseGLEntry.findMany({
            where: {
              expenseId: existingExpense.id
            }
          });
          
          if (expenseGLLinks.length > 0) {
            // Delete the ExpenseGLEntry links
            await tx.expenseGLEntry.deleteMany({
              where: {
                expenseId: existingExpense.id
              }
            });
            
            // Delete the GL entries
            await tx.gLEntry.deleteMany({
              where: {
                id: {
                  in: expenseGLLinks.map(link => link.glEntryId)
                }
              }
            });
          }
        }
        
        // Determine if this is a year-end adjustment (week 52 with inventory or contra-COGS adjustments)
        const isYearEndAdjustment = week === 52 && (
          accountCode === '1200' || 
          accountCode === '5025'
        ) && change.description?.includes('Year-end')
        
        // Upsert expense record
        const expense = await tx.expense.upsert({
          where: {
            date_category_subcategory_vendor_strategyId: {
              date: weekStarting,
              category,
              subcategory: '',
              vendor: '',
              strategyId: activeStrategyId
            }
          } as any,
          update: {
            amount,
            description: change.description || `${category} - Week ${week}`,
            type: isYearEndAdjustment ? 'onetime' : 'manual',
            isRecurring: false,
            updatedAt: new Date()
          },
          create: {
            strategyId: activeStrategyId,
            date: weekStarting,
            weekStarting,
            weekEnding,
            category,
            subcategory: '',
            vendor: '',
            description: change.description || `${category} - Week ${week}`,
            amount,
            type: isYearEndAdjustment ? 'onetime' : 'manual',
            isRecurring: false,
            isCOGS: category.startsWith('COGS'),
            updatedAt: new Date()
          }
        });
        
        // Create GL entries for the expense
        const pairId = uuidv4();
        
        // Determine correct account category based on account code
        // 1700 (Office Equipment) and 1200 (Inventory) are Assets, not Expenses
        // 5720 (Depreciation) needs special handling - creates both expense and accumulated depreciation
        const accountCategory = (accountCode === '1700' || accountCode === '1200') ? 'Asset' : 'Expense';
        
        // Handle depreciation specially - it creates TWO GL entries (expense + accumulated depreciation)
        if (accountCode === '5720') {
          // Create depreciation expense entry (debit)
          const depreciationExpenseGL = await tx.gLEntry.create({
            data: {
              strategyId: activeStrategyId,
              date: weekStarting,
              account: '5720', // Depreciation Expense
              accountCategory: 'Expense',
              description: `Depreciation Expense - Week ${week}`,
              debit: amount,
              credit: 0,
              reference: `depreciation-${year}-W${week}`,
              source: 'expense-forecast',
              updatedAt: new Date(),
              metadata: { 
                year, 
                week, 
                accountCode: '5720', 
                category: 'Depreciation Expense',
                expenseId: expense.id,
                pairId,
                entryType: 'depreciation'
              }
            }
          });
          
          // Create accumulated depreciation entry (credit)
          const accumulatedDepreciationGL = await tx.gLEntry.create({
            data: {
              strategyId: activeStrategyId,
              date: weekStarting,
              account: '1750', // Less Accumulated Depreciation on Office Equipment
              accountCategory: 'Asset',
              description: `Accumulated Depreciation - Week ${week}`,
              debit: 0,
              credit: amount,
              reference: `depreciation-${year}-W${week}`,
              source: 'expense-forecast',
              updatedAt: new Date(),
              metadata: { 
                year, 
                week, 
                accountCode: '1750', 
                category: 'Accumulated Depreciation',
                expenseId: expense.id,
                pairId,
                entryType: 'depreciation'
              }
            }
          });
          
          // Link expense to GL entries
          await tx.expenseGLEntry.create({
            data: {
              expenseId: expense.id,
              glEntryId: depreciationExpenseGL.id
            }
          });
          
          await tx.expenseGLEntry.create({
            data: {
              expenseId: expense.id,
              glEntryId: accumulatedDepreciationGL.id
            }
          });
          
          processedChanges.push({
            week,
            accountCode,
            amount,
            action: 'upserted',
            id: expense.id,
            glEntries: [depreciationExpenseGL.id, accumulatedDepreciationGL.id]
          });
          
          continue; // Skip the normal expense/cash entries
        }
        
        // Handle negative amounts (credits to expenses or debits to assets)
        const isNegative = amount < 0;
        const absAmount = Math.abs(amount);
        
        const expenseGL = await tx.gLEntry.create({
          data: {
            strategyId: activeStrategyId,
            date: weekStarting,
            account: accountCode,
            accountCategory,
            description: `${category} - Week ${week}`,
            debit: isNegative ? 0 : absAmount,
            credit: isNegative ? absAmount : 0,
            reference: `expense-${year}-W${week}-${accountCode}`,
            source: 'expense-forecast',
            updatedAt: new Date(),
            metadata: { 
              year, 
              week, 
              accountCode, 
              category,
              expenseId: expense.id,
              pairId,
              entryType: 'expense'
            }
          }
        });
        
        const cashGL = await tx.gLEntry.create({
          data: {
            strategyId: activeStrategyId,
            date: weekStarting,
            account: '1000', // Business Bank Account
            accountCategory: 'Asset',
            description: `${category} - Week ${week}`,
            debit: isNegative ? absAmount : 0,
            credit: isNegative ? 0 : absAmount,
            reference: `expense-${year}-W${week}-${accountCode}`,
            source: 'expense-forecast',
            updatedAt: new Date(),
            metadata: { 
              year, 
              week, 
              accountCode, 
              category,
              expenseId: expense.id,
              pairId,
              entryType: 'expense'
            }
          }
        });
        
        // Link expense to GL entries
        await tx.expenseGLEntry.create({
          data: {
            expenseId: expense.id,
            glEntryId: expenseGL.id
          }
        });
        
        await tx.expenseGLEntry.create({
          data: {
            expenseId: expense.id,
            glEntryId: cashGL.id
          }
        });
        
        processedChanges.push({
          week,
          accountCode,
          amount,
          action: 'upserted',
          id: expense.id,
          glEntries: [expenseGL.id, cashGL.id]
        });
      }
      
      return processedChanges;
    });
    
    logger.info(`Updated ${results.length} expense records`);
    
    return NextResponse.json({
      success: true,
      updated: results.length,
      changes: results
    });
    
  } catch (error) {
    logger.error('Error in expense update:', error);
    return NextResponse.json(
      { error: 'Failed to update expenses' },
      { status: 500 }
    );
  }
}