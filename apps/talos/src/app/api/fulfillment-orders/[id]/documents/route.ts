import { NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { getS3Service } from '@/services/s3.service'
import { validateFile, scanFileContent } from '@/lib/security/file-upload'
import { FulfillmentOrderDocumentStage, Prisma } from '@ecom-os/prisma-talos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STAGES: readonly FulfillmentOrderDocumentStage[] = ['PACKING', 'SHIPPING', 'DELIVERY']

function parseStage(value: unknown): FulfillmentOrderDocumentStage | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return (STAGES as readonly string[]).includes(trimmed)
    ? (trimmed as FulfillmentOrderDocumentStage)
    : null
}

function parseDocumentType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) return null
  return trimmed
}

export const POST = withAuthAndParams(async (request, params, session) => {
  try {
    const { id } = params as { id: string }
    if (!id) {
      return NextResponse.json({ error: 'Fulfillment order ID is required' }, { status: 400 })
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

    const order = await prisma.fulfillmentOrder.findUnique({
      where: { id },
      select: { id: true, foNumber: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Fulfillment order not found' }, { status: 404 })
    }

    const validation = await validateFile(file, 'fulfillment-order-document')
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

    const s3Key = s3Service.generateKey(
      {
        type: 'fulfillment-order',
        fulfillmentOrderId: id,
        tenantCode,
        fulfillmentOrderNumber: order.foNumber ?? undefined,
        stage,
        documentType,
      },
      file.name
    )

    const uploadResult = await s3Service.uploadFile(buffer, s3Key, {
      contentType: file.type,
      metadata: {
        fulfillmentOrderId: id,
        tenantCode,
        fulfillmentOrderNumber: order.foNumber ?? '',
        stage,
        documentType,
        originalName: file.name,
        uploadedBy: session.user.id,
      },
    })

    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', { expiresIn: 3600 })

    const compositeKey = {
      fulfillmentOrderId_stage_documentType: {
        fulfillmentOrderId: id,
        stage,
        documentType,
      },
    }

    const existing = await prisma.fulfillmentOrderDocument.findUnique({
      where: compositeKey,
      select: { s3Key: true },
    })

    if (existing?.s3Key && existing.s3Key !== uploadResult.key) {
      try {
        await s3Service.deleteFile(existing.s3Key)
      } catch {
        // Best-effort cleanup only.
      }
    }

    const stored = await prisma.fulfillmentOrderDocument.upsert({
      where: compositeKey,
      create: {
        fulfillmentOrderId: id,
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
        error: 'Failed to upload fulfillment order document',
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
      return NextResponse.json({ error: 'Fulfillment order ID is required' }, { status: 400 })
    }

    const prisma = await getTenantPrisma()
    const s3Service = getS3Service()

    const searchParams = request.nextUrl.searchParams
    const download = searchParams.get('download') === 'true'

    const docs = await prisma.fulfillmentOrderDocument.findMany({
      where: { fulfillmentOrderId: id },
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
        error: 'Failed to fetch fulfillment order documents',
        details: _error instanceof Error ? _error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
