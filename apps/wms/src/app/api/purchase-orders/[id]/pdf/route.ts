import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { getPurchaseOrderById } from '@/lib/services/purchase-order-service'
import { toPublicOrderNumber } from '@/lib/services/purchase-order-utils'
import { getCurrentTenant } from '@/lib/tenant/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Targon brand colors
const COLORS = {
  primary: '#002C51', // Dark navy
  accent: '#00C2B9', // Teal
  lightGray: '#F8FAFC',
  mediumGray: '#E2E8F0',
  darkGray: '#64748B',
  text: '#1E293B',
  white: '#FFFFFF',
} as const

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
  destinationCountry?: string | null
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
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.info.Title = `Purchase Order ${params.poNumber}`
  doc.info.Author = 'Targon Global'

  const chunks: Buffer[] = []
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const margin = doc.page.margins.left
  const contentWidth = pageWidth - margin * 2

  // ============================================
  // HEADER - Targon Branding
  // ============================================

  // Header background
  doc.rect(0, 0, pageWidth, 100).fill(COLORS.primary)

  // Accent bar
  doc.rect(0, 100, pageWidth, 4).fill(COLORS.accent)

  // Company name "Targon."
  doc.fillColor(COLORS.white).fontSize(28).font('Helvetica-Bold')
  doc.text('Targon.', margin, 30, { continued: false })

  // Tagline
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.accent)
  doc.text('Innovation to Impact', margin, 60)

  // Document title on right
  doc.fillColor(COLORS.white).fontSize(22).font('Helvetica-Bold')
  doc.text('PURCHASE ORDER', pageWidth - margin - 200, 35, { width: 200, align: 'right' })

  // PO Number badge
  doc.fontSize(11).font('Helvetica')
  doc.text(params.poNumber, pageWidth - margin - 200, 62, { width: 200, align: 'right' })

  // ============================================
  // ORDER INFO SECTION
  // ============================================

  let y = 130

  // Status badge
  const statusColors: Record<string, string> = {
    ISSUED: '#059669',
    MANUFACTURING: '#D97706',
    OCEAN: '#2563EB',
    WAREHOUSE: '#7C3AED',
    SHIPPED: '#10B981',
    DRAFT: '#6B7280',
    REJECTED: '#DC2626',
    CANCELLED: '#991B1B',
  }
  const statusColor = statusColors[params.status] ?? '#6B7280'

  // Dynamic badge width based on status length
  const statusText = params.status
  const badgeWidth = statusText.length > 8 ? 110 : 80
  const statusFontSize = statusText.length > 8 ? 8 : 9

  doc.roundedRect(margin, y, badgeWidth, 22, 4).fill(statusColor)
  doc.fillColor(COLORS.white).fontSize(statusFontSize).font('Helvetica-Bold')
  doc.text(statusText, margin + 5, y + 7, { width: badgeWidth - 10, align: 'center' })

  y += 40

  // Two-column layout for details
  const leftColX = margin
  const rightColX = margin + contentWidth / 2 + 20
  const colWidth = contentWidth / 2 - 20

  // Left column - Supplier Info
  doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold')
  doc.text('SUPPLIER', leftColX, y)
  y += 14
  doc.fillColor(COLORS.text).fontSize(11).font('Helvetica')
  doc.text(params.supplierName || '—', leftColX, y, { width: colWidth })

  // Right column - Ship To
  doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold')
  doc.text('SHIP TO', rightColX, y - 14)
  doc.fillColor(COLORS.text).fontSize(11).font('Helvetica')
  doc.text(params.destinationCountry || '—', rightColX, y, { width: colWidth })
  if (params.warehouseName || params.warehouseCode) {
    doc.text(
      `${params.warehouseName ?? params.warehouseCode}${params.warehouseName && params.warehouseCode ? ` (${params.warehouseCode})` : ''}`,
      rightColX,
      y + 14,
      { width: colWidth }
    )
  }

  y += 50

  // Divider
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(COLORS.mediumGray).lineWidth(1).stroke()

  y += 20

  // Order details grid - first row (3 columns)
  const gridColWidth3 = contentWidth / 3
  const detailsRow1 = [
    { label: 'Order Date', value: formatDate(params.createdAt) },
    { label: 'Cargo Ready Date', value: formatDate(params.expectedDate ?? null) },
    { label: 'Incoterms', value: params.incoterms?.trim() || '—' },
  ]

  detailsRow1.forEach((item, i) => {
    const x = margin + i * gridColWidth3
    doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica')
    doc.text(item.label.toUpperCase(), x, y, { width: gridColWidth3 - 10 })
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica-Bold')
    doc.text(item.value, x, y + 12, { width: gridColWidth3 - 10, lineBreak: false })
  })

  y += 32

  // Payment terms - full width if present and long
  const paymentTerms = params.paymentTerms?.trim() || '—'
  doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica')
  doc.text('PAYMENT TERMS', margin, y, { width: contentWidth })
  doc.fillColor(COLORS.text).fontSize(10).font('Helvetica-Bold')
  doc.text(paymentTerms, margin, y + 12, { width: contentWidth, lineBreak: false, ellipsis: true })

  y += 32

  // Notes section (if present)
  if (params.notes?.trim()) {
    doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold')
    doc.text('NOTES', margin, y)
    y += 14
    doc.roundedRect(margin, y, contentWidth, 40, 4).fill(COLORS.lightGray)
    doc.fillColor(COLORS.text).fontSize(9).font('Helvetica')
    doc.text(params.notes.trim(), margin + 10, y + 10, { width: contentWidth - 20 })
    y += 55
  }

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  y += 10

  // Table header
  doc.fillColor(COLORS.primary).fontSize(10).font('Helvetica-Bold')
  doc.text('ORDER ITEMS', margin, y)
  y += 20

  // Column definitions - adjusted for better text fit
  const cols = {
    sku: { x: margin, width: 60 },
    description: { x: margin + 60, width: 155 },
    units: { x: margin + 215, width: 55 },
    unitsPerCarton: { x: margin + 270, width: 50 },
    cartons: { x: margin + 320, width: 50 },
    unit: { x: margin + 370, width: 60 },
    total: { x: margin + 430, width: 65 },
  }

  // Table header row
  doc.rect(margin, y, contentWidth, 28).fill(COLORS.primary)
  doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold')
  doc.text('SKU', cols.sku.x + 8, y + 10, { width: cols.sku.width - 12 })
  doc.text('DESCRIPTION', cols.description.x + 8, y + 10, { width: cols.description.width - 12 })
  doc.text('UNITS', cols.units.x, y + 10, { width: cols.units.width - 8, align: 'right' })
  doc.text('U/CTN', cols.unitsPerCarton.x, y + 10, {
    width: cols.unitsPerCarton.width - 8,
    align: 'right',
  })
  doc.text('CTNS', cols.cartons.x, y + 10, { width: cols.cartons.width - 8, align: 'right' })
  doc.text('UNIT', cols.unit.x, y + 10, { width: cols.unit.width - 8, align: 'right' })
  doc.text('TOTAL', cols.total.x, y + 10, { width: cols.total.width - 8, align: 'right' })

  y += 28

  // Table rows
  const totalsByCurrency = new Map<string, { total: number }>()
  let totalUnits = 0
  let totalCartons = 0
  const rowHeight = 32

  const drawTableRow = (line: (typeof params.lines)[0], rowY: number, isAlt: boolean) => {
    const currency = (line.currency || 'USD').toUpperCase()
    const unitCost = line.unitCost
    const lineTotal =
      line.totalCost !== null ? line.totalCost : unitCost !== null ? unitCost * line.unitsOrdered : null

    totalUnits += line.unitsOrdered
    totalCartons += line.cartons

    if (lineTotal !== null) {
      const entry = totalsByCurrency.get(currency) ?? { total: 0 }
      entry.total += lineTotal
      totalsByCurrency.set(currency, entry)
    }

    // Alternating row background
    if (isAlt) {
      doc.rect(margin, rowY, contentWidth, rowHeight).fill(COLORS.lightGray)
    }

    // Row content - vertically centered text
    const textY = rowY + 7

    doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold')
    doc.text(line.skuCode, cols.sku.x + 8, textY, { width: cols.sku.width - 12, lineBreak: false })

    doc.fillColor(COLORS.darkGray).fontSize(7).font('Helvetica')
    doc.text(line.batchLot ?? '—', cols.sku.x + 8, textY + 12, {
      width: cols.sku.width - 12,
      lineBreak: false,
      ellipsis: true,
    })

    // Description with ellipsis for long text
    doc.fillColor(COLORS.text).fontSize(9).font('Helvetica')
    doc.text(line.skuDescription ?? '—', cols.description.x + 8, textY, {
      width: cols.description.width - 12,
      lineBreak: false,
      ellipsis: true,
    })

    // Numeric columns - right aligned with padding
    doc.font('Helvetica-Bold')
    doc.text(line.unitsOrdered.toLocaleString(), cols.units.x, textY, {
      width: cols.units.width - 8,
      align: 'right',
    })
    doc.text(line.unitsPerCarton.toLocaleString(), cols.unitsPerCarton.x, textY, {
      width: cols.unitsPerCarton.width - 8,
      align: 'right',
    })
    doc.text(line.cartons.toLocaleString(), cols.cartons.x, textY, {
      width: cols.cartons.width - 8,
      align: 'right',
    })

    doc.font('Helvetica').fontSize(9)
    doc.text(`${currency} ${formatMoney(unitCost)}`, cols.unit.x, textY, { width: cols.unit.width - 8, align: 'right' })

    doc.font('Helvetica-Bold').fontSize(9)
    doc.text(lineTotal !== null ? `${currency} ${formatMoney(lineTotal)}` : '—', cols.total.x, textY, {
      width: cols.total.width - 8,
      align: 'right',
    })

    // Bottom border
    doc.moveTo(margin, rowY + rowHeight).lineTo(pageWidth - margin, rowY + rowHeight).strokeColor(COLORS.mediumGray).lineWidth(0.5).stroke()
  }

  for (let i = 0; i < params.lines.length; i++) {
    // Check for page break - leave space for totals and footer
    if (y + rowHeight > pageHeight - 100) {
      doc.addPage()
      y = margin
      // Redraw table header on new page
      doc.rect(margin, y, contentWidth, 28).fill(COLORS.primary)
      doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold')
      doc.text('SKU', cols.sku.x + 8, y + 10, { width: cols.sku.width - 12 })
      doc.text('DESCRIPTION', cols.description.x + 8, y + 10, { width: cols.description.width - 12 })
      doc.text('UNITS', cols.units.x, y + 10, { width: cols.units.width - 8, align: 'right' })
      doc.text('U/CTN', cols.unitsPerCarton.x, y + 10, {
        width: cols.unitsPerCarton.width - 8,
        align: 'right',
      })
      doc.text('CTNS', cols.cartons.x, y + 10, { width: cols.cartons.width - 8, align: 'right' })
      doc.text('UNIT', cols.unit.x, y + 10, { width: cols.unit.width - 8, align: 'right' })
      doc.text('TOTAL', cols.total.x, y + 10, { width: cols.total.width - 8, align: 'right' })
      y += 28
    }

    drawTableRow(params.lines[i], y, i % 2 === 1)
    y += rowHeight
  }

  // ============================================
  // TOTALS SECTION
  // ============================================

  y += 15

  // Totals box - calculate dynamic height based on currency count
  const totalsBoxWidth = 220
  const totalsBoxX = pageWidth - margin - totalsBoxWidth
  const currencyCount = totalsByCurrency.size
  const totalsBoxHeight = 44 + Math.max(1, currencyCount) * 20

  doc.rect(totalsBoxX, y, totalsBoxWidth, totalsBoxHeight).fill(COLORS.lightGray)
  doc.rect(totalsBoxX, y, totalsBoxWidth, totalsBoxHeight).strokeColor(COLORS.mediumGray).lineWidth(1).stroke()

  // Total units row
  const labelX = totalsBoxX + 15
  const valueX = totalsBoxX + 100
  const valueWidth = totalsBoxWidth - 115

  doc.fillColor(COLORS.darkGray).fontSize(9).font('Helvetica')
  doc.text('Total Units:', labelX, y + 10, { width: 80 })
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9)
  doc.text(totalUnits.toLocaleString(), valueX, y + 10, { width: valueWidth, align: 'right' })

  doc.fillColor(COLORS.darkGray).fontSize(9).font('Helvetica')
  doc.text('Total Cartons:', labelX, y + 28, { width: 80 })
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9)
  doc.text(totalCartons.toLocaleString(), valueX, y + 28, { width: valueWidth, align: 'right' })

  // Currency totals
  let totalsY = y + 46
  for (const [currency, totals] of totalsByCurrency.entries()) {
    doc.fillColor(COLORS.darkGray).fontSize(9).font('Helvetica')
    doc.text(`Total (${currency}):`, labelX, totalsY, { width: 80 })
    doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(10)
    doc.text(totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), valueX, totalsY, {
      width: valueWidth,
      align: 'right',
    })
    totalsY += 18
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerY = pageHeight - 40

  // Footer line
  doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).strokeColor(COLORS.accent).lineWidth(2).stroke()

  // Footer text - full timestamp
  const now = new Date()
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica')
  doc.text(`Generated: ${timestamp}`, margin, footerY + 10)
  doc.text('Targon.', pageWidth - margin - 80, footerY + 10, { width: 80, align: 'right' })

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

  const tenant = await getCurrentTenant()
  const destinationCountry = `${tenant.name} (${tenant.displayName})`

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
    supplierName: order.counterpartyName ?? '',
    status: order.status,
    createdAt: order.createdAt,
    destinationCountry,
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
