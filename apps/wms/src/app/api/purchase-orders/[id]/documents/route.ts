import { NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { getS3Service } from '@/services/s3.service'
import { validateFile, scanFileContent } from '@/lib/security/file-upload'
import { auditLog } from '@/lib/security/audit-logger'
import { PurchaseOrderDocumentStage, Prisma, PurchaseOrderStatus } from '@ecom-os/prisma-wms'
import { toPublicOrderNumber } from '@/lib/services/purchase-order-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for file uploads

const STAGES: readonly PurchaseOrderDocumentStage[] = [
  'ISSUED',
  'MANUFACTURING',
  'OCEAN',
  'WAREHOUSE',
  'SHIPPED',
]

const DOCUMENT_STAGE_ORDER: Record<PurchaseOrderDocumentStage, number> = {
  ISSUED: 1,
  MANUFACTURING: 2,
  OCEAN: 3,
  WAREHOUSE: 4,
  SHIPPED: 5,
}

function statusToDocumentStage(status: PurchaseOrderStatus): PurchaseOrderDocumentStage | null {
  switch (status) {
    case PurchaseOrderStatus.ISSUED:
      return PurchaseOrderDocumentStage.ISSUED
    case PurchaseOrderStatus.MANUFACTURING:
      return PurchaseOrderDocumentStage.MANUFACTURING
    case PurchaseOrderStatus.OCEAN:
      return PurchaseOrderDocumentStage.OCEAN
    case PurchaseOrderStatus.WAREHOUSE:
      return PurchaseOrderDocumentStage.WAREHOUSE
    case PurchaseOrderStatus.SHIPPED:
      return PurchaseOrderDocumentStage.SHIPPED
    default:
      return null
  }
}

function parseStage(value: unknown): PurchaseOrderDocumentStage | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return (STAGES as readonly string[]).includes(trimmed)
    ? (trimmed as PurchaseOrderDocumentStage)
    : null
}

function parseDocumentType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  // Keep this strict so S3 keys and DB composite keys stay predictable.
  // UI uses snake_case ids (e.g. bill_of_lading).
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) return null
  return trimmed
}

export const POST = withAuthAndParams(async (request, params, session) => {
  try {
    const { id } = params as { id: string }
    if (!id) {
      return NextResponse.json({ error: 'Purchase order ID is required' }, { status: 400 })
    }

    const prisma = await getTenantPrisma()
    const s3Service = getS3Service()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentTypeRaw = formData.get('documentType')
    const stageRaw = formData.get('stage')

    const stage = parseStage(stageRaw)
    const documentType = parseDocumentType(documentTypeRaw)

    if (!file || !documentType || !stage) {
      return NextResponse.json(
        { error: 'File, documentType, and stage are required' },
        { status: 400 }
      )
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, isLegacy: true, orderNumber: true, status: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (order.isLegacy) {
      return NextResponse.json({ error: 'Cannot attach documents to legacy orders' }, { status: 409 })
    }

    if (order.status === PurchaseOrderStatus.CANCELLED || order.status === PurchaseOrderStatus.REJECTED) {
      return NextResponse.json(
        { error: `Cannot modify documents for ${order.status.toLowerCase()} purchase orders` },
        { status: 409 }
      )
    }

    const currentStage = statusToDocumentStage(order.status as PurchaseOrderStatus)
    if (currentStage && DOCUMENT_STAGE_ORDER[stage] < DOCUMENT_STAGE_ORDER[currentStage]) {
      return NextResponse.json(
        { error: `Documents for completed stages are locked (current stage: ${order.status})` },
        { status: 409 }
      )
    }

    const validation = await validateFile(file, 'purchase-order-document')
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const scanResult = await scanFileContent(buffer, file.type)
    if (!scanResult.valid) {
      return NextResponse.json({ error: scanResult.error }, { status: 400 })
    }

    const tenantCode = await getCurrentTenantCode()
    const purchaseOrderNumber = toPublicOrderNumber(order.orderNumber)

    const s3Key = s3Service.generateKey(
      {
        type: 'purchase-order',
        purchaseOrderId: id,
        tenantCode,
        purchaseOrderNumber,
        stage,
        documentType,
      },
      file.name
    )

    const uploadResult = await s3Service.uploadFile(buffer, s3Key, {
      contentType: file.type,
      metadata: {
        purchaseOrderId: id,
        tenantCode,
        purchaseOrderNumber,
        stage,
        documentType,
        originalName: file.name,
        uploadedBy: session.user.id,
      },
    })

    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', { expiresIn: 3600 })

    const compositeKey = {
      purchaseOrderId_stage_documentType: {
        purchaseOrderId: id,
        stage,
        documentType,
      },
    }

    const existing = await prisma.purchaseOrderDocument.findUnique({
      where: compositeKey,
      select: {
        id: true,
        stage: true,
        documentType: true,
        fileName: true,
        contentType: true,
        size: true,
        s3Key: true,
        uploadedAt: true,
        uploadedByName: true,
      },
    })

    if (existing?.s3Key && existing.s3Key !== uploadResult.key) {
      try {
        await s3Service.deleteFile(existing.s3Key)
      } catch {
        // Best-effort cleanup only.
      }
    }

    const stored = await prisma.purchaseOrderDocument.upsert({
      where: compositeKey,
      create: {
        purchaseOrderId: id,
        stage,
        documentType,
        fileName: file.name,
        contentType: file.type,
        size: uploadResult.size,
        s3Key: uploadResult.key,
        uploadedById: session.user.id,
        uploadedByName: session.user.name ?? session.user.email ?? null,
        metadata: {
          originalName: file.name,
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        fileName: file.name,
        contentType: file.type,
        size: uploadResult.size,
        s3Key: uploadResult.key,
        uploadedAt: new Date(),
        uploadedById: session.user.id,
        uploadedByName: session.user.name ?? session.user.email ?? null,
        metadata: {
          originalName: file.name,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    await auditLog({
      entityType: 'PurchaseOrder',
      entityId: id,
      action: existing ? 'DOCUMENT_REPLACE' : 'DOCUMENT_UPLOAD',
      userId: session.user.id,
      oldValue: existing
        ? {
            documentId: existing.id,
            stage: existing.stage,
            documentType: existing.documentType,
            fileName: existing.fileName,
            contentType: existing.contentType,
            size: existing.size,
            uploadedAt: existing.uploadedAt.toISOString(),
            uploadedByName: existing.uploadedByName,
          }
        : null,
      newValue: {
        documentId: stored.id,
        stage: stored.stage,
        documentType: stored.documentType,
        fileName: stored.fileName,
        contentType: stored.contentType,
        size: stored.size,
        uploadedAt: stored.uploadedAt.toISOString(),
        uploadedByName: stored.uploadedByName,
      },
    })

    return NextResponse.json({
      success: true,
      document: {
        id: stored.id,
        stage: stored.stage,
        documentType: stored.documentType,
        fileName: stored.fileName,
        contentType: stored.contentType,
        size: stored.size,
        uploadedAt: stored.uploadedAt.toISOString(),
        uploadedByName: stored.uploadedByName,
        s3Key: stored.s3Key,
        viewUrl: presignedUrl,
      },
    })
  } catch (_error) {
    return NextResponse.json(
      {
        error: 'Failed to upload purchase order document',
        details: _error instanceof Error ? _error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

export const GET = withAuthAndParams(async (request, params, _session) => {
  try {
    const { id } = params as { id: string }
    if (!id) {
      return NextResponse.json({ error: 'Purchase order ID is required' }, { status: 400 })
    }

    const prisma = await getTenantPrisma()
    const s3Service = getS3Service()

    const searchParams = request.nextUrl.searchParams
    const download = searchParams.get('download') === 'true'

    const docs = await prisma.purchaseOrderDocument.findMany({
      where: { purchaseOrderId: id },
      orderBy: [{ stage: 'asc' }, { documentType: 'asc' }, { uploadedAt: 'desc' }],
    })

    const withUrls = await Promise.all(
      docs.map(async doc => {
        const url = await s3Service.getPresignedUrl(doc.s3Key, 'get', {
          expiresIn: 3600,
          responseContentDisposition: download
            ? `attachment; filename="${doc.fileName}"`
            : undefined,
        })

        return {
          id: doc.id,
          stage: doc.stage,
          documentType: doc.documentType,
          fileName: doc.fileName,
          contentType: doc.contentType,
          size: doc.size,
          uploadedAt: doc.uploadedAt.toISOString(),
          uploadedByName: doc.uploadedByName,
          s3Key: doc.s3Key,
          viewUrl: url,
        }
      })
    )

    return NextResponse.json({ documents: withUrls })
  } catch (_error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch purchase order documents',
        details: _error instanceof Error ? _error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
