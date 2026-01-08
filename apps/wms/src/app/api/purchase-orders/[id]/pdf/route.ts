import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { getPurchaseOrderById } from '@/lib/services/purchase-order-service'
import { toPublicOrderNumber } from '@/lib/services/purchase-order-utils'
import { getCurrentTenant } from '@/lib/tenant/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Refined color palette - professional and understated
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

async function renderPurchaseOrderPdf(params: {
  poNumber: string
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
    bufferPages: true // Enable buffering for page count
  })
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
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  // Track totals
  const totalsByCurrency = new Map<string, number>()
  let totalUnits = 0
  let totalCartons = 0

  // Pre-calculate totals
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

  // Company name - understated
  doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica')
  doc.text('TARGON GLOBAL', margin, y)

  // PO Number - THE HERO ELEMENT
  doc.fillColor(COLORS.navy).fontSize(32).font('Helvetica-Bold')
  doc.text(params.poNumber, margin, y + 20)

  // Document type label
  doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica')
  doc.text('PURCHASE ORDER', margin, y + 58)

  // Order date on the right
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.text('ORDER DATE', pageWidth - margin - 120, y, { width: 120, align: 'right' })
  doc.fillColor(COLORS.navy).fontSize(11).font('Helvetica-Bold')
  doc.text(formatDate(params.createdAt), pageWidth - margin - 120, y + 12, { width: 120, align: 'right' })

  y += 90

  // Divider line
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(COLORS.border).lineWidth(1).stroke()

  y += 25

  // ============================================
  // FROM / TO SECTION (Two columns)
  // ============================================

  const colWidth = (contentWidth - 40) / 2

  // FROM (Supplier)
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.text('FROM', margin, y)
  y += 14
  doc.fillColor(COLORS.navy).fontSize(11).font('Helvetica-Bold')
  doc.text(params.supplierName || '—', margin, y, { width: colWidth })

  const supplierNameHeight = doc.heightOfString(params.supplierName || '—', { width: colWidth })
  let fromY = y + supplierNameHeight + 4

  if (params.supplierAddress) {
    doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
    doc.text(params.supplierAddress, margin, fromY, { width: colWidth })
  }

  // TO (Ship To) - same baseline as FROM
  const toX = margin + colWidth + 40
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.text('SHIP TO', toX, y - 14)

  // Build ship-to text
  const shipToLines: string[] = []
  if (params.warehouseName) shipToLines.push(params.warehouseName)
  if (params.warehouseCode && params.warehouseCode !== params.warehouseName) {
    shipToLines.push(`Code: ${params.warehouseCode}`)
  }
  if (params.destinationAddress) shipToLines.push(params.destinationAddress)
  if (params.destinationCountry) shipToLines.push(params.destinationCountry)

  const shipToText = shipToLines.length > 0 ? shipToLines.join('\n') : params.destinationCountry || '—'

  doc.fillColor(COLORS.navy).fontSize(11).font('Helvetica-Bold')
  const firstShipToLine = shipToLines[0] || params.destinationCountry || '—'
  doc.text(firstShipToLine, toX, y, { width: colWidth })

  if (shipToLines.length > 1) {
    const restLines = shipToLines.slice(1).join('\n')
    const firstLineHeight = doc.heightOfString(firstShipToLine, { width: colWidth })
    doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
    doc.text(restLines, toX, y + firstLineHeight + 4, { width: colWidth })
  }

  y += 70

  // ============================================
  // ORDER DETAILS GRID
  // ============================================

  // 4-column grid for order details
  const gridCols = 4
  const gridColWidth = contentWidth / gridCols

  const orderDetails = [
    { label: 'CARGO READY DATE', value: formatDate(params.expectedDate) },
    { label: 'INCOTERMS', value: params.incoterms || '—' },
    { label: 'PAYMENT TERMS', value: params.paymentTerms || '—', span: 2 },
  ]

  let gridX = margin
  for (const detail of orderDetails) {
    const span = detail.span || 1
    const width = gridColWidth * span - 15

    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')
    doc.text(detail.label, gridX, y, { width })
    doc.fillColor(COLORS.navy).fontSize(10).font('Helvetica-Bold')
    doc.text(detail.value, gridX, y + 12, { width, lineBreak: detail.span === 2 })

    gridX += gridColWidth * span
  }

  y += 45

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  // Table header background
  doc.rect(margin, y, contentWidth, 28).fill(COLORS.navy)

  // Column definitions - optimized widths
  const tableConfig = {
    sku: { x: margin, w: 75, label: 'SKU', align: 'left' as const },
    batch: { x: margin + 75, w: 70, label: 'BATCH', align: 'left' as const },
    description: { x: margin + 145, w: 130, label: 'DESCRIPTION', align: 'left' as const },
    units: { x: margin + 275, w: 55, label: 'UNITS', align: 'right' as const },
    upc: { x: margin + 330, w: 45, label: 'U/CTN', align: 'right' as const },
    cartons: { x: margin + 375, w: 50, label: 'CTNS', align: 'right' as const },
    unitPrice: { x: margin + 425, w: 55, label: 'UNIT', align: 'right' as const },
    total: { x: margin + 480, w: 55, label: 'TOTAL', align: 'right' as const },
  }

  // Header text
  doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold')
  for (const [, col] of Object.entries(tableConfig)) {
    const textOpts = { width: col.w - 10, align: col.align }
    doc.text(col.label, col.x + 5, y + 10, textOpts)
  }

  y += 28

  // Table rows
  const rowHeight = 28
  let rowY = y

  const drawTableRow = (line: (typeof params.lines)[0], isAlt: boolean) => {
    const currency = (line.currency || 'USD').toUpperCase()
    const unitCost = line.unitCost
    const lineTotal = line.totalCost ?? (unitCost !== null ? unitCost * line.unitsOrdered : null)

    // Alternating background
    if (isAlt) {
      doc.rect(margin, rowY, contentWidth, rowHeight).fill(COLORS.lightBg)
    }

    const textY = rowY + 9

    // SKU - bold
    doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica-Bold')
    doc.text(line.skuCode, tableConfig.sku.x + 5, textY, {
      width: tableConfig.sku.w - 10,
      lineBreak: false,
      ellipsis: true
    })

    // Batch - regular
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
    doc.text(line.batchLot || '—', tableConfig.batch.x + 5, textY, {
      width: tableConfig.batch.w - 10,
      lineBreak: false,
      ellipsis: true
    })

    // Description
    doc.fillColor(COLORS.slate).fontSize(8).font('Helvetica')
    doc.text(line.skuDescription || '—', tableConfig.description.x + 5, textY, {
      width: tableConfig.description.w - 10,
      lineBreak: false,
      ellipsis: true
    })

    // Numeric columns - right aligned
    doc.fillColor(COLORS.navy).fontSize(9).font('Helvetica')
    doc.text(line.unitsOrdered.toLocaleString(), tableConfig.units.x, textY, {
      width: tableConfig.units.w - 5,
      align: 'right'
    })
    doc.text(line.unitsPerCarton.toLocaleString(), tableConfig.upc.x, textY, {
      width: tableConfig.upc.w - 5,
      align: 'right'
    })
    doc.text(line.cartons.toLocaleString(), tableConfig.cartons.x, textY, {
      width: tableConfig.cartons.w - 5,
      align: 'right'
    })

    // Unit price
    doc.fontSize(8).fillColor(COLORS.muted)
    doc.text(unitCost !== null ? formatCurrency(unitCost, currency) : '—', tableConfig.unitPrice.x, textY, {
      width: tableConfig.unitPrice.w - 5,
      align: 'right'
    })

    // Total - bold
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.navy)
    doc.text(lineTotal !== null ? formatCurrency(lineTotal, currency) : '—', tableConfig.total.x, textY, {
      width: tableConfig.total.w - 5,
      align: 'right'
    })

    // Bottom border
    doc.moveTo(margin, rowY + rowHeight)
      .lineTo(pageWidth - margin, rowY + rowHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke()
  }

  // Render all rows with page break handling
  for (let i = 0; i < params.lines.length; i++) {
    // Check if we need a new page (leave space for totals + footer)
    const spaceNeeded = rowHeight + (i === params.lines.length - 1 ? 120 : 0)
    if (rowY + spaceNeeded > pageHeight - 80) {
      doc.addPage()
      rowY = margin

      // Redraw table header on new page
      doc.rect(margin, rowY, contentWidth, 28).fill(COLORS.navy)
      doc.fillColor(COLORS.white).fontSize(7).font('Helvetica-Bold')
      for (const [, col] of Object.entries(tableConfig)) {
        doc.text(col.label, col.x + 5, rowY + 10, { width: col.w - 10, align: col.align })
      }
      rowY += 28
    }

    drawTableRow(params.lines[i], i % 2 === 1)
    rowY += rowHeight
  }

  y = rowY + 15

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsWidth = 200
  const totalsX = pageWidth - margin - totalsWidth

  // Check if totals fit on current page
  const totalsHeight = 60 + totalsByCurrency.size * 22
  if (y + totalsHeight > pageHeight - 60) {
    doc.addPage()
    y = margin
  }

  // Totals box
  doc.rect(totalsX, y, totalsWidth, totalsHeight).fill(COLORS.lightBg)

  let totalsY = y + 12
  const labelX = totalsX + 15
  const valueX = totalsX + totalsWidth - 15

  // Total Units
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.text('Total Units', labelX, totalsY)
  doc.fillColor(COLORS.navy).font('Helvetica-Bold')
  doc.text(totalUnits.toLocaleString(), labelX, totalsY, { width: totalsWidth - 30, align: 'right' })

  totalsY += 18

  // Total Cartons
  doc.fillColor(COLORS.muted).font('Helvetica')
  doc.text('Total Cartons', labelX, totalsY)
  doc.fillColor(COLORS.navy).font('Helvetica-Bold')
  doc.text(totalCartons.toLocaleString(), labelX, totalsY, { width: totalsWidth - 30, align: 'right' })

  totalsY += 22

  // Divider in totals box
  doc.moveTo(totalsX + 10, totalsY - 4).lineTo(totalsX + totalsWidth - 10, totalsY - 4).strokeColor(COLORS.border).lineWidth(0.5).stroke()

  // Currency totals
  for (const [currency, total] of totalsByCurrency.entries()) {
    doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
    doc.text(`Total (${currency})`, labelX, totalsY)
    doc.fillColor(COLORS.navy).fontSize(11).font('Helvetica-Bold')
    doc.text(formatCurrency(total, currency), labelX, totalsY, { width: totalsWidth - 30, align: 'right' })
    totalsY += 22
  }

  y = totalsY + 20

  // ============================================
  // NOTES SECTION (if present)
  // ============================================

  if (params.notes?.trim()) {
    // Check if notes fit on current page
    const notesHeight = 60
    if (y + notesHeight > pageHeight - 60) {
      doc.addPage()
      y = margin
    }

    doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
    doc.text('NOTES', margin, y)
    y += 14

    doc.rect(margin, y, contentWidth, 50).fill(COLORS.lightBg)
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica')
    doc.text(params.notes.trim(), margin + 12, y + 10, { width: contentWidth - 24 })
  }

  // ============================================
  // FOOTER (on every page)
  // ============================================

  const pageCount = doc.bufferedPageRange().count

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)

    const footerY = pageHeight - 35

    // Footer line
    doc.moveTo(margin, footerY)
      .lineTo(pageWidth - margin, footerY)
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .stroke()

    // Footer text
    doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica')

    // Generation timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    doc.text(`Generated: ${timestamp}`, margin, footerY + 10)

    // Page number
    doc.text(`Page ${i + 1} of ${pageCount}`, pageWidth / 2 - 30, footerY + 10, { width: 60, align: 'center' })

    // Company name
    doc.text('targon.io', pageWidth - margin - 60, footerY + 10, { width: 60, align: 'right' })
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
    supplierAddress: null, // TODO: Add supplier address when available
    createdAt: order.createdAt,
    destinationCountry,
    destinationAddress: null, // TODO: Add destination address when available
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
