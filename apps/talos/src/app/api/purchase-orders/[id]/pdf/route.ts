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

// Professional color palette matching the HTML design
const COLORS = {
  navy: '#1e293b',
  darkNavy: '#0f172a',
  slate: '#334155',
  muted: '#64748b',
  lightMuted: '#94a3b8',
  border: '#e2e8f0',
  lightBorder: '#cbd5e1',
  lightBg: '#f8fafc',
  sectionBg: '#f1f5f9',
  accent: '#00C2B9', // Targon teal
  white: '#ffffff',
  black: '#111827',
  green: '#059669',
  red: '#dc2626',
  amber: '#92400e',
  amberBg: '#fef3c7',
} as const

function sanitizeFilename(value: string): string {
  return value.trim().replaceAll(/[^a-z0-9._-]+/gi, '-')
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return '—'
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function formatCurrency(value: number | null, _currency?: string): string {
  if (value === null) return '—'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCurrencyWithSymbol(value: number | null): string {
  if (value === null) return '—'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Convert number to words (for amounts)
function numberToWords(num: number): string {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

  if (num === 0) return 'ZERO'

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '')
  }

  const dollars = Math.floor(num)
  const cents = Math.round((num - dollars) * 100)

  let result = ''
  if (dollars >= 1000000) {
    result += convertLessThanThousand(Math.floor(dollars / 1000000)) + ' MILLION '
    result += convertLessThanThousand(Math.floor((dollars % 1000000) / 1000)) + ' THOUSAND '
    result += convertLessThanThousand(dollars % 1000)
  } else if (dollars >= 1000) {
    result += convertLessThanThousand(Math.floor(dollars / 1000)) + ' THOUSAND '
    result += convertLessThanThousand(dollars % 1000)
  } else {
    result = convertLessThanThousand(dollars)
  }

  result = result.trim()
  if (cents > 0) {
    result += ' AND CENTS ' + convertLessThanThousand(cents)
  }

  return result + ' ONLY'
}

async function renderPurchaseOrderPdf(params: {
  poNumber: string
  vendorPi?: string | null
  buyerName: string
  buyerAddress: string
  buyerPhone?: string | null
  buyerVatNumber?: string | null
  supplierName: string
  supplierAddress?: string | null
  supplierPhone?: string | null
  createdAt: Date
  expectedDate?: Date | null
  inspectionDate?: Date | null
  incoterms?: string | null
  paymentTerms?: string | null
  shipToName?: string | null
  shipToAddress?: string | null
  notes?: string | null
  lines: Array<{
    skuCode: string
    skuDescription: string | null
    batchLot: string | null
    packingDetails?: string | null
    cartonDetails?: string | null
    unitsOrdered: number
    unitsPerCarton: number
    cartons: number
    currency: string
    unitCost: number | null
    totalCost: number | null
  }>
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
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

  const pageWidth = doc.page.width   // 612 for Letter
  const pageHeight = doc.page.height // 792 for Letter
  const margin = 50
  const contentWidth = pageWidth - margin * 2 // 512

  // Pre-calculate totals
  let grandTotal = 0
  for (const line of params.lines) {
    const lineTotal = line.totalCost ?? (line.unitCost !== null ? line.unitCost * line.unitsOrdered : 0)
    grandTotal += lineTotal ?? 0
  }

  // ============================================
  // PAGE 1 - HEADER
  // ============================================

  let y = margin

  // Draw TARGON logo text
  doc.fillColor(COLORS.accent).fontSize(32).font('Helvetica-Bold')
  doc.text('TARGON', margin, y)

  // Small square accent after logo
  doc.rect(margin + 138, y + 24, 8, 8).fill(COLORS.darkNavy)

  // Company address below logo
  y += 50
  doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
  const addressLines = params.buyerAddress.split(',').map(s => s.trim())
  doc.text(addressLines.slice(0, 2).join(', '), margin, y)
  y += 14
  doc.text(addressLines.slice(2).join(', '), margin, y)
  y += 14
  if (params.buyerPhone) {
    doc.text(`Phone: ${params.buyerPhone}`, margin, y)
  }

  // PURCHASE ORDER title on right
  doc.fillColor(COLORS.black).fontSize(28).font('Helvetica-Bold')
  doc.text('PURCHASE ORDER', pageWidth - margin - 250, margin, { width: 250, align: 'right' })

  // PO meta table on right
  const metaX = pageWidth - margin - 180
  let metaY = margin + 50

  const drawMetaRow = (label: string, value: string) => {
    doc.fillColor(COLORS.lightMuted).fontSize(9).font('Helvetica-Bold')
    doc.text(label.toUpperCase(), metaX, metaY, { width: 80, align: 'right' })
    doc.fillColor(COLORS.darkNavy).fontSize(10).font('Helvetica-Bold')
    doc.text(value, metaX + 90, metaY, { width: 90, align: 'right' })
    metaY += 18
  }

  drawMetaRow('PO Number:', params.poNumber)
  drawMetaRow('Date:', formatDate(params.createdAt))
  if (params.vendorPi) {
    drawMetaRow('Vendor PI:', params.vendorPi)
  }
  drawMetaRow('Shipment:', 'By Sea')

  // Header border
  y = Math.max(y + 20, metaY + 10)
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(COLORS.navy).lineWidth(3).stroke()
  y += 25

  // ============================================
  // VENDOR / SHIP TO SECTION
  // ============================================

  const colWidth = (contentWidth - 60) / 2

  // VENDOR
  doc.fillColor(COLORS.lightMuted).fontSize(9).font('Helvetica-Bold')
  doc.text('VENDOR', margin, y)
  doc.moveTo(margin, y + 12).lineTo(margin + colWidth, y + 12).strokeColor(COLORS.border).lineWidth(0.5).stroke()

  let vendorY = y + 18
  doc.fillColor(COLORS.darkNavy).fontSize(11).font('Helvetica-Bold')
  doc.text(params.supplierName || '—', margin, vendorY, { width: colWidth })
  vendorY += doc.heightOfString(params.supplierName || '—', { width: colWidth }) + 4

  if (params.supplierAddress) {
    doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
    const supplierLines = params.supplierAddress.split('\n')
    for (const line of supplierLines) {
      doc.text(line, margin, vendorY, { width: colWidth })
      vendorY += 14
    }
  }
  if (params.supplierPhone) {
    doc.text(`Tel: ${params.supplierPhone}`, margin, vendorY, { width: colWidth })
    vendorY += 14
  }

  // SHIP TO
  const shipToX = margin + colWidth + 60
  doc.fillColor(COLORS.lightMuted).fontSize(9).font('Helvetica-Bold')
  doc.text('SHIP TO', shipToX, y)
  doc.moveTo(shipToX, y + 12).lineTo(shipToX + colWidth, y + 12).strokeColor(COLORS.border).lineWidth(0.5).stroke()

  let shipToY = y + 18
  const shipToName = params.shipToName || params.buyerName
  doc.fillColor(COLORS.darkNavy).fontSize(11).font('Helvetica-Bold')
  doc.text(shipToName, shipToX, shipToY, { width: colWidth })
  shipToY += doc.heightOfString(shipToName, { width: colWidth }) + 4

  if (params.shipToAddress) {
    doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
    const shipLines = params.shipToAddress.split('\n')
    for (const line of shipLines) {
      doc.text(line, shipToX, shipToY, { width: colWidth })
      shipToY += 14
    }
  } else {
    doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
    doc.text(params.buyerAddress.replace(/,/g, '\n'), shipToX, shipToY, { width: colWidth })
  }

  y = Math.max(vendorY, shipToY) + 25

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  // Table header
  const tableHeaderHeight = 24
  doc.rect(margin, y, contentWidth, tableHeaderHeight).fill(COLORS.navy)

  const cols = {
    desc: { x: margin, w: contentWidth * 0.50, label: 'Description & Packing Details' },
    qty:  { x: margin + contentWidth * 0.50, w: contentWidth * 0.15, label: 'Qty' },
    unit: { x: margin + contentWidth * 0.65, w: contentWidth * 0.17, label: 'Unit Price' },
    total: { x: margin + contentWidth * 0.82, w: contentWidth * 0.18, label: 'Total' },
  }

  doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold')
  doc.text(cols.desc.label, cols.desc.x + 8, y + 7, { width: cols.desc.w - 16 })
  doc.text(cols.qty.label, cols.qty.x, y + 7, { width: cols.qty.w - 8, align: 'right' })
  doc.text(cols.unit.label, cols.unit.x, y + 7, { width: cols.unit.w - 8, align: 'right' })
  doc.text(cols.total.label, cols.total.x, y + 7, { width: cols.total.w - 8, align: 'right' })

  y += tableHeaderHeight

  // Draw line items
  for (let i = 0; i < params.lines.length; i++) {
    const line = params.lines[i]
    const currency = (line.currency || 'USD').toUpperCase()
    const unitCost = line.unitCost
    const lineTotal = line.totalCost ?? (unitCost !== null ? unitCost * line.unitsOrdered : null)

    // Calculate row height based on content
    const descHeight = 60 // Fixed height for description block
    const rowHeight = Math.max(descHeight, 50)

    // Check for page break
    if (y + rowHeight > pageHeight - 100) {
      doc.addPage()
      y = margin
      // Redraw header on new page
      doc.rect(margin, y, contentWidth, tableHeaderHeight).fill(COLORS.navy)
      doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold')
      doc.text(cols.desc.label, cols.desc.x + 8, y + 7, { width: cols.desc.w - 16 })
      doc.text(cols.qty.label, cols.qty.x, y + 7, { width: cols.qty.w - 8, align: 'right' })
      doc.text(cols.unit.label, cols.unit.x, y + 7, { width: cols.unit.w - 8, align: 'right' })
      doc.text(cols.total.label, cols.total.x, y + 7, { width: cols.total.w - 8, align: 'right' })
      y += tableHeaderHeight
    }

    const rowY = y

    // SKU Code (bold, larger)
    doc.fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold')
    doc.text(line.skuCode, cols.desc.x + 8, rowY + 8)

    // Product description
    let descY = rowY + 22
    if (line.skuDescription) {
      doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica')
      doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold')
      doc.text('Product: ', cols.desc.x + 8, descY, { continued: true })
      doc.fillColor(COLORS.slate).font('Helvetica')
      doc.text(line.skuDescription, { width: cols.desc.w - 60 })
      descY += 12
    }

    // Packing details
    if (line.packingDetails) {
      doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold')
      doc.text('Packing: ', cols.desc.x + 8, descY, { continued: true })
      doc.fillColor(COLORS.slate).font('Helvetica')
      doc.text(line.packingDetails, { width: cols.desc.w - 60 })
      descY += 12
    }

    // Carton details
    if (line.cartonDetails) {
      doc.fillColor(COLORS.muted).fontSize(8).font('Helvetica-Bold')
      doc.text('Carton: ', cols.desc.x + 8, descY, { continued: true })
      doc.fillColor(COLORS.slate).font('Helvetica')
      doc.text(line.cartonDetails, { width: cols.desc.w - 60 })
    }

    // Quantity
    doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica')
    doc.text(line.unitsOrdered.toLocaleString(), cols.qty.x, rowY + 20, { width: cols.qty.w - 8, align: 'right' })

    // Unit price
    doc.text(unitCost !== null ? formatCurrencyWithSymbol(unitCost) : '—', cols.unit.x, rowY + 20, { width: cols.unit.w - 8, align: 'right' })

    // Total (bold)
    doc.fillColor(COLORS.darkNavy).fontSize(10).font('Helvetica-Bold')
    doc.text(lineTotal !== null ? formatCurrencyWithSymbol(lineTotal) : '—', cols.total.x, rowY + 20, { width: cols.total.w - 8, align: 'right' })

    // Row border
    y += rowHeight
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(COLORS.border).lineWidth(0.5).stroke()
  }

  // Final thick border after table
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor(COLORS.lightBorder).lineWidth(2).stroke()

  y += 20

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsWidth = 280
  const totalsX = pageWidth - margin - totalsWidth

  // Total Amount
  doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica')
  doc.text('Total Amount (USD):', totalsX, y, { width: 150 })
  doc.fillColor(COLORS.darkNavy).fontSize(12).font('Helvetica-Bold')
  doc.text(formatCurrencyWithSymbol(grandTotal), totalsX + 150, y, { width: 130, align: 'right' })

  y += 30

  // Balance Due (with thick top border)
  doc.moveTo(totalsX, y - 5).lineTo(totalsX + totalsWidth, y - 5).strokeColor(COLORS.darkNavy).lineWidth(2).stroke()
  doc.fillColor(COLORS.darkNavy).fontSize(12).font('Helvetica-Bold')
  doc.text('BALANCE DUE:', totalsX, y, { width: 150 })
  doc.fontSize(14)
  doc.text(formatCurrencyWithSymbol(grandTotal), totalsX + 150, y, { width: 130, align: 'right' })

  y += 30

  // Amount in words
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica')
  doc.moveTo(totalsX, y - 5).lineTo(totalsX + totalsWidth, y - 5).strokeColor(COLORS.border).lineWidth(0.5).stroke()
  const amountWords = `SAY TOTAL U.S. DOLLARS ${numberToWords(grandTotal)}.`
  doc.text(amountWords, totalsX, y, { width: totalsWidth, align: 'right' })

  // ============================================
  // PAGE 2 - TERMS & SIGNATURES
  // ============================================

  doc.addPage()
  y = margin

  // Page reference
  doc.fillColor(COLORS.lightMuted).fontSize(10).font('Helvetica')
  doc.text(`CONTINUATION SHEET - REF: PO ${params.poNumber}`, margin, y, { width: contentWidth, align: 'right' })
  doc.moveTo(margin, y + 15).lineTo(pageWidth - margin, y + 15).strokeColor(COLORS.border).lineWidth(0.5).stroke()

  y += 40

  // Terms & Conditions box
  const boxWidth = (contentWidth - 30) / 2
  const boxHeight = 200

  // Left box - Terms & Conditions
  doc.rect(margin, y, boxWidth, boxHeight).fill(COLORS.lightBg)
  doc.rect(margin, y, boxWidth, boxHeight).stroke(COLORS.border)

  let termY = y + 20
  doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica-Bold')
  doc.text('TERMS & CONDITIONS', margin + 20, termY)
  doc.moveTo(margin + 20, termY + 14).lineTo(margin + boxWidth - 20, termY + 14).strokeColor(COLORS.lightBorder).lineWidth(0.5).stroke()

  termY += 25
  doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica')

  // Delivery date
  if (params.expectedDate) {
    doc.font('Helvetica-Bold').text('Delivery: ', margin + 20, termY, { continued: true })
    doc.font('Helvetica').fillColor(COLORS.amber)
    doc.text(formatDate(params.expectedDate))
    termY += 16
  }

  // Inspection date
  if (params.inspectionDate) {
    doc.fillColor(COLORS.slate).font('Helvetica-Bold').text('Inspection: ', margin + 20, termY, { continued: true })
    doc.font('Helvetica').fillColor(COLORS.amber)
    doc.text(formatDate(params.inspectionDate))
    termY += 16
  }

  // Payment terms
  if (params.paymentTerms) {
    doc.fillColor(COLORS.slate).font('Helvetica-Bold').text('Payment Terms: ', margin + 20, termY, { continued: false })
    termY += 12
    doc.font('Helvetica').text(params.paymentTerms, margin + 20, termY, { width: boxWidth - 40 })
    termY += doc.heightOfString(params.paymentTerms, { width: boxWidth - 40 }) + 8
  }

  // Incoterms
  if (params.incoterms) {
    doc.fillColor(COLORS.slate).font('Helvetica-Bold').text('Incoterms: ', margin + 20, termY, { continued: true })
    doc.font('Helvetica').text(params.incoterms)
    termY += 16
  }

  // Right box - Notes
  const rightBoxX = margin + boxWidth + 30
  doc.rect(rightBoxX, y, boxWidth, boxHeight).fill(COLORS.lightBg)
  doc.rect(rightBoxX, y, boxWidth, boxHeight).stroke(COLORS.border)

  let noteY = y + 20
  doc.fillColor(COLORS.slate).fontSize(10).font('Helvetica-Bold')
  doc.text('NOTES', rightBoxX + 20, noteY)
  doc.moveTo(rightBoxX + 20, noteY + 14).lineTo(rightBoxX + boxWidth - 20, noteY + 14).strokeColor(COLORS.lightBorder).lineWidth(0.5).stroke()

  noteY += 25
  if (params.notes?.trim()) {
    doc.fillColor(COLORS.slate).fontSize(9).font('Helvetica')
    doc.text(params.notes.trim(), rightBoxX + 20, noteY, { width: boxWidth - 40 })
  } else {
    doc.fillColor(COLORS.lightMuted).fontSize(9).font('Helvetica')
    doc.text('No additional notes.', rightBoxX + 20, noteY)
  }

  y += boxHeight + 60

  // ============================================
  // SIGNATURES
  // ============================================

  const sigWidth = (contentWidth - 60) / 2

  // Left signature - Buyer
  doc.moveTo(margin, y + 50).lineTo(margin + sigWidth, y + 50).strokeColor(COLORS.darkNavy).lineWidth(0.5).stroke()
  doc.fillColor(COLORS.darkNavy).fontSize(12).font('Helvetica-Bold')
  doc.text('JARRAR AMJAD', margin, y + 60)
  doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica')
  doc.text('Founder, Targon LLC', margin, y + 76)

  // Right signature - Supplier
  const sigRightX = margin + sigWidth + 60
  doc.moveTo(sigRightX, y + 50).lineTo(sigRightX + sigWidth, y + 50).strokeColor(COLORS.darkNavy).lineWidth(0.5).stroke()
  doc.fillColor(COLORS.darkNavy).fontSize(12).font('Helvetica-Bold')
  doc.text(params.supplierName ? params.supplierName.split(' ')[0].toUpperCase() : 'SUPPLIER', sigRightX, y + 60)
  doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica')
  doc.text(params.supplierName || 'Supplier Representative', sigRightX, y + 76)

  // ============================================
  // FOOTER (all pages)
  // ============================================

  const pageCount = doc.bufferedPageRange().count
  const footerY = pageHeight - 40

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)
    doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).strokeColor(COLORS.border).lineWidth(0.5).stroke()
    doc.fillColor(COLORS.lightMuted).fontSize(9).font('Helvetica')
    doc.text(`Page ${i + 1} of ${pageCount}`, margin, footerY + 8, { width: contentWidth, align: 'right' })
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
  let supplierPhone: string | null = null
  if (order.counterpartyName) {
    const prisma = await getTenantPrisma()
    const supplier = await prisma.supplier.findFirst({
      where: { name: order.counterpartyName },
      select: { address: true, phone: true },
    })
    if (!supplierAddress) {
      supplierAddress = supplier?.address ?? null
    }
    supplierPhone = supplier?.phone ?? null
  }

  const tenant = await getCurrentTenant()
  const buyerVatNumber = getBuyerVatNumber(tenant.code)

  const poNumber = order.poNumber ?? toPublicOrderNumber(order.orderNumber)
  const filename = `${sanitizeFilename(poNumber)}.pdf`

  // Get proforma invoice number from stage data if available
  const vendorPi = (order as { proformaInvoiceNumber?: string | null }).proformaInvoiceNumber ?? null

  const lines = order.lines.map(line => ({
    skuCode: line.skuCode,
    skuDescription: line.skuDescription ?? null,
    batchLot: line.batchLot ?? null,
    packingDetails: line.unitsPerCarton ? `${line.unitsPerCarton} units/carton` : null,
    cartonDetails: line.quantity ? `${line.quantity} cartons` : null,
    unitsOrdered: line.unitsOrdered,
    unitsPerCarton: line.unitsPerCarton,
    cartons: line.quantity,
    currency: line.currency,
    unitCost: toNumber(line.unitCost),
    totalCost: toNumber(line.totalCost),
  }))

  const pdf = await renderPurchaseOrderPdf({
    poNumber,
    vendorPi,
    buyerName: BUYER_LEGAL_ENTITY.name,
    buyerAddress: BUYER_LEGAL_ENTITY.address,
    buyerPhone: '785-370-3532',
    buyerVatNumber,
    supplierName: order.counterpartyName ?? '',
    supplierAddress,
    supplierPhone,
    createdAt: order.createdAt,
    expectedDate: order.expectedDate,
    incoterms: order.incoterms,
    paymentTerms: order.paymentTerms,
    shipToName: order.warehouseName ?? order.shipToName,
    shipToAddress: order.shipToAddress ?? null,
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
