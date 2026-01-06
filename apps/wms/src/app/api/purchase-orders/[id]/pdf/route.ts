import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { getPurchaseOrderById } from '@/lib/services/purchase-order-service'
import { toPublicOrderNumber } from '@/lib/services/purchase-order-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function sanitizeFilename(value: string): string {
  return value.trim().replaceAll(/[^a-z0-9._-]+/gi, '-')
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return '—'
  return value.toISOString().slice(0, 10)
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function formatMoney(value: number | null, decimals = 2): string {
  if (value === null) return '—'
  return value.toFixed(decimals)
}

async function renderPurchaseOrderPdf(params: {
  poNumber: string
  supplierName: string
  status: string
  createdAt: Date
  expectedDate?: Date | null
  warehouseCode?: string | null
  warehouseName?: string | null
  notes?: string | null
  lines: Array<{
    skuCode: string
    skuDescription: string | null
    batchLot: string | null
    quantity: number
    currency: string
    unitCost: number | null
  }>
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.info.Title = `Purchase Order ${params.poNumber}`

  const chunks: Buffer[] = []
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  doc.fontSize(20).font('Helvetica-Bold').text('Purchase Order')
  doc.moveDown(0.5)
  doc.fontSize(12).font('Helvetica')
  doc.text(`PO #: ${params.poNumber}`)
  doc.text(`Supplier: ${params.supplierName || '—'}`)
  doc.text(`Status: ${params.status}`)
  doc.text(`Created: ${formatDate(params.createdAt)}`)
  doc.text(`Expected: ${formatDate(params.expectedDate ?? null)}`)
  doc.text(
    `Warehouse: ${
      params.warehouseName ?? params.warehouseCode ?? 'Not assigned'
    }${params.warehouseName && params.warehouseCode ? ` (${params.warehouseCode})` : ''}`
  )
  if (params.notes?.trim()) {
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').text('Notes')
    doc.font('Helvetica').fontSize(11).text(params.notes.trim())
    doc.fontSize(12)
  }

  doc.moveDown(1)

  const startX = doc.page.margins.left
  const startY = doc.y

  const col = {
    sku: 70,
    description: 160,
    batch: 60,
    quantity: 45,
    currency: 45,
    unit: 55,
    total: 60,
  } as const

  const positions = {
    sku: startX,
    description: startX + col.sku,
    batch: startX + col.sku + col.description,
    quantity: startX + col.sku + col.description + col.batch,
    currency: startX + col.sku + col.description + col.batch + col.quantity,
    unit: startX + col.sku + col.description + col.batch + col.quantity + col.currency,
    total:
      startX + col.sku + col.description + col.batch + col.quantity + col.currency + col.unit,
  } as const

  const rowHeight = 18
  const tableTopPadding = 6

  const drawHeader = () => {
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('SKU', positions.sku, doc.y, { width: col.sku })
    doc.text('Description', positions.description, doc.y, { width: col.description })
    doc.text('Batch', positions.batch, doc.y, { width: col.batch })
    doc.text('Qty', positions.quantity, doc.y, { width: col.quantity, align: 'right' })
    doc.text('Curr', positions.currency, doc.y, { width: col.currency })
    doc.text('Unit', positions.unit, doc.y, { width: col.unit, align: 'right' })
    doc.text('Total', positions.total, doc.y, { width: col.total, align: 'right' })
    doc.moveDown(0.4)
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + Object.values(col).reduce((sum, width) => sum + width, 0), doc.y)
      .strokeColor('#d1d5db')
      .stroke()
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10)
  }

  doc.y = startY + tableTopPadding
  drawHeader()

  const totalsByCurrency = new Map<string, { total: number }>()
  let totalQuantity = 0

  for (const line of params.lines) {
    const currency = (line.currency || 'USD').toUpperCase()
    const unitCost = line.unitCost
    const lineTotal = unitCost !== null ? unitCost * line.quantity : null
    totalQuantity += line.quantity

    if (lineTotal !== null) {
      const entry = totalsByCurrency.get(currency) ?? { total: 0 }
      entry.total += lineTotal
      totalsByCurrency.set(currency, entry)
    }

    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage()
      drawHeader()
    }

    doc.text(line.skuCode, positions.sku, doc.y, { width: col.sku })
    doc.text(line.skuDescription ?? '—', positions.description, doc.y, {
      width: col.description,
      ellipsis: true,
    })
    doc.text(line.batchLot ?? '—', positions.batch, doc.y, { width: col.batch })
    doc.text(line.quantity.toLocaleString(), positions.quantity, doc.y, {
      width: col.quantity,
      align: 'right',
    })
    doc.text(currency, positions.currency, doc.y, { width: col.currency })
    doc.text(formatMoney(unitCost), positions.unit, doc.y, { width: col.unit, align: 'right' })
    doc.text(formatMoney(lineTotal), positions.total, doc.y, { width: col.total, align: 'right' })
    doc.moveDown(0.8)
  }

  doc.moveDown(0.5)
  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + Object.values(col).reduce((sum, width) => sum + width, 0), doc.y)
    .strokeColor('#d1d5db')
    .stroke()

  doc.moveDown(0.6)
  doc.font('Helvetica-Bold').fontSize(11).text(`Total quantity: ${totalQuantity.toLocaleString()}`)
  doc.font('Helvetica').fontSize(11)
  for (const [currency, totals] of totalsByCurrency.entries()) {
    doc.text(`Total cost (${currency}): ${totals.total.toFixed(2)}`)
  }

  doc.end()
  return await result
}

export const GET = withAuthAndParams(async (_request, params, _session) => {
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined

  if (!id) {
    return ApiResponses.badRequest('Purchase order ID is required')
  }

  const order = await getPurchaseOrderById(id)
  if (!order) {
    return ApiResponses.notFound('Purchase order not found')
  }

  const poNumber = order.poNumber ?? toPublicOrderNumber(order.orderNumber)
  const filename = `${sanitizeFilename(poNumber)}.pdf`

  const lines = order.lines.map(line => ({
    skuCode: line.skuCode,
    skuDescription: line.skuDescription ?? null,
    batchLot: line.batchLot ?? null,
    quantity: line.quantity,
    currency: line.currency,
    unitCost: toNumber(line.unitCost),
  }))

  const pdf = await renderPurchaseOrderPdf({
    poNumber,
    supplierName: order.counterpartyName ?? '',
    status: order.status,
    createdAt: order.createdAt,
    expectedDate: order.expectedDate,
    warehouseCode: order.warehouseCode,
    warehouseName: order.warehouseName,
    notes: order.notes,
    lines,
  })

  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.byteLength),
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
})
