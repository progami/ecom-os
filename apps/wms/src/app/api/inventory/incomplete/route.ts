import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma'
import type { TransactionType } from '@ecom-os/prisma-wms';
export const dynamic = 'force-dynamic'

export async function GET(_request: Request) {
 try {
 const session = await getServerSession(authOptions);
 if (!session?.user) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 // Get incomplete transactions based on user's warehouse
 let scopedWarehouseCode: string | undefined
 if (session.user.role === 'staff' && session.user.warehouseId) {
 const warehouse = await prisma.warehouse.findUnique({
 where: { id: session.user.warehouseId },
 select: { code: true }
 })
 scopedWarehouseCode = warehouse?.code
 }

 const whereClause = scopedWarehouseCode ? { warehouseCode: scopedWarehouseCode } : {};

 // Find RECEIVE transactions missing tracking number or pickup date
 const incompleteReceive = await prisma.inventoryTransaction.findMany({
 where: {
 ...whereClause,
 transactionType: 'RECEIVE',
 OR: [
 { trackingNumber: null },
 { pickupDate: null }
 ]
 },
 select: {
 id: true,
 transactionType: true,
 transactionDate: true,
 trackingNumber: true,
 pickupDate: true,
 attachments: true,
 skuCode: true
 },
 take: 10,
 orderBy: { createdAt: 'desc' }
 });

 // Find SHIP transactions missing pickup date
 const incompleteShip = await prisma.inventoryTransaction.findMany({
 where: {
 ...whereClause,
 transactionType: 'SHIP',
 pickupDate: null
 },
 select: {
 id: true,
 transactionType: true,
 transactionDate: true,
 pickupDate: true,
 attachments: true,
 skuCode: true
 },
 take: 10,
 orderBy: { createdAt: 'desc' }
 });

 // Format response with missing fields
 type IncompleteTransaction = {
 id: string
 transactionType: TransactionType
 transactionDate: Date
 trackingNumber: string | null
 pickupDate: Date | null
 attachments: unknown
 skuCode: string
 }

 const formatTransaction = (tx: IncompleteTransaction) => {
 const missingFields = [];
 
 if (tx.transactionType === 'RECEIVE') {
 if (!tx.trackingNumber) missingFields.push('tracking_number');
 if (!tx.pickupDate) missingFields.push('pickup_date');
 } else if (tx.transactionType === 'SHIP') {
 if (!tx.pickupDate) missingFields.push('pickup_date');
 }
 
 if (!tx.attachments || Object.keys(tx.attachments as Record<string, unknown>).length === 0) {
 missingFields.push('attachments');
 }

 return {
 id: tx.id,
 transactionType: tx.transactionType,
 skuCode: tx.skuCode,
 transactionDate: tx.transactionDate,
 missingFields
 };
 };

 const allIncomplete = [
 ...incompleteReceive.map(tx => formatTransaction(tx as IncompleteTransaction)),
 ...incompleteShip.map(tx => formatTransaction(tx as IncompleteTransaction))
 ].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

 return NextResponse.json(allIncomplete);
 } catch (_error) {
 // console.error('Error fetching incomplete transactions:', error);
 return NextResponse.json(
 { error: 'Failed to fetch incomplete transactions' },
 { status: 500 }
 );
 }
}
