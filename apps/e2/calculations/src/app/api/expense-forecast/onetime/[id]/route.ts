import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'
import logger from '@/utils/logger'

// DELETE - Delete a one-time expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Delete expense and related GL entries in a transaction
    await prisma.$transaction(async (tx) => {
      // Get the expense first to find related GL entries
      const expense = await tx.expense.findUnique({
        where: { id },
        include: { glEntries: true }
      })
      
      if (!expense) {
        throw new Error('Expense not found')
      }
      
      // Delete GL entries
      if (expense.glEntries.length > 0) {
        const glEntryIds = expense.glEntries.map(e => e.glEntryId)
        
        // Delete expense-GL relationships first
        await tx.expenseGLEntry.deleteMany({
          where: { expenseId: id }
        })
        
        // Delete GL entries
        await tx.gLEntry.deleteMany({
          where: { id: { in: glEntryIds } }
        })
      }
      
      // Delete the expense
      await tx.expense.delete({
        where: { id }
      })
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting one-time expense:', error)
    return NextResponse.json(
      { error: 'Failed to delete one-time expense' },
      { status: 500 }
    )
  }
}

// PATCH - Update a one-time expense
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { date, description, category, amount } = body
    
    // Update expense and GL entries in a transaction
    await prisma.$transaction(async (tx) => {
      // Get the expense with GL entries
      const expense = await tx.expense.findUnique({
        where: { id },
        include: { glEntries: true }
      })
      
      if (!expense) {
        throw new Error('Expense not found')
      }
      
      // Update the expense
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          date: date ? new Date(date) : undefined,
          description,
          category,
          amount
        }
      })
      
      // Update GL entries if amount or category changed
      if (amount !== undefined || category !== undefined) {
        const newAmount = amount || expense.amount
        const newCategory = category || expense.category
        
        // Update GL entries
        for (const glRelation of expense.glEntries) {
          const glEntry = await tx.gLEntry.findUnique({
            where: { id: glRelation.glEntryId }
          })
          
          if (glEntry) {
            if (glEntry.account === '1000') {
              // Bank account (credit side)
              await tx.gLEntry.update({
                where: { id: glEntry.id },
                data: {
                  credit: newAmount,
                  description: description ? `One-time expense: ${description}` : glEntry.description
                }
              })
            } else {
              // Expense account (debit side)
              await tx.gLEntry.update({
                where: { id: glEntry.id },
                data: {
                  account: newCategory,
                  debit: newAmount,
                  description: description ? `One-time expense: ${description}` : glEntry.description
                }
              })
            }
          }
        }
      }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error updating one-time expense:', error)
    return NextResponse.json(
      { error: 'Failed to update one-time expense' },
      { status: 500 }
    )
  }
}