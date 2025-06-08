import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      shipName, 
      containerNumber, 
      pickupDate, 
      notes, 
      attachments,
      referenceId,
      cartonsIn,
      cartonsOut,
      storagePalletsIn,
      shippingPalletsOut,
      unitsPerCarton,
      storageCartonsPerPallet,
      shippingCartonsPerPallet,
      auditReason,
      oldValues,
      ...otherAttributes 
    } = body

    // Get the current transaction for comparison
    const currentTransaction = await prisma.inventoryTransaction.findUnique({
      where: { id: params.id },
      include: {
        warehouse: true,
        sku: true
      }
    })

    if (!currentTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      ...(shipName !== undefined && { shipName }),
      ...(containerNumber !== undefined && { containerNumber }),
      ...(pickupDate !== undefined && { pickupDate: pickupDate ? new Date(pickupDate) : null }),
      ...(notes !== undefined && { notes }),
      ...(referenceId !== undefined && { referenceId }),
      ...(attachments !== undefined && { attachments }),
      ...(unitsPerCarton !== undefined && { unitsPerCarton }),
      ...(storageCartonsPerPallet !== undefined && { storageCartonsPerPallet }),
      ...(shippingCartonsPerPallet !== undefined && { shippingCartonsPerPallet }),
      updatedAt: new Date()
    }

    // Handle quantity updates if provided
    let quantityChanged = false
    let inventoryBalanceUpdate = null
    
    if (cartonsIn !== undefined || cartonsOut !== undefined || 
        storagePalletsIn !== undefined || shippingPalletsOut !== undefined) {
      
      quantityChanged = true
      
      // Add quantity fields to update
      updateData.cartonsIn = cartonsIn ?? currentTransaction.cartonsIn
      updateData.cartonsOut = cartonsOut ?? currentTransaction.cartonsOut
      updateData.storagePalletsIn = storagePalletsIn ?? currentTransaction.storagePalletsIn
      updateData.shippingPalletsOut = shippingPalletsOut ?? currentTransaction.shippingPalletsOut
      
      // Calculate the difference for inventory balance update
      const cartonsDiff = (updateData.cartonsIn - updateData.cartonsOut) - 
                          (currentTransaction.cartonsIn - currentTransaction.cartonsOut)
      const palletsDiff = (updateData.storagePalletsIn - updateData.shippingPalletsOut) - 
                          (currentTransaction.storagePalletsIn - currentTransaction.shippingPalletsOut)
      
      if (cartonsDiff !== 0 || palletsDiff !== 0) {
        // Find the inventory balance record
        const inventoryBalance = await prisma.inventoryBalance.findFirst({
          where: {
            warehouseId: currentTransaction.warehouseId,
            skuId: currentTransaction.skuId,
            batchLot: currentTransaction.batchLot
          }
        })
        
        if (inventoryBalance) {
          const newCartons = inventoryBalance.currentCartons + cartonsDiff
          const newPallets = inventoryBalance.currentPallets + palletsDiff
          const newUnits = newCartons * (unitsPerCarton || currentTransaction.unitsPerCarton || currentTransaction.sku.unitsPerCarton)
          
          inventoryBalanceUpdate = {
            id: inventoryBalance.id,
            currentCartons: Math.max(0, newCartons),
            currentPallets: Math.max(0, newPallets),
            currentUnits: Math.max(0, newUnits),
            storageCartonsPerPallet: storageCartonsPerPallet ?? inventoryBalance.storageCartonsPerPallet,
            shippingCartonsPerPallet: shippingCartonsPerPallet ?? inventoryBalance.shippingCartonsPerPallet
          }
        }
      }
    }

    // Perform the updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // If quantities are being changed, validate them first
      if (quantityChanged && inventoryBalanceUpdate) {
        // Get current inventory balance to validate
        const currentBalance = await tx.inventoryBalance.findFirst({
          where: {
            warehouseId: currentTransaction.warehouseId,
            skuId: currentTransaction.skuId
          }
        })
        
        if (!currentBalance) {
          throw new Error('Inventory balance not found for this SKU and warehouse')
        }
        
        // Calculate what the new balance would be
        const cartonsDiff = (updateData.cartonsIn - updateData.cartonsOut) - 
                            (currentTransaction.cartonsIn - currentTransaction.cartonsOut)
        const palletsDiff = (updateData.storagePalletsIn - updateData.shippingPalletsOut) - 
                            (currentTransaction.storagePalletsIn - currentTransaction.shippingPalletsOut)
        
        const newCartonBalance = currentBalance.currentCartons + cartonsDiff
        const newPalletBalance = currentBalance.currentPallets + palletsDiff
        
        // Check for negative inventory
        if (newCartonBalance < 0) {
          throw new Error(`Cannot update: This change would result in negative inventory (${newCartonBalance} cartons). Current balance: ${currentBalance.currentCartons} cartons.`)
        }
        
        if (newPalletBalance < 0) {
          throw new Error(`Cannot update: This change would result in negative pallet inventory (${newPalletBalance} pallets). Current balance: ${currentBalance.currentPallets} pallets.`)
        }
        
        // Additional validation for RECEIVE transactions being reduced
        if (currentTransaction.transactionType === 'RECEIVE' && cartonsDiff < 0) {
          // Check if there are dependent SHIP transactions
          const dependentShips = await tx.inventoryTransaction.aggregate({
            where: {
              skuId: currentTransaction.skuId,
              warehouseId: currentTransaction.warehouseId,
              transactionType: 'SHIP',
              transactionDate: { gt: currentTransaction.transactionDate },
              batchLot: currentTransaction.batchLot
            },
            _sum: {
              cartonsOut: true
            }
          })
          
          const totalShipped = dependentShips._sum.cartonsOut || 0
          const newReceiveAmount = updateData.cartonsIn
          
          if (totalShipped > newReceiveAmount) {
            throw new Error(`Cannot reduce quantity: ${totalShipped} cartons from batch "${currentTransaction.batchLot}" have already been shipped. Minimum allowed: ${totalShipped} cartons.`)
          }
        }
      }
      
      // Update the transaction
      const updatedTransaction = await tx.inventoryTransaction.update({
        where: { id: params.id },
        data: updateData,
        include: {
          warehouse: true,
          sku: true,
          createdBy: true
        }
      })
      
      // Update inventory balance if needed
      if (inventoryBalanceUpdate) {
        await tx.inventoryBalance.update({
          where: { id: inventoryBalanceUpdate.id },
          data: {
            currentCartons: inventoryBalanceUpdate.currentCartons,
            currentPallets: inventoryBalanceUpdate.currentPallets,
            currentUnits: inventoryBalanceUpdate.currentUnits,
            storageCartonsPerPallet: inventoryBalanceUpdate.storageCartonsPerPallet,
            shippingCartonsPerPallet: inventoryBalanceUpdate.shippingCartonsPerPallet
          }
        })
      }
      
      // Create audit log
      const changes: any[] = []
      
      if (quantityChanged && oldValues) {
        changes.push({
          field: 'quantities',
          oldValue: oldValues,
          newValue: {
            cartons: currentTransaction.transactionType === 'RECEIVE' ? updateData.cartonsIn : updateData.cartonsOut,
            pallets: currentTransaction.transactionType === 'RECEIVE' ? updateData.storagePalletsIn : updateData.shippingPalletsOut
          }
        })
      }
      
      // Track other changes
      const fieldsToTrack = ['shipName', 'containerNumber', 'pickupDate', 'notes', 'referenceId']
      fieldsToTrack.forEach(field => {
        if (body[field] !== undefined && body[field] !== currentTransaction[field as keyof typeof currentTransaction]) {
          changes.push({
            field,
            oldValue: currentTransaction[field as keyof typeof currentTransaction],
            newValue: body[field]
          })
        }
      })
      
      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            tableName: 'inventory_transactions',
            recordId: params.id,
            action: auditReason || 'Update transaction',
            changes: {
              before: changes.map(c => ({ [c.field]: c.oldValue })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
              after: changes.map(c => ({ [c.field]: c.newValue })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
            },
            userId: session.user.id,
            createdAt: new Date()
          }
        })
      }
      
      return updatedTransaction
    })

    return NextResponse.json({ 
      success: true,
      message: quantityChanged ? 'Transaction and inventory updated successfully' : 'Transaction updated successfully',
      transaction: result
    })
  } catch (error) {
    console.error('Update attributes error:', error)
    return NextResponse.json({ 
      error: 'Failed to update attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}