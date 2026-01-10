import { NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'
import { getS3Service } from '@/services/s3.service'

export const dynamic = 'force-dynamic'

export const POST = withAuthAndParams(async (request, params, _session) => {
 try {
 const { id } = params as { id: string }

 const prisma = await getTenantPrisma()
 const body = await request.json()
 const { documentCategory } = body

 if (!documentCategory) {
 return NextResponse.json({ error: 'Document category is required' }, { status: 400 })
 }

 // Get the transaction to find existing attachments
 const transaction = await prisma.inventoryTransaction.findUnique({
 where: { id },
 select: { attachments: true }
 })

 if (!transaction) {
 return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
 }

 const s3Service = getS3Service()
 let deletedCount = 0

 const normalizeCategory = (value: string) => value.replace(/([A-Z])/g, '_$1').toLowerCase()
 const targetCategory = documentCategory.toLowerCase()
 const alternateCategory = normalizeCategory(documentCategory)

 const getCategory = (attachment: unknown): string | undefined => {
 if (!attachment || typeof attachment !== 'object') return undefined
 const record = attachment as Record<string, unknown>
 const value = record.category
 return typeof value === 'string' ? value.toLowerCase() : undefined
 }

 const getS3Key = (attachment: unknown): string | undefined => {
 if (!attachment || typeof attachment !== 'object') return undefined
 const record = attachment as Record<string, unknown>
 return typeof record.s3Key === 'string' ? record.s3Key : undefined
 }

 const attachmentsValue = transaction.attachments as unknown

 if (Array.isArray(attachmentsValue)) {
 const existingAttachment = attachmentsValue.find(att => {
 const category = getCategory(att)
 return category === targetCategory || category === alternateCategory
 })

 const s3Key = getS3Key(existingAttachment)
 if (s3Key) {
 try {
 await s3Service.deleteFile(s3Key)
 deletedCount++
 } catch (_error) {
 // ignore deletion failures
 }
 }
 } else if (attachmentsValue && typeof attachmentsValue === 'object') {
 const attachmentsRecord = attachmentsValue as Record<string, unknown>
 for (const [key, attachment] of Object.entries(attachmentsRecord)) {
 const normalizedKey = key.toLowerCase()
 if (normalizedKey === targetCategory || normalizedKey === alternateCategory) {
 const s3Key = getS3Key(attachment)
 if (s3Key) {
 try {
 await s3Service.deleteFile(s3Key)
 deletedCount++
 } catch (_error) {
 // ignore
 }
 }
 }
 }
 }

 // Also check S3 directly for any orphaned files
 const date = new Date()
 const year = date.getFullYear()
 const month = String(date.getMonth() + 1).padStart(2, '0')
 const s3Prefix = `transactions/${year}/${month}/${id}/${documentCategory}_`
 try {
 const files = await s3Service.listFiles(s3Prefix)
 
 for (const fileKey of files) {
 try {
 await s3Service.deleteFile(fileKey)
 deletedCount++
 // console.log(`Deleted orphaned S3 file: ${fileKey}`)
 } catch (_error) {
 // console.error(`Failed to delete orphaned S3 file: ${fileKey}`, _error)
 }
 }
 } catch (_error) {
 // console.error('Failed to list S3 files for cleanup:', _error)
 }

 return NextResponse.json({ 
 success: true, 
 deletedCount,
 message: `Cleaned up ${deletedCount} old file(s) for ${documentCategory}`
 })
 } catch (_error) {
 // console.error('Document cleanup error:', _error)
 return NextResponse.json({ 
 error: 'Failed to cleanup old documents',
 details: _error instanceof Error ? _error.message : 'Unknown error'
 }, { status: 500 })
 }
})
