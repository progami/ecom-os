import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, TransactionType, CostCategory } from '@ecom-os/prisma-wms'
import { businessLogger, perfLogger } from '@/lib/logger/index'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
// handleTransactionCosts removed - costs are handled via frontend pre-filling
import { parseLocalDateTime } from '@/lib/utils/date-helpers'
import { recordStorageCostEntry } from '@/services/storageCost.service'
import { ensurePurchaseOrderForTransaction, resolveBatchLot } from '@/lib/services/purchase-order-service'
export const dynamic = 'force-dynamic'

type NewSkuPayload = {
 skuCode?: string
 description?: string
 asin?: string
 packSize?: number
 material?: string
 unitDimensionsCm?: string
 unitWeightKg?: number
 unitsPerCarton?: number
 cartonDimensionsCm?: string
 cartonWeightKg?: number
 packagingType?: string
}

type NewBatchPayload = {
 batchCode?: string
 description?: string
 productionDate?: string
 expiryDate?: string
 isActive?: boolean
}

type MutableTransactionLine = {
 skuCode?: string
 skuId?: string
 batchLot?: string
 cartons?: number
 pallets?: number
 storageCartonsPerPallet?: number
 shippingCartonsPerPallet?: number
 storagePalletsIn?: number
 shippingPalletsOut?: number
 unitsPerCarton?: number
 cartonsIn?: number
 cartonsOut?: number
 isNewSku?: boolean
 skuData?: NewSkuPayload
 batchData?: NewBatchPayload
}

type ValidatedTransactionLine = {
 skuCode: string
 batchLot: string
 cartons: number
 pallets?: number
 storageCartonsPerPallet?: number | null
 shippingCartonsPerPallet?: number | null
 storagePalletsIn?: number
 shippingPalletsOut?: number
 unitsPerCarton?: number
 isNewSku?: boolean
 skuData?: NewSkuPayload
 batchData?: NewBatchPayload
}

type TransactionCostPayload = {
 costType?: string
 quantity?: number
 unitRate?: number
 totalCost?: number
}

type AttachmentPayload = {
 type?: string
 content?: string
 s3Key?: string
 name?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
 typeof value === 'object' && value !== null

const asString = (value: unknown): string | undefined =>
 typeof value === 'string' && value.trim().length > 0 ? value : undefined

const asNumber = (value: unknown): number | undefined =>
 typeof value === 'number' && Number.isFinite(value) ? value : undefined

const asBoolean = (value: unknown): boolean | undefined => {
 if (typeof value === 'boolean') {
 return value
 }
 if (typeof value === 'string') {
 const normalized = value.trim().toLowerCase()
 if (normalized === 'true') return true
 if (normalized === 'false') return false
 }
 return undefined
}

const asNumeric = (value: unknown): number | undefined => {
 if (typeof value === 'number' && Number.isFinite(value)) {
 return value
 }
 if (typeof value === 'string' && value.trim() !== '') {
 const parsed = Number(value)
 return Number.isFinite(parsed) ? parsed : undefined
 }
 return undefined
}

const sanitizeNullableString = (value?: string | null): string | null => {
 if (!value) return null
 const sanitized = sanitizeForDisplay(value)
 return sanitized || null
}

const sanitizeRequiredString = (value: string): string => {
 const sanitized = sanitizeForDisplay(value)
 return sanitized || value
}

const normalizeSkuData = (input: unknown): NewSkuPayload | undefined => {
 if (!isRecord(input)) return undefined
 return {
 skuCode: asString(input.skuCode),
 description: asString(input.description),
 asin: asString(input.asin),
 packSize: asNumeric(input.packSize),
 material: asString(input.material),
 unitDimensionsCm: asString(input.unitDimensionsCm),
 unitWeightKg: asNumeric(input.unitWeightKg),
 unitsPerCarton: asNumeric(input.unitsPerCarton),
 cartonDimensionsCm: asString(input.cartonDimensionsCm),
 cartonWeightKg: asNumeric(input.cartonWeightKg),
 packagingType: asString(input.packagingType)
 }
}

const normalizeBatchData = (input: unknown): NewBatchPayload | undefined => {
 if (!isRecord(input)) return undefined
 return {
 batchCode: asString(input.batchCode),
 description: asString(input.description),
 productionDate: asString(input.productionDate),
 expiryDate: asString(input.expiryDate),
 isActive: asBoolean(input.isActive)
 }
}

const parseDateValue = (value?: string | null): Date | null => {
 if (!value) return null
 const parsed = new Date(value)
 return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeTransactionLine(input: unknown): MutableTransactionLine {
 if (!isRecord(input)) {
 return {}
 }

 return {
 skuCode: asString(input.skuCode),
 skuId: asString(input.skuId),
 batchLot: asString(input.batchLot),
 cartons: asNumber(input.cartons),
 pallets: asNumber(input.pallets),
 storageCartonsPerPallet: asNumber(input.storageCartonsPerPallet),
 shippingCartonsPerPallet: asNumber(input.shippingCartonsPerPallet),
 storagePalletsIn: asNumber(input.storagePalletsIn),
 shippingPalletsOut: asNumber(input.shippingPalletsOut),
 unitsPerCarton: asNumber(input.unitsPerCarton),
 cartonsIn: asNumber(input.cartonsIn),
 cartonsOut: asNumber(input.cartonsOut),
 isNewSku: asBoolean(input.isNewSku),
 skuData: normalizeSkuData(input.skuData),
 batchData: normalizeBatchData(input.batchData)
 }
}

function normalizeCostInput(input: unknown): TransactionCostPayload | null {
 if (!isRecord(input)) {
 return null
 }

 const costType = asString(input.costType)
 const totalCost = asNumber(input.totalCost)

 if (!costType && !totalCost) {
 return null
 }

 return {
 costType,
 quantity: asNumber(input.quantity),
 unitRate: asNumber(input.unitRate),
 totalCost,
 }
}

function normalizeAttachmentInput(input: unknown): AttachmentPayload | null {
 if (!isRecord(input)) {
 return null
 }

 const type = asString(input.type)
 const content = asString(input.content)
 const s3Key = asString(input.s3Key)
 const name = asString(input.name)

 if (!type && !content && !s3Key && !name) {
 return null
 }

 return {
 type,
 content,
 s3Key,
 name,
 }
}

export async function GET(request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const searchParams = request.nextUrl.searchParams
 const limit = parseInt(searchParams.get('limit') || '100')
 const _includeAttachments = searchParams.get('includeAttachments') === 'true'

 const transactions = await prisma.inventoryTransaction.findMany({
 take: limit,
 orderBy: { transactionDate: 'desc' },
 select: {
 id: true,
 transactionDate: true,
 transactionType: true,
 batchLot: true,
 referenceId: true,
 cartonsIn: true,
 cartonsOut: true,
 storagePalletsIn: true,
 shippingPalletsOut: true,
 createdAt: true,
 shipName: true,
 trackingNumber: true,
 pickupDate: true,
 attachments: true,
 storageCartonsPerPallet: true,
 shippingCartonsPerPallet: true,
 unitsPerCarton: true,
 supplier: true,
 purchaseOrderId: true,
 purchaseOrderLineId: true,
 // Use snapshot data
 warehouseCode: true,
 warehouseName: true,
 skuCode: true,
 skuDescription: true,
 createdById: true,
 createdByName: true
 }
 })

 // Extract notes from attachments for each transaction and add nested objects for backward compatibility
 const transactionsWithNotes = transactions.map(transaction => {
 let notes = null;
 if (transaction.attachments && Array.isArray(transaction.attachments)) {
 const notesAttachment = (transaction.attachments as Array<{ type: string; content: string }>).find(att => att.type === 'notes');
 if (notesAttachment) {
 notes = notesAttachment.content;
 }
 }
 
 return {
 ...transaction,
 notes,
 // Add nested objects for backward compatibility
 warehouse: {
 id: '', // No longer have warehouse ID
 code: transaction.warehouseCode,
 name: transaction.warehouseName
 },
 sku: {
 id: '', // No longer have SKU ID
 skuCode: transaction.skuCode,
 description: transaction.skuDescription
 },
 createdBy: {
 id: transaction.createdById,
 fullName: transaction.createdByName
 }
 };
 });

 return NextResponse.json({ transactions: transactionsWithNotes })
 } catch (_error) {
 // console.error('Failed to fetch transactions:', _error)
 return NextResponse.json({ 
 error: 'Failed to fetch transactions' 
 }, { status: 500 })
 }
}

export async function POST(request: NextRequest) {
 const errorContext: Record<string, unknown> = {}
 try {
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const bodyText = await request.text()
 
 const body = JSON.parse(bodyText)
 
 
 const { type, transactionType, referenceNumber, referenceId, date, transactionDate, pickupDate, items, lineItems, shipName, trackingNumber, attachments, notes, 
 warehouseId: bodyWarehouseId, skuId, batchLot, cartonsIn, cartonsOut, storagePalletsIn, shippingPalletsOut, supplier, costs } = body
 
 // Extracted values were logged here
 
 // Sanitize text inputs
 const sanitizedReferenceNumber = referenceNumber ? sanitizeForDisplay(referenceNumber) : null
 const sanitizedReferenceId = referenceId ? sanitizeForDisplay(referenceId) : null
 const sanitizedShipName = shipName ? sanitizeForDisplay(shipName) : null
 const sanitizedTrackingNumber = trackingNumber ? sanitizeForDisplay(trackingNumber) : null
 const sanitizedNotes = notes ? sanitizeForDisplay(notes) : null
 const sanitizedSupplier = supplier ? sanitizeForDisplay(supplier) : null

 // Handle both 'type' and 'transactionType' fields for backward compatibility
 const txType = type || transactionType
 errorContext.txType = txType
 const refNumber = sanitizedReferenceNumber || sanitizedReferenceId
 errorContext.referenceNumber = refNumber
 const txDate = date || transactionDate

 // Validate transaction type
 if (!txType || !['RECEIVE', 'SHIP', 'ADJUST_IN', 'ADJUST_OUT'].includes(txType)) {
 return NextResponse.json({ 
 error: 'Invalid transaction type. Must be RECEIVE, SHIP, ADJUST_IN, or ADJUST_OUT' 
 }, { status: 400 })
 }

const rawItemsInput = Array.isArray(items) ? items : Array.isArray(lineItems) ? lineItems : []
let itemsArray: MutableTransactionLine[] = rawItemsInput.map(normalizeTransactionLine)

const attachmentList: AttachmentPayload[] = Array.isArray(attachments)
? attachments
.map(normalizeAttachmentInput)
.filter((item): item is AttachmentPayload => item !== null)
: []
const batchValidationCache = new Map<string, boolean>()
const pendingBatchCreates = new Map<
 string,
 {
  skuId?: string
  skuCode: string
  batchLot: string
  description?: string | null
 }
>()

 const newSkuRequests = itemsArray.filter(item => item.isNewSku)
 if (newSkuRequests.length > 0) {
 if (txType !== 'RECEIVE') {
 return NextResponse.json({
 error: 'New SKU creation is only supported for RECEIVE transactions'
 }, { status: 400 })
 }

 const newSkuCodes = new Set<string>()
 for (const item of newSkuRequests) {
 const skuData = item.skuData
 const batchData = item.batchData

 if (!skuData || !batchData) {
 return NextResponse.json({
 error: 'New SKU requests must include both skuData and batchData payloads'
 }, { status: 400 })
 }

 if (!skuData.skuCode || !skuData.description) {
 return NextResponse.json({
 error: 'SKU code and description are required for new SKU creation'
 }, { status: 400 })
 }

 if (!skuData.packSize || !Number.isInteger(skuData.packSize) || skuData.packSize < 1) {
 return NextResponse.json({
 error: `Pack size must be a positive integer for new SKU ${skuData.skuCode}`
 }, { status: 400 })
 }

 if (!skuData.unitsPerCarton || !Number.isInteger(skuData.unitsPerCarton) || skuData.unitsPerCarton < 1) {
 return NextResponse.json({
 error: `Units per carton must be a positive integer for new SKU ${skuData.skuCode}`
 }, { status: 400 })
 }

 if (!batchData.batchCode) {
 return NextResponse.json({
 error: `Batch code is required for new SKU ${skuData.skuCode}`
 }, { status: 400 })
 }

 if (skuData.skuCode !== item.skuCode) {
 return NextResponse.json({
 error: `SKU code mismatch for new SKU line item (${skuData.skuCode} vs ${item.skuCode})`
 }, { status: 400 })
 }

 if (batchData.batchCode !== item.batchLot) {
 return NextResponse.json({
 error: `Batch code mismatch for new SKU ${skuData.skuCode}`
 }, { status: 400 })
 }

 if (batchData.productionDate && !parseDateValue(batchData.productionDate)) {
 return NextResponse.json({
 error: `Invalid production date for SKU ${skuData.skuCode}`
 }, { status: 400 })
 }

 if (batchData.expiryDate && !parseDateValue(batchData.expiryDate)) {
 return NextResponse.json({
 error: `Invalid expiry date for SKU ${skuData.skuCode}`
 }, { status: 400 })
 }

 if (newSkuCodes.has(skuData.skuCode)) {
 return NextResponse.json({
 error: `Duplicate new SKU detected: ${skuData.skuCode}`
 }, { status: 400 })
 }
 newSkuCodes.add(skuData.skuCode)
 }

 if (newSkuCodes.size > 0) {
 const conflicts = await prisma.sku.findMany({
 where: { skuCode: { in: Array.from(newSkuCodes) } },
 select: { skuCode: true }
 })

 if (conflicts.length > 0) {
 return NextResponse.json({
 error: `SKU ${conflicts[0].skuCode} already exists. Remove the new SKU flag and select the existing product.`
 }, { status: 400 })
 }
 }
 }

 if (['ADJUST_IN', 'ADJUST_OUT'].includes(txType)) {
 if (!skuId || !batchLot) {
 return NextResponse.json({
 error: 'Missing required fields for adjustment: skuId and batchLot',
 }, { status: 400 })
 }

 const sku = await prisma.sku.findUnique({
 where: { id: skuId },
 select: { skuCode: true },
 })

 if (!sku) {
 return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
 }

 itemsArray = [{
 skuCode: sku.skuCode,
 batchLot,
 cartons: cartonsIn ?? cartonsOut ?? 0,
 pallets: storagePalletsIn ?? shippingPalletsOut ?? 0,
 }]
 }

 // Validate required fields for non-adjustment transactions
 if (['RECEIVE', 'SHIP'].includes(txType)) {
 if (!refNumber || !txDate || itemsArray.length === 0) {
 // VALIDATION FAILED - missing required fields
 return NextResponse.json({ 
 error: 'Missing required fields: PI/CI/PO number, date, and items',
 debug: {
 refNumber: refNumber || 'MISSING',
 txDate: txDate || 'MISSING',
 itemsLength: itemsArray?.length || 0
 }
 }, { status: 400 })
 }
 }

 // Validate required fields for all transactions
 if (!refNumber || !txDate) {
 return NextResponse.json({ 
 error: 'Missing required fields: reference number and date' 
 }, { status: 400 })
 }

 // Validate date format - use parseLocalDateTime to handle both date and datetime formats
 const transactionDateObj = parseLocalDateTime(txDate)
 
 if (isNaN(transactionDateObj.getTime())) {
 return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
 }
 
 // Future date restriction removed - businesses may need to schedule future transactions

 // Historical date validation removed - businesses may need to enter old data for migration or corrections

 // Validate warehouse assignment for staff
 if (session.user.role === 'staff' && !session.user.warehouseId) {
 return NextResponse.json({ error: 'No warehouse assigned' }, { status: 400 })
 }

 const warehouseId = session.user.warehouseId || bodyWarehouseId
 errorContext.warehouseId = warehouseId

 if (!warehouseId) {
 return NextResponse.json({ error: 'Warehouse ID required' }, { status: 400 })
 }
 
 // Get the full user data for createdByName
 const currentUser = await prisma.user.findUnique({
 where: { id: session.user.id },
 select: { fullName: true, username: true }
 })
 
 // Log if user lookup fails
 if (!currentUser) {
 // console.error(`User lookup failed for session user ID: ${session.user.id}`)
 }
 
 const createdByName = currentUser?.fullName || currentUser?.username || 'Unknown User'

 // Duplicate check removed - businesses may have legitimate duplicate references
 // (e.g., multiple shipments with same PO number)

 // Backdating check temporarily disabled - businesses need flexibility for corrections
 // TODO: Re-enable with override capability for admins
 /*
 const lastTransaction = await prisma.inventoryTransaction.findFirst({
 where: { warehouseId },
 orderBy: { transactionDate: 'desc' },
 select: { transactionDate: true, id: true }
 })

 if (lastTransaction && transactionDateObj < lastTransaction.transactionDate) {
 return NextResponse.json({ 
 error: `Cannot create backdated transactions. The last transaction in this warehouse was on ${lastTransaction.transactionDate.toLocaleDateString()}. New transactions must have a date on or after this date.`,
 details: {
 lastTransactionDate: lastTransaction.transactionDate,
 attemptedDate: transactionDateObj,
 lastTransactionId: lastTransaction.transactionId
 }
 }, { status: 400 })
 }
 */

 // Validate all items before processing
 for (const item of itemsArray) {
 // Support both 'cartons' and 'cartonsIn' for backward compatibility
 if (item.cartonsIn !== undefined && item.cartons === undefined) {
 item.cartons = item.cartonsIn
 }
 // Support 'cartonsOut' for SHIP transactions
 if (item.cartonsOut !== undefined && item.cartons === undefined) {
 item.cartons = item.cartonsOut
 }
 // Support both 'pallets' and 'storagePalletsIn' for backward compatibility
 if (item.storagePalletsIn !== undefined && item.pallets === undefined) {
 item.pallets = item.storagePalletsIn
 }
 // Support 'shippingPalletsOut' for SHIP transactions
 if (item.shippingPalletsOut !== undefined && item.pallets === undefined) {
 item.pallets = item.shippingPalletsOut
 }
 
 // Handle both skuId and skuCode for backward compatibility
 if (!item.skuCode && item.skuId) {
 // If skuCode is missing but skuId is provided, look it up
 const sku = await prisma.sku.findUnique({
 where: { id: item.skuId }
 })
 if (sku) {
 item.skuCode = sku.skuCode
 }
 }
 
 // Validate item structure
 if (!item.skuCode || !item.batchLot || typeof item.cartons !== 'number') {
 return NextResponse.json({ 
 error: `Invalid item structure. Each item must have skuCode, batchLot, and cartons` 
 }, { status: 400 })
 }
 
 // For RECEIVE transactions, validate storage and shipping configs
 if (txType === 'RECEIVE') {
 if (!item.storageCartonsPerPallet || item.storageCartonsPerPallet <= 0) {
 return NextResponse.json({ 
 error: `Storage configuration required for RECEIVE transactions. Please specify cartons per pallet for storage for SKU ${item.skuCode}` 
 }, { status: 400 })
 }
 if (!item.shippingCartonsPerPallet || item.shippingCartonsPerPallet <= 0) {
 return NextResponse.json({ 
 error: `Shipping configuration required for RECEIVE transactions. Please specify cartons per pallet for shipping for SKU ${item.skuCode}` 
 }, { status: 400 })
 }
 }
 
 // Validate cartons is a positive integer
 if (!Number.isInteger(item.cartons) || item.cartons <= 0) {
 return NextResponse.json({ 
 error: `Cartons must be positive integers. Invalid value for SKU ${item.skuCode}: ${item.cartons}` 
 }, { status: 400 })
 }
 
 // Validate maximum cartons (prevent unrealistic values)
 if (item.cartons > 10000) {
 return NextResponse.json({ 
 error: `Cartons value too large for SKU ${item.skuCode}. Maximum allowed: 10,000` 
 }, { status: 400 })
 }
 
 // Validate pallets if provided
 if (item.pallets !== undefined && item.pallets !== null) {
 if (!Number.isInteger(item.pallets) || item.pallets < 0 || item.pallets > 5000) {
 return NextResponse.json({ 
 error: `Pallets must be integers between 0 and 5,000. Invalid value for SKU ${item.skuCode}` 
 }, { status: 400 })
 }
 }
 
 // Validate and sanitize batch/lot
 if (!item.batchLot || item.batchLot.trim() === '') {
 return NextResponse.json({ 
 error: `Batch/Lot is required for SKU ${item.skuCode}` 
 }, { status: 400 })
 }

const sanitizedBatchLot = sanitizeForDisplay(item.batchLot)
const sanitizedSkuCode = sanitizeForDisplay(item.skuCode)
item.batchLot = sanitizedBatchLot || item.batchLot
item.skuCode = sanitizedSkuCode || item.skuCode

 if (item.isNewSku && item.skuData) {
 item.skuData.skuCode = item.skuCode
 }

 if (item.isNewSku && item.batchData) {
 item.batchData.batchCode = item.batchLot
 }

}

 // Check for duplicate SKU/batch combinations in the request
 const itemKeys = new Set<string>()
 for (const item of itemsArray) {
 const key = `${item.skuCode}-${item.batchLot}`
 if (itemKeys.has(key)) {
 return NextResponse.json({ 
 error: `Duplicate SKU/Batch combination found: ${item.skuCode} - ${item.batchLot}` 
 }, { status: 400 })
 }
 itemKeys.add(key)
 }

const validatedItems: ValidatedTransactionLine[] = itemsArray.map((item) => ({
 skuCode: item.skuCode!,
 batchLot: item.batchLot!,
 cartons: item.cartons!,
 pallets: item.pallets ?? undefined,
 storageCartonsPerPallet: item.storageCartonsPerPallet ?? null,
 shippingCartonsPerPallet: item.shippingCartonsPerPallet ?? null,
 storagePalletsIn: item.storagePalletsIn ?? undefined,
 shippingPalletsOut: item.shippingPalletsOut ?? undefined,
 unitsPerCarton: item.unitsPerCarton ?? undefined,
 isNewSku: item.isNewSku ?? false,
 skuData: item.skuData,
 batchData: item.batchData
}))
errorContext.itemCount = validatedItems.length

 // Get warehouse for transaction ID generation
 const warehouse = await prisma.warehouse.findUnique({
 where: { id: warehouseId }
 })
 
 if (!warehouse) {
 return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
 }

 const purchaseOrderCache = new Map<string, string>()

 for (const item of validatedItems) {
 item.batchLot = resolveBatchLot({
 rawBatchLot: item.batchLot,
 orderNumber: refNumber,
 warehouseCode: warehouse.code,
 skuCode: item.skuCode,
 transactionDate: transactionDateObj,
 })

 if (item.batchData) {
 item.batchData.batchCode = item.batchLot
 }
}

 // Verify all SKUs exist and check inventory for SHIP transactions
for (const item of validatedItems) {
 if (item.isNewSku) {
 continue
 }
 const sku = await prisma.sku.findFirst({
 where: { skuCode: item.skuCode }
 })

 if (!sku) {
 return NextResponse.json({ 
 error: `SKU ${item.skuCode} not found. Please create the SKU first.` 
 }, { status: 400 })
 }

 if (['RECEIVE', 'ADJUST_IN'].includes(txType)) {
 const cacheKey = `${sku.id}::${item.batchLot}`
 if (!batchValidationCache.has(cacheKey)) {
  const batchRecord = await prisma.skuBatch.findFirst({
   where: {
    skuId: sku.id,
    batchCode: item.batchLot,
    isActive: true,
   },
  })

  if (!batchRecord) {
   pendingBatchCreates.set(cacheKey, {
    skuId: sku.id,
    skuCode: sku.skuCode,
    batchLot: item.batchLot,
    description: item.batchData?.description ?? null,
   })
  }

  batchValidationCache.set(cacheKey, true)
 }
 }

 // For SHIP and ADJUST_OUT transactions, verify inventory availability
 if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
 // Calculate current balance from transactions
 const transactions = await prisma.inventoryTransaction.findMany({
 where: {
 warehouseCode: warehouse.code,
 skuCode: sku.skuCode,
 batchLot: item.batchLot,
 transactionDate: { lte: transactionDateObj }
 }
 })
 
 let currentCartons = 0
 for (const txn of transactions) {
 currentCartons += txn.cartonsIn - txn.cartonsOut
 }
 
 if (currentCartons < item.cartons) {
 return NextResponse.json({ 
 error: `Insufficient inventory for SKU ${item.skuCode} batch ${item.batchLot}. Available: ${currentCartons}, Requested: ${item.cartons}` 
 }, { status: 400 })
 }
 }
 }

 // Start performance tracking
 const startTime = Date.now();
 
 // Create transactions with proper database transaction and locking
 const result = await prisma.$transaction(async (tx) => {
 const transactions = [];
 const newSkuItems = validatedItems.filter(item => item.isNewSku)

 if (newSkuItems.length > 0) {
 for (const item of newSkuItems) {
 const skuData = item.skuData
 const batchData = item.batchData

 if (!skuData || !batchData) {
 throw new Error('Missing SKU or batch payload for new SKU creation')
 }

 const skuRecord = await tx.sku.create({
 data: {
 skuCode: sanitizeRequiredString(item.skuCode),
 asin: sanitizeNullableString(skuData.asin),
 description: sanitizeRequiredString(skuData.description ?? ''),
 packSize: skuData.packSize ?? null,
 material: sanitizeNullableString(skuData.material),
 unitDimensionsCm: sanitizeNullableString(skuData.unitDimensionsCm),
 unitWeightKg: skuData.unitWeightKg ?? null,
 unitsPerCarton: skuData.unitsPerCarton ?? 1,
 cartonDimensionsCm: sanitizeNullableString(skuData.cartonDimensionsCm),
 cartonWeightKg: skuData.cartonWeightKg ?? null,
 packagingType: sanitizeNullableString(skuData.packagingType),
 isActive: true
 }
 })

 const productionDate = parseDateValue(batchData.productionDate)
 const expiryDate = parseDateValue(batchData.expiryDate)

 await tx.skuBatch.create({
 data: {
 skuId: skuRecord.id,
 batchCode: sanitizeRequiredString(item.batchLot),
 description: sanitizeNullableString(batchData.description),
 productionDate,
 expiryDate,
 isActive: batchData.isActive ?? true
 }
 })
 }
 }

 // Pre-fetch all SKUs to reduce queries
 const skuCodes = validatedItems.map((item) => item.skuCode)
 const skus = await tx.sku.findMany({
 where: { skuCode: { in: skuCodes } }
 });

 if (pendingBatchCreates.size > 0) {
  for (const pending of pendingBatchCreates.values()) {
    if (!pending.skuId) continue
    try {
      await tx.skuBatch.create({
        data: {
          skuId: pending.skuId,
          batchCode: pending.batchLot,
          description: sanitizeNullableString(pending.description),
          isActive: true,
        },
      })
    } catch (creationError) {
      if (
        !(creationError instanceof Prisma.PrismaClientKnownRequestError) ||
        creationError.code !== 'P2002'
      ) {
        throw creationError
      }
      // If another request created the batch simultaneously, it's safe to continue.
    }
  }
 }

 const skuMap = new Map(skus.map(sku => [sku.skuCode, sku]));
 
 for (const item of validatedItems) {
 const sku = skuMap.get(item.skuCode);
 if (!sku) {
 throw new Error(`SKU not found: ${item.skuCode}`);
 }

 // Calculate pallet values
 let calculatedStoragePalletsIn = null
 let calculatedShippingPalletsOut = null
 let _palletVarianceNotes = null
 let batchShippingCartonsPerPallet = item.shippingCartonsPerPallet
 
 if (['RECEIVE', 'ADJUST_IN'].includes(txType)) {
 // For adjustments, use provided pallets value directly
 if (txType === 'ADJUST_IN' && item.pallets) {
 calculatedStoragePalletsIn = item.pallets
 } else if ((item.storageCartonsPerPallet ?? 0) > 0) {
 calculatedStoragePalletsIn = Math.ceil(item.cartons / (item.storageCartonsPerPallet ?? 1))
 if (item.pallets !== calculatedStoragePalletsIn) {
 _palletVarianceNotes = `Storage pallet variance: Actual ${item.pallets}, Calculated ${calculatedStoragePalletsIn} (${item.cartons} cartons @ ${item.storageCartonsPerPallet}/pallet)`
 }
 }
 } else if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
 // For SHIP, get the batch-specific config from the original RECEIVE transaction
 const originalReceive = await tx.inventoryTransaction.findFirst({
 where: {
 warehouseCode: warehouse.code,
 skuCode: sku.skuCode,
 batchLot: item.batchLot,
 transactionType: 'RECEIVE'
 },
 orderBy: { transactionDate: 'asc' }
 });
 
 if (txType === 'ADJUST_OUT' && item.pallets) {
 calculatedShippingPalletsOut = item.pallets
 } else if (originalReceive?.shippingCartonsPerPallet) {
 batchShippingCartonsPerPallet = originalReceive.shippingCartonsPerPallet
 calculatedShippingPalletsOut = Math.ceil(item.cartons / batchShippingCartonsPerPallet)
 if (item.pallets !== calculatedShippingPalletsOut) {
 const _palletVarianceNotes = `Shipping pallet variance: Actual ${item.pallets}, Calculated ${calculatedShippingPalletsOut} (${item.cartons} cartons @ ${batchShippingCartonsPerPallet}/pallet)`
 }
 }
 }
 
 // Use the provided reference number (commercial invoice) directly
 const referenceId = refNumber
 const unitsPerCarton = item.unitsPerCarton ?? sku.unitsPerCarton ?? 1
 const pickupDateCandidate = pickupDate ? parseLocalDateTime(pickupDate) : transactionDateObj
 const pickupDateObj = Number.isNaN(pickupDateCandidate.getTime()) ? transactionDateObj : pickupDateCandidate
 const counterpartyName = ['RECEIVE', 'ADJUST_IN'].includes(txType)
 ? sanitizedSupplier ?? null
 : sanitizedShipName ?? sanitizedSupplier ?? null

 const cacheKey = `${warehouse.code}:${refNumber}`
 const cachedPurchaseOrderId = purchaseOrderCache.get(cacheKey)

 const { purchaseOrderId, purchaseOrderLineId, batchLot: normalizedBatchLot } = await ensurePurchaseOrderForTransaction(tx, {
 orderNumber: refNumber,
 transactionType: txType as TransactionType,
 warehouseCode: warehouse.code,
 warehouseName: warehouse.name,
 counterpartyName,
 transactionDate: transactionDateObj,
 expectedDate: pickupDateObj,
 skuCode: sku.skuCode,
 skuDescription: sku.description,
 batchLot: item.batchLot,
 quantity: item.cartons,
 unitsPerCarton,
 createdById: session.user.id,
 createdByName,
 notes: sanitizedNotes,
 purchaseOrderId: cachedPurchaseOrderId,
 })

 if (!cachedPurchaseOrderId) {
 purchaseOrderCache.set(cacheKey, purchaseOrderId)
 }

 const transaction = await tx.inventoryTransaction.create({
 data: {
 // Warehouse snapshot data
 warehouseCode: warehouse.code,
 warehouseName: warehouse.name,
 warehouseAddress: warehouse.address,
 // SKU snapshot data
 skuCode: sku.skuCode,
 skuDescription: sku.description,
 unitDimensionsCm: sku.unitDimensionsCm,
 unitWeightKg: sku.unitWeightKg,
 cartonDimensionsCm: sku.cartonDimensionsCm,
 cartonWeightKg: sku.cartonWeightKg,
 packagingType: sku.packagingType,
 batchLot: normalizedBatchLot,
 transactionType: txType as TransactionType,
 referenceId: referenceId,
 cartonsIn: ['RECEIVE', 'ADJUST_IN'].includes(txType) ? item.cartons : 0,
 cartonsOut: ['SHIP', 'ADJUST_OUT'].includes(txType) ? item.cartons : 0,
 storagePalletsIn: ['RECEIVE', 'ADJUST_IN'].includes(txType) ? (item.storagePalletsIn ?? item.pallets ?? calculatedStoragePalletsIn ?? 0) : 0,
 shippingPalletsOut: ['SHIP', 'ADJUST_OUT'].includes(txType) ? (item.shippingPalletsOut ?? item.pallets ?? calculatedShippingPalletsOut ?? 0) : 0,
 storageCartonsPerPallet: txType === 'RECEIVE' ? item.storageCartonsPerPallet ?? null : null,
 shippingCartonsPerPallet: txType === 'RECEIVE'
 ? item.shippingCartonsPerPallet ?? null
 : (txType === 'SHIP' ? batchShippingCartonsPerPallet : null),
 shipName: sanitizedShipName,
 trackingNumber: sanitizedTrackingNumber || null,
 supplier: txType === 'RECEIVE' ? sanitizedSupplier : null,
 attachments: (() => {
 const combinedAttachments = [...attachmentList]
 if (sanitizedNotes) {
 combinedAttachments.push({ type: 'notes', content: sanitizedNotes })
 }
 return combinedAttachments.length > 0 ? combinedAttachments : null
 })(),
 transactionDate: transactionDateObj,
 pickupDate: pickupDateObj,
 createdById: session.user.id,
 createdByName: createdByName,
 unitsPerCarton,
 purchaseOrderId,
 purchaseOrderLineId,
 }
 })

 transactions.push(transaction)

 // Save costs to CostLedger if provided manually
 const normalizedCosts = Array.isArray(costs)
 ? costs.map(normalizeCostInput).filter((value): value is TransactionCostPayload => value !== null)
 : []

 if (normalizedCosts.length > 0) {
 for (const cost of normalizedCosts) {
 if (cost.totalCost && cost.totalCost > 0) {
 // Map frontend cost types to database enum values
 let costCategory: CostCategory = CostCategory.Container
 if (cost.costType === 'container') {
 costCategory = CostCategory.Container
 } else if (cost.costType === 'carton') {
 costCategory = CostCategory.Carton
 } else if (cost.costType === 'pallet') {
 costCategory = CostCategory.Pallet
 } else if (cost.costType === 'transportation') {
 costCategory = CostCategory.transportation
 } else if (cost.costType === 'storage') {
 costCategory = CostCategory.Storage
 } else if (cost.costType === 'unit') {
 costCategory = CostCategory.Unit
 } else if (cost.costType === 'accessorial') {
 costCategory = CostCategory.Accessorial
 }
 
      await tx.costLedger.create({
        data: {
          transactionId: transaction.id,
          costCategory,
          quantity: cost.quantity || 1,
          unitRate: cost.unitRate || 0,
 totalCost: cost.totalCost || 0,
 warehouseCode: warehouse.code,
 warehouseName: warehouse.name,
 createdByName: createdByName,
 createdAt: transactionDateObj
 }
 })
 }
 }
 }
 // Note: RECEIVE transaction costs are pre-filled by the frontend based on warehouse cost rates
 // and sent as part of the costs array, so they're handled by the manual cost path above
 }

 // Inventory balances are now calculated at runtime from transactions
 // No need to update a separate balance table
 
 return transactions;
 });

 // Record storage cost entries for each transaction
 await Promise.all(
 result.map((t) =>
 recordStorageCostEntry({
 warehouseCode: t.warehouseCode,
 warehouseName: t.warehouseName,
 skuCode: t.skuCode,
 skuDescription: t.skuDescription,
 batchLot: t.batchLot,
 transactionDate: t.transactionDate,
 }).catch((storageError) => {
 // Don't fail transaction processing if storage cost recording fails
 const message = storageError instanceof Error ? storageError.message : 'Unknown error'
 console.error(
 `Storage cost recording failed for ${t.warehouseCode}/${t.skuCode}/${t.batchLot}:`,
 message
 )
 })
 )
 );

 const duration = Date.now() - startTime;
 
 // Log successful transaction completion
 businessLogger.info('Inventory transaction completed successfully', {
 transactionType: txType,
 referenceNumber: refNumber,
 warehouseId,
 transactionCount: result.length,
 transactionIds: result.map(t => t.id),
 totalCartons: validatedItems.reduce((sum, item) => sum + item.cartons, 0),
 duration,
 userId: session.user.id
 });
 
 // Log performance metrics
 perfLogger.log('Transaction processing completed', {
 transactionType: txType,
 itemCount: validatedItems.length,
 duration,
 avgDurationPerItem: duration / Math.max(validatedItems.length, 1)
 });
 
 // Cost calculation is now handled automatically by Prisma middleware
 // The middleware will detect transactions with costs and process them
 // No manual trigger needed!
 
 return NextResponse.json({
 success: true,
 message: `${result.length} transactions created`,
 transactionIds: result.map(t => t.id), // Return UUIDs for navigation
 })
 } catch (error: unknown) {
 // console.error('Transaction error:', error);
 // console.error('Error stack:', error.stack);
 
 // Check for specific error types
 if (error instanceof Error) {
 if (error.message.includes('Insufficient inventory')) {
 return NextResponse.json({ error: error.message }, { status: 400 })
 }

 if (
 error.message.includes('could not serialize') ||
 error.message.includes('deadlock') ||
 error.message.includes('concurrent update')
 ) {
 return NextResponse.json(
 {
 error: 'Transaction conflict detected. Please try again.',
 details: 'Another transaction is modifying the same inventory. Please retry your request.',
 },
 { status: 409 }
 )
 }
 }
 
 const detailMessage = error instanceof Error ? error.message : 'Unknown error'
 businessLogger.error('Inventory transaction failed', {
  ...errorContext,
  detail: detailMessage,
 })
 return NextResponse.json(
  { 
   error: detailMessage,
   details: detailMessage
  },
  { status: 500 }
 )
 }
}

// Prevent updates to maintain immutability
export async function PUT(_request: NextRequest) {
 return NextResponse.json({ 
 error: 'Inventory transactions are immutable and cannot be modified',
 message: 'To correct errors, please create an adjustment transaction (ADJUST_IN or ADJUST_OUT)'
 }, { status: 405 })
}

// Prevent deletes to maintain immutability
export async function DELETE(_request: NextRequest) {
 return NextResponse.json({ 
 error: 'Inventory transactions are immutable and cannot be deleted',
 message: 'The inventory ledger maintains a permanent audit trail. To correct errors, please create an adjustment transaction'
 }, { status: 405 })
}
