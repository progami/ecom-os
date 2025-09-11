import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/database';
import logger from '@/utils/logger';
import { getWeekDateRange } from '@/lib/utils/weekHelpers';
import { v4 as uuidv4 } from 'uuid';
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : null;
    
    // Build where clause for week/quarter/year
    const whereClause: any = { year };
    if (quarter) {
      whereClause.quarter = quarter;
    }
    
    // Get active strategy and unit sales in parallel
    const [activeStrategy, unitSales] = await Promise.all([
      prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      }),
      prisma.unitSales.findMany({
        where: whereClause,
        orderBy: [
          { year: 'asc' },
          { week: 'asc' },
          { sku: 'asc' }
        ]
      })
    ]);
    
    // Filter by strategy after fetching
    const filteredSales = activeStrategy 
      ? unitSales.filter(sale => sale.strategyId === activeStrategy.id)
      : unitSales;
    
    const response = NextResponse.json({
      unitSales: filteredSales,
      strategyId: activeStrategy?.id
    });
    
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    return response;
  } catch (error) {
    logger.error('Error fetching unit sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit sales' },
      { status: 500 }
    );
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
    
    // Get product data for price lookups
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        OR: [
          { strategyId: activeStrategyId },
          { strategyId: null }
        ]
      }
    });
    
    const productMap = new Map(products.map(p => [p.sku, p]));
    
    // Process all changes in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const processedChanges = [];
      
      for (const change of changes) {
        const { week, rowId: sku, value: units } = change;
        
        // Get product for revenue calculation
        const product = productMap.get(sku);
        if (!product) {
          logger.warn(`Product not found for SKU: ${sku}`);
          continue;
        }
        
        const revenue = units * Number(product.pricing);
        
        // Upsert unit sales record  
        const unitSales = await tx.unitSales.upsert({
          where: {
            year_week_sku_strategyId: {
              year,
              week,
              sku,
              strategyId: activeStrategyId
            }
          },
          update: {
            units,
            revenue,
            metadata: { price: Number(product.pricing) }
          },
          create: {
            strategyId: activeStrategyId,
            year,
            quarter,
            week,
            sku,
            units,
            revenue,
            metadata: { price: Number(product.pricing) },
            isActual: false
          }
        });
        
        processedChanges.push(unitSales);
        
        // Delete existing expenses and GL entries for this unit sale
        // This prevents duplicates when updating
        const existingExpenses = await tx.expense.findMany({
          where: {
            unitSalesId: unitSales.id
          }
        });
        
        if (existingExpenses.length > 0) {
          // First get the GL entries linked to these expenses
          const expenseGLLinks = await tx.expenseGLEntry.findMany({
            where: {
              expenseId: {
                in: existingExpenses.map(e => e.id)
              }
            }
          });
          
          // Delete GL entry links
          await tx.expenseGLEntry.deleteMany({
            where: {
              expenseId: {
                in: existingExpenses.map(e => e.id)
              }
            }
          });
          
          // Delete the actual GL entries
          if (expenseGLLinks.length > 0) {
            await tx.gLEntry.deleteMany({
              where: {
                id: {
                  in: expenseGLLinks.map(link => link.glEntryId)
                }
              }
            });
          }
          
          // Delete the expenses
          await tx.expense.deleteMany({
            where: {
              unitSalesId: unitSales.id
            }
          });
        }
        
        // Also delete existing GL entries for this unit sale
        await tx.unitSalesGLEntry.deleteMany({
          where: {
            unitSalesId: unitSales.id
          }
        });
        
        await tx.gLEntry.deleteMany({
          where: {
            metadata: {
              path: ['unitSalesId'],
              equals: unitSales.id
            }
          }
        });
        
        // Create GL entries for the sales
        // Only create GL entries if there are units
        if (units > 0) {
          // Calculate week dates
          const weekRange = getWeekDateRange(year, week);
          const weekStarting = weekRange.start;
          const weekEnding = weekRange.end;
          
          // Payment date is 2 weeks after sale (Amazon payment delay)
          const paymentWeek = week + 2;
          let adjustedPaymentWeek = paymentWeek;
          let paymentYear = year;
          
          if (paymentWeek > 52) {
            adjustedPaymentWeek = paymentWeek - 52;
            paymentYear = year + 1;
          }
          
          // Cap payment date at December 31, 2030
          if (paymentYear > 2030) {
            paymentYear = 2030;
            adjustedPaymentWeek = 52;
          }
          
          const paymentWeekRange = getWeekDateRange(paymentYear, adjustedPaymentWeek);
          const paymentDate = paymentWeekRange.start;
          
          // Metadata for GL entries
          const baseMetadata = {
            source: 'unit-sales',
            year,
            week,
            sku,
            units,
            unitSalesId: unitSales.id,
            saleWeek: week,
            saleYear: year,
            paymentWeek: adjustedPaymentWeek,
            paymentYear: paymentYear
          };
          
          // Create Revenue GL entries (2 weeks delayed - cash basis)
          const revenuePairId = uuidv4();
          const revenueDebit = await tx.gLEntry.create({
            data: {
              strategyId: activeStrategyId,
              date: paymentDate,
              account: '1000', // Business Bank Account
              accountCategory: 'Asset',
              description: `${CHART_OF_ACCOUNTS['4000'].name} - ${sku} (${units} units) - W${week} sales paid W${adjustedPaymentWeek}`,
              debit: revenue,
              credit: 0,
              reference: `sales-${year}-W${week}-${sku}`,
              source: 'unit-sales',
              metadata: { ...baseMetadata, entryType: 'revenue', pairId: revenuePairId }
            }
          });
          
          const revenueCredit = await tx.gLEntry.create({
            data: {
              strategyId: activeStrategyId,
              date: paymentDate,
              account: '4000', // Amazon Sales
              accountCategory: 'Revenue',
              description: `${CHART_OF_ACCOUNTS['4000'].name} - ${sku} (${units} units) - W${week} sales paid W${adjustedPaymentWeek}`,
              debit: 0,
              credit: revenue,
              reference: `sales-${year}-W${week}-${sku}`,
              source: 'unit-sales',
              metadata: { ...baseMetadata, entryType: 'revenue', pairId: revenuePairId }
            }
          });
          
          // Link revenue GL entries to unit sales
          await tx.unitSalesGLEntry.create({
            data: {
              unitSalesId: unitSales.id,
              glEntryId: revenueDebit.id
            }
          });
          
          await tx.unitSalesGLEntry.create({
            data: {
              unitSalesId: unitSales.id,
              glEntryId: revenueCredit.id
            }
          });
          
          // Create Amazon fee expenses
          const fbaFee = Number(product.fulfillmentFee) || 0;
          const referralFee = Number(product.referralFee) || 0;
          const pricing = Number(product.pricing) || 0;
          
          // FBA Fulfillment Fee (2 weeks delayed with payment)
          if (fbaFee > 0) {
            const fbaExpense = await tx.expense.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,  // 2 weeks delayed
                weekStarting: paymentDate,
                weekEnding: paymentDate,
                category: 'FBA Fulfillment Fee',
                subcategory: sku,
                description: `FBA fees for ${sku} - ${units} units - W${week} paid W${adjustedPaymentWeek}`,
                amount: units * fbaFee,
                type: 'automated',
                isCOGS: false,
                unitSalesId: unitSales.id,
                sku,
                quantity: units,
                unitCost: fbaFee
              }
            });
            
            // Create FBA GL entries
            const fbaPairId = uuidv4();
            const fbaExpenseGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,
                account: '5051', // Fulfillment Fees
                accountCategory: 'Expense',
                description: `${CHART_OF_ACCOUNTS['5051'].name} - ${sku} (${units} units) - W${week} fees paid W${adjustedPaymentWeek}`,
                debit: units * fbaFee,
                credit: 0,
                reference: `fba-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'fba-fee', pairId: fbaPairId, expenseId: fbaExpense.id }
              }
            });
            
            const fbaCashGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,
                account: '1000', // Business Bank Account
                accountCategory: 'Asset',
                description: `${CHART_OF_ACCOUNTS['5051'].name} - ${sku} (${units} units) - W${week} fees paid W${adjustedPaymentWeek}`,
                debit: 0,
                credit: units * fbaFee,
                reference: `fba-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'fba-fee', pairId: fbaPairId, expenseId: fbaExpense.id }
              }
            });
            
            // Link expense to GL entries
            await tx.expenseGLEntry.create({
              data: {
                expenseId: fbaExpense.id,
                glEntryId: fbaExpenseGL.id
              }
            });
            
            await tx.expenseGLEntry.create({
              data: {
                expenseId: fbaExpense.id,
                glEntryId: fbaCashGL.id
              }
            });
            
            // Link to unit sales
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: fbaExpenseGL.id
              }
            });
            
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: fbaCashGL.id
              }
            });
          }
          
          // Referral Fee (2 weeks delayed with payment)
          if (referralFee > 0) {
            const referralAmount = units * referralFee;
            const referralExpense = await tx.expense.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,  // 2 weeks delayed
                weekStarting: paymentDate,
                weekEnding: paymentDate,
                category: 'Referral Fee',
                subcategory: sku,
                description: `Amazon referral fees for ${sku} - ${units} units - W${week} paid W${adjustedPaymentWeek}`,
                amount: referralAmount,
                type: 'automated',
                isCOGS: false,
                unitSalesId: unitSales.id,
                sku,
                quantity: units,
                unitCost: referralFee
              }
            });
            
            // Create Referral Fee GL entries
            const referralPairId = uuidv4();
            const referralExpenseGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,
                account: '5050', // Referral Fees
                accountCategory: 'Expense',
                description: `${CHART_OF_ACCOUNTS['5050'].name} - ${sku} (${units} units) - W${week} fees paid W${adjustedPaymentWeek}`,
                debit: referralAmount,
                credit: 0,
                reference: `ref-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'referral-fee', pairId: referralPairId, expenseId: referralExpense.id }
              }
            });
            
            const referralCashGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,
                account: '1000', // Business Bank Account
                accountCategory: 'Asset',
                description: `${CHART_OF_ACCOUNTS['5050'].name} - ${sku} (${units} units) - W${week} fees paid W${adjustedPaymentWeek}`,
                debit: 0,
                credit: referralAmount,
                reference: `ref-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'referral-fee', pairId: referralPairId, expenseId: referralExpense.id }
              }
            });
            
            // Link expense to GL entries
            await tx.expenseGLEntry.create({
              data: {
                expenseId: referralExpense.id,
                glEntryId: referralExpenseGL.id
              }
            });
            
            await tx.expenseGLEntry.create({
              data: {
                expenseId: referralExpense.id,
                glEntryId: referralCashGL.id
              }
            });
            
            // Link to unit sales
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: referralExpenseGL.id
              }
            });
            
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: referralCashGL.id
              }
            });
          }
          
          // Advertising (TACoS - Total Advertising Cost of Sales)
          const tacos = Number(product.tacos) || 0.15; // Default 15% TACoS
          const advertisingAmount = revenue * tacos;
          if (advertisingAmount > 0) {
            const advertisingExpense = await tx.expense.create({
              data: {
                strategyId: activeStrategyId,
                date: weekStarting,
                weekStarting,
                weekEnding,
                category: 'Advertising',
                subcategory: sku,
                description: `Amazon Advertising (${(tacos * 100).toFixed(1)}% TACoS) for ${sku} - ${units} units`,
                amount: advertisingAmount,
                type: 'automated',
                isCOGS: false,
                unitSalesId: unitSales.id,
                sku,
                quantity: units,
                unitCost: advertisingAmount / units
              }
            });
            
            // Create Advertising GL entries (immediate - current week)
            const advertisingPairId = uuidv4();
            const advertisingExpenseGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: weekStarting,
                account: '5310', // Amazon Advertising
                accountCategory: 'Expense',
                description: `Amazon Advertising (${(tacos * 100).toFixed(1)}% TACoS) - ${sku} (${units} units) - W${week}`,
                debit: advertisingAmount,
                credit: 0,
                reference: `advertising-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'advertising', pairId: advertisingPairId, tacosRate: tacos, expenseId: advertisingExpense.id }
              }
            });
            
            const advertisingCashGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: weekStarting,
                account: '1000', // Business Bank Account
                accountCategory: 'Asset',
                description: `Amazon Advertising (${(tacos * 100).toFixed(1)}% TACoS) - ${sku} (${units} units) - W${week}`,
                debit: 0,
                credit: advertisingAmount,
                reference: `advertising-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'advertising', pairId: advertisingPairId, tacosRate: tacos, expenseId: advertisingExpense.id }
              }
            });
            
            // Link expense to GL entries
            await tx.expenseGLEntry.create({
              data: {
                expenseId: advertisingExpense.id,
                glEntryId: advertisingExpenseGL.id
              }
            });
            
            await tx.expenseGLEntry.create({
              data: {
                expenseId: advertisingExpense.id,
                glEntryId: advertisingCashGL.id
              }
            });
            
            // Link to unit sales
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: advertisingExpenseGL.id
              }
            });
            
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: advertisingCashGL.id
              }
            });
          }
          
          // Amazon Storage (AWD)
          const awdFee = Number(product.awd) || 0;
          if (awdFee > 0 && units > 0) {
            const awdAmount = units * awdFee;
            const awdExpense = await tx.expense.create({
              data: {
                strategyId: activeStrategyId,
                date: weekStarting,
                weekStarting,
                weekEnding,
                category: 'Amazon Storage',
                subcategory: sku,
                description: `Amazon AWD Storage for ${sku} - ${units} units`,
                amount: awdAmount,
                type: 'automated',
                isCOGS: false,
                unitSalesId: unitSales.id,
                sku,
                quantity: units,
                unitCost: awdFee
              }
            });
            
            // Create AWD GL entries (immediate - current week)
            const awdPairId = uuidv4();
            const awdExpenseGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: weekStarting,
                account: '5032', // Storage 3PL
                accountCategory: 'Expense',
                description: `Storage 3PL - ${sku} (${units} units) - W${week}`,
                debit: awdAmount,
                credit: 0,
                reference: `awd-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'awd-storage', pairId: awdPairId, expenseId: awdExpense.id }
              }
            });
            
            const awdCashGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: weekStarting,
                account: '1000', // Business Bank Account
                accountCategory: 'Asset',
                description: `Storage 3PL - ${sku} (${units} units) - W${week}`,
                debit: 0,
                credit: awdAmount,
                reference: `awd-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'awd-storage', pairId: awdPairId, expenseId: awdExpense.id }
              }
            });
            
            // Link expense to GL entries
            await tx.expenseGLEntry.create({
              data: {
                expenseId: awdExpense.id,
                glEntryId: awdExpenseGL.id
              }
            });
            
            await tx.expenseGLEntry.create({
              data: {
                expenseId: awdExpense.id,
                glEntryId: awdCashGL.id
              }
            });
            
            // Link to unit sales
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: awdExpenseGL.id
              }
            });
            
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: awdCashGL.id
              }
            });
          }
          
          // Add refund reserve if applicable  
          const refundReserve = units * (Number(product.refund) || 0);
          if (refundReserve > 0) {
            // Create Refund Reserve GL entries (2 weeks delayed with payment)
            const refundPairId = uuidv4();
            const refundDebitGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,
                account: '4010', // Amazon Refunds (expense account)
                accountCategory: 'Expense',
                description: `${CHART_OF_ACCOUNTS['4010'].name} - ${sku} (${units} units) - W${week} refunds`,
                debit: refundReserve,
                credit: 0,
                reference: `refund-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'refund', pairId: refundPairId }
              }
            });
            
            const refundCreditGL = await tx.gLEntry.create({
              data: {
                strategyId: activeStrategyId,
                date: paymentDate,
                account: '1000', // Business Bank Account
                accountCategory: 'Asset',
                description: `${CHART_OF_ACCOUNTS['4010'].name} - ${sku} (${units} units) - W${week} refunds`,
                debit: 0,
                credit: refundReserve,
                reference: `refund-${year}-W${week}-${sku}`,
                source: 'unit-sales',
                metadata: { ...baseMetadata, entryType: 'refund', pairId: refundPairId }
              }
            });
            
            // Link refund GL entries to unit sales
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: refundDebitGL.id
              }
            });
            
            await tx.unitSalesGLEntry.create({
              data: {
                unitSalesId: unitSales.id,
                glEntryId: refundCreditGL.id
              }
            });
          }
        }
      }
      
      return processedChanges;
    });
    
    return NextResponse.json({ 
      success: true, 
      changes: results.length,
      message: `Successfully processed ${results.length} unit sales records`
    });
    
  } catch (error) {
    logger.error('Error processing unit sales:', error);
    return NextResponse.json(
      { error: 'Failed to process unit sales' },
      { status: 500 }
    );
  }
}