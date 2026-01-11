import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { getPurchaseOrderById } from '@/lib/services/purchase-order-service'
import { toPublicOrderNumber } from '@/lib/services/purchase-order-utils'
import { getCurrentTenant, getTenantPrisma } from '@/lib/tenant/server'
import { BUYER_LEGAL_ENTITY, getBuyerVatNumber } from '@/lib/config/legal-entity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Professional color palette
const COLORS = {
  navy: '#0F172A',
  slate: '#334155',
  muted: '#64748B',
  border: '#CBD5E1',
  lightBg: '#F8FAFC',
  accent: '#0EA5E9',
  white: '#FFFFFF',
} as const

function sanitizeFilename(value: string): string {
  return value.trim().replaceAll(/[^a-z0-9._-]+/gi, '-')
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return '—'
  return value.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function formatCurrency(value: number | null, currency: string): string {
  if (value === null) return '—'
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Extract just the batch part from strings like "CS 007 - BATCH 16"
function extractBatchCode(batchLot: string | null): string {
  if (!batchLot) return '—'
  // If it contains " - ", take the part after it
  const parts = batchLot.split(' - ')
  if (parts.length > 1) {
    return parts[parts.length - 1]
  }
  return batchLot
}

async function renderPurchaseOrderPdf(params: {
  poNumber: string
  buyerName: string
  buyerAddress: string
  buyerVatNumber?: string | null
  supplierName: string
  supplierAddress?: string | null
  createdAt: Date
  destinationCountry?: string | null
  destinationAddress?: string | null
  expectedDate?: Date | null
  incoterms?: string | null
  paymentTerms?: string | null
  warehouseCode?: string | null
  warehouseName?: string | null
  notes?: string | null
  lines: Array<{
    skuCode: string
    skuDescription: string | null
    batchLot: string | null
    unitsOrdered: number
    unitsPerCarton: number
    cartons: number
    currency: string
    unitCost: number | null
    totalCost: number | null
  }>
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
  })
  doc.info.Title = `Purchase Order ${params.poNumber}`
  doc.info.Author = params.buyerName

  const chunks: Buffer[] = []
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const pageWidth = doc.page.width  // 595.28 for A4
  const pageHeight = doc.page.height // 841.89 for A4
  const margin = 50
  const contentWidth = pageWidth - margin * 2 // ~495
  const contentBottomY = pageHeight - margin
  const footerLineY = contentBottomY - 18
  const footerTextY = footerLineY + 6
  const bodyBottomY = footerLineY - 8

  // Pre-calculate totals
  const totalsByCurrency = new Map<string, number>()
  let totalUnits = 0
  let totalCartons = 0

  for (const line of params.lines) {
    const lineTotal = line.totalCost ?? (line.unitCost !== null ? line.unitCost * line.unitsOrdered : null)
    totalUnits += line.unitsOrdered
    totalCartons += line.cartons
    if (lineTotal !== null) {
      const currency = (line.currency || 'USD').toUpperCase()
      totalsByCurrency.set(currency, (totalsByCurrency.get(currency) ?? 0) + lineTotal)
    }
  }

  // ============================================
  // HEADER SECTION
  // ============================================

  let y = margin

  // Company name - small, muted
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.text(params.buyerName.toUpperCase(), margin, y)

  doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
  doc.text(params.buyerAddress, margin, y + 12, { width: contentWidth * 0.6 })

  if (params.buyerVatNumber) {
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
    doc.text(`VAT: ${params.buyerVatNumber}`, margin, y + 24, { width: contentWidth * 0.6 })
  }

  const poY = y + (params.buyerVatNumber ? 38 : 28)

  // PO Number - HERO
  doc.fillColor(COLORS.navy).fontSize(28).font('Helvetica-Bold')
  doc.text(params.poNumber, margin, poY)

  // Document type
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.text('PURCHASE ORDER', margin, poY + 32)

  // Order date on right
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('ORDER DATE', pageWidth - margin - 100, y, { width: 100, align: 'right' })
  doc.fillColor(COLORS.navy).fontSize(10).font('Helvetica-Bold')
  doc.text(formatDate(params.createdAt), pageWidth - margin - 100, y + 11, { width: 100, align: 'right' })

  y = poY + 56

  // Divider
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(COLORS.border).lineWidth(1).stroke()
  y += 20

  // ============================================
  // FROM / TO SECTION
  // ============================================

  const colWidth = (contentWidth - 40) / 2

  // SUPPLIER
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('SUPPLIER', margin, y)

  let supplierY = y + 12
  doc.fillColor(COLORS.navy).fontSize(10).font('Helvetica-Bold')
  doc.text(params.supplierName || '—', margin, supplierY, { width: colWidth })
  supplierY += doc.heightOfString(params.supplierName || '—', { width: colWidth }) + 2

  let supplierEndY = supplierY
  if (params.supplierAddress) {
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
    doc.text(params.supplierAddress, margin, supplierY, { width: colWidth })
    supplierEndY = supplierY + doc.heightOfString(params.supplierAddress, { width: colWidth })
  }

  // SHIP TO
  const toX = margin + colWidth + 40
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('SHIP TO', toX, y)

  let shipToY = y + 12
  const shipTo = params.warehouseName || params.destinationCountry || '—'
  doc.fillColor(COLORS.navy).fontSize(10).font('Helvetica-Bold')
  doc.text(shipTo, toX, shipToY, { width: colWidth })
  shipToY += doc.heightOfString(shipTo, { width: colWidth }) + 2

  let shipToEndY = shipToY
  if (params.warehouseName && params.destinationCountry) {
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
    doc.text(params.destinationCountry, toX, shipToY, { width: colWidth })
    shipToEndY = shipToY + doc.heightOfString(params.destinationCountry, { width: colWidth })
  }

  // Move y past whichever column is taller
  y = Math.max(supplierEndY, shipToEndY) + 16

  // ============================================
  // ORDER DETAILS ROW
  // ============================================

  const orderCurrency =
    totalsByCurrency.size === 1 ? Array.from(totalsByCurrency.keys())[0] : '—'

  // First 3 columns fixed width, payment terms gets remaining space
  const col1W = 80  // Cargo Ready
  const col2W = 60  // Incoterms
  const col3W = 60  // Currency
  const col4W = contentWidth - col1W - col2W - col3W  // Payment Terms

  // Cargo Ready
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('CARGO READY', margin, y)
  doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold')
  doc.text(formatDate(params.expectedDate), margin, y + 11, { width: col1W - 8 })

  // Incoterms
  const col2X = margin + col1W
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('INCOTERMS', col2X, y)
  doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold')
  doc.text(params.incoterms || '—', col2X, y + 11, { width: col2W - 8 })

  // Currency
  const col3X = col2X + col2W
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('CURRENCY', col3X, y)
  doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold')
  doc.text(orderCurrency, col3X, y + 11, { width: col3W - 8 })

  // Payment Terms (allow wrapping)
  const col4X = col3X + col3W
  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('PAYMENT TERMS', col4X, y)
  doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold')
  const paymentTermsText = params.paymentTerms || '—'
  doc.text(paymentTermsText, col4X, y + 11, { width: col4W })

  // Calculate height of payment terms for y advancement
  const paymentTermsHeight = doc.heightOfString(paymentTermsText, { width: col4W })
  y += Math.max(28, 11 + paymentTermsHeight + 8)

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  // Column config - MUST fit within 495pt content width
  // Total: 60 + 55 + 125 + 50 + 40 + 40 + 55 + 70 = 495
  const cols = {
    sku:   { x: margin,       w: 60,  label: 'SKU',   align: 'left' as const },
    batch: { x: margin + 60,  w: 55,  label: 'BATCH', align: 'left' as const },
    desc:  { x: margin + 115, w: 125, label: 'DESCRIPTION', align: 'left' as const },
    units: { x: margin + 240, w: 50,  label: 'UNITS', align: 'right' as const },
    upc:   { x: margin + 290, w: 40,  label: 'U/CTN', align: 'right' as const },
    ctns:  { x: margin + 330, w: 40,  label: 'CTNS',  align: 'right' as const },
    unit:  { x: margin + 370, w: 55,  label: 'UNIT',  align: 'right' as const },
    total: { x: margin + 425, w: 70,  label: 'TOTAL', align: 'right' as const },
  }

  const drawTableHeader = (atY: number) => {
    doc.rect(margin, atY, contentWidth, 18).fill(COLORS.navy)
    doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold')
    for (const col of Object.values(cols)) {
      doc.text(col.label, col.x + 4, atY + 5, { width: col.w - 8, align: col.align })
    }
    return atY + 18
  }

  if (y + 18 > bodyBottomY) {
    doc.addPage()
    y = margin
  }
  y = drawTableHeader(y)

  const rowHeight = 20
  let rowY = y

  const drawRow = (line: (typeof params.lines)[0], isAlt: boolean) => {
    const currency = (line.currency || 'USD').toUpperCase()
    const unitCost = line.unitCost
    const lineTotal = line.totalCost ?? (unitCost !== null ? unitCost * line.unitsOrdered : null)

    if (isAlt) {
      doc.rect(margin, rowY, contentWidth, rowHeight).fill(COLORS.lightBg)
    }

    const textY = rowY + 5

    // SKU
    doc.fillColor(COLORS.navy).fontSize(8).font('Helvetica-Bold')
    doc.text(line.skuCode, cols.sku.x + 4, textY, { width: cols.sku.w - 8, lineBreak: false, ellipsis: true })

    // Batch (extract just the batch part)
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica')
    doc.text(extractBatchCode(line.batchLot), cols.batch.x + 4, textY, { width: cols.batch.w - 8, lineBreak: false, ellipsis: true })

    // Description
    doc.fillColor(COLORS.slate).fontSize(7).font('Helvetica')
    doc.text(line.skuDescription || '—', cols.desc.x + 4, textY, { width: cols.desc.w - 8, lineBreak: false, ellipsis: true })

    // Numbers
    doc.fillColor(COLORS.navy).fontSize(8).font('Helvetica')
    doc.text(line.unitsOrdered.toLocaleString(), cols.units.x, textY, { width: cols.units.w - 4, align: 'right' })
    doc.text(line.unitsPerCarton.toLocaleString(), cols.upc.x, textY, { width: cols.upc.w - 4, align: 'right' })
    doc.text(line.cartons.toLocaleString(), cols.ctns.x, textY, { width: cols.ctns.w - 4, align: 'right' })

    // Unit price
    doc.fillColor(COLORS.muted).fontSize(7).font('Helvetica')
    doc.text(unitCost !== null ? formatCurrency(unitCost, currency) : '—', cols.unit.x, textY, { width: cols.unit.w - 4, align: 'right' })

    // Total
    doc.fillColor(COLORS.navy).fontSize(8).font('Helvetica-Bold')
    doc.text(lineTotal !== null ? formatCurrency(lineTotal, currency) : '—', cols.total.x, textY, { width: cols.total.w - 4, align: 'right' })

    // Row border
    doc.moveTo(margin, rowY + rowHeight).lineTo(pageWidth - margin, rowY + rowHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke()
  }

  // Draw all rows
  for (let i = 0; i < params.lines.length; i++) {
    if (rowY + rowHeight > bodyBottomY) {
      doc.addPage()
      rowY = margin
      rowY = drawTableHeader(rowY)
    }

    drawRow(params.lines[i], i % 2 === 1)
    rowY += rowHeight
  }

  y = rowY + 12

  // ============================================
  // TOTALS
  // ============================================

  // Check if totals fit (need space for totals box + footer)
  const totalsHeight = 60 + totalsByCurrency.size * 18
  if (y + totalsHeight > bodyBottomY) {
    doc.addPage()
    y = margin
  }

  const totalsW = 180
  const totalsX = pageWidth - margin - totalsW

  doc.rect(totalsX, y, totalsW, totalsHeight).fill(COLORS.lightBg)

  let ty = y + 10

  doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
  doc.text('Total Units', totalsX + 12, ty)
  doc.fillColor(COLORS.navy).font('Helvetica-Bold')
  doc.text(totalUnits.toLocaleString(), totalsX + 12, ty, { width: totalsW - 24, align: 'right' })

  ty += 16

  doc.fillColor(COLORS.muted).font('Helvetica')
  doc.text('Total Cartons', totalsX + 12, ty)
  doc.fillColor(COLORS.navy).font('Helvetica-Bold')
  doc.text(totalCartons.toLocaleString(), totalsX + 12, ty, { width: totalsW - 24, align: 'right' })

  ty += 18
  doc.moveTo(totalsX + 8, ty - 2).lineTo(totalsX + totalsW - 8, ty - 2).strokeColor(COLORS.border).lineWidth(0.5).stroke()

  for (const [currency, total] of totalsByCurrency.entries()) {
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
    doc.text(`Total (${currency})`, totalsX + 12, ty)
    doc.fillColor(COLORS.navy).fontSize(10).font('Helvetica-Bold')
    doc.text(formatCurrency(total, currency), totalsX + 12, ty, { width: totalsW - 24, align: 'right' })
    ty += 18
  }

  // ============================================
  // NOTES (if any)
  // ============================================

  if (params.notes?.trim()) {
    y = ty + 20
    if (y + 60 > bodyBottomY) {
      doc.addPage()
      y = margin
    }

    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
    doc.text('NOTES', margin, y)
    y += 12
    doc.rect(margin, y, contentWidth, 40).fill(COLORS.lightBg)
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
    doc.text(params.notes.trim(), margin + 10, y + 8, { width: contentWidth - 20 })
  }

  // ============================================
  // FOOTER (all pages)
  // ============================================

  const pageCount = doc.bufferedPageRange().count
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)
    doc
      .moveTo(margin, footerLineY)
      .lineTo(pageWidth - margin, footerLineY)
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .stroke()

    doc.fillColor(COLORS.muted).fontSize(7).font('Helvetica')
    doc.text(`Generated: ${timestamp}`, margin, footerTextY)
    doc.text(`Page ${i + 1} of ${pageCount}`, 0, footerTextY, { width: pageWidth, align: 'center' })
    doc.text('targon.io', pageWidth - margin - 50, footerTextY, { width: 50, align: 'right' })
  }

  doc.end()
  return await result
}

export const GET = withAuthAndParams(async (_request, params, _session) => {
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined

  if (!id) {
    return ApiResponses.badRequest('Purchase order ID is required')
  }

  const order = await getPurchaseOrderById(id)
  if (!order) {
    return ApiResponses.notFound('Purchase order not found')
  }

  // Prefer snapshot supplier address stored on the PO. Fall back to live supplier for older POs.
  let supplierAddress: string | null = order.counterpartyAddress ?? null
  if (!supplierAddress && order.counterpartyName) {
    const prisma = await getTenantPrisma()
    const supplier = await prisma.supplier.findUnique({
      where: { name: order.counterpartyName },
      select: { address: true },
    })
    supplierAddress = supplier?.address ?? null
  }

  const tenant = await getCurrentTenant()
  const destinationCountry = `${tenant.name} (${tenant.displayName})`
  const buyerVatNumber = getBuyerVatNumber(tenant.code)

  const poNumber = order.poNumber ?? toPublicOrderNumber(order.orderNumber)
  const filename = `${sanitizeFilename(poNumber)}.pdf`

  const lines = order.lines.map(line => ({
    skuCode: line.skuCode,
    skuDescription: line.skuDescription ?? null,
    batchLot: line.batchLot ?? null,
    unitsOrdered: line.unitsOrdered,
    unitsPerCarton: line.unitsPerCarton,
    cartons: line.quantity,
    currency: line.currency,
    unitCost: toNumber(line.unitCost),
    totalCost: toNumber(line.totalCost),
  }))

  const pdf = await renderPurchaseOrderPdf({
    poNumber,
    buyerName: BUYER_LEGAL_ENTITY.name,
    buyerAddress: BUYER_LEGAL_ENTITY.address,
    buyerVatNumber,
    supplierName: order.counterpartyName ?? '',
    supplierAddress,
    createdAt: order.createdAt,
    destinationCountry,
    destinationAddress: null,
    expectedDate: order.expectedDate,
    incoterms: order.incoterms,
    paymentTerms: order.paymentTerms,
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
