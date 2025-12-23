import { withAuth, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@ecom-os/prisma-wms'
import { sanitizeForDisplay, sanitizeSearchQuery } from '@/lib/security/input-sanitization'

export const dynamic = 'force-dynamic'

const SupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

const UpdateSupplierSchema = SupplierSchema.partial()

export const GET = withAuth(async (request, session) => {
  if (!['admin', 'staff'].includes(session.user.role)) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const prisma = await getTenantPrisma()
  const searchParams = request.nextUrl.searchParams
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const search = searchParams.get('search') ? sanitizeSearchQuery(searchParams.get('search')!) : null

  const where: Prisma.SupplierWhereInput = {}

  if (!includeInactive) {
    where.isActive = true
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  return ApiResponses.success({
    data: suppliers,
    count: suppliers.length,
  })
})

export const POST = withAuth(async (request, session) => {
  if (!['admin', 'staff'].includes(session.user.role)) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const prisma = await getTenantPrisma()
  const body = await request.json().catch(() => null)
  const parsed = SupplierSchema.safeParse(body)

  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const name = sanitizeForDisplay(parsed.data.name)
  if (!name) {
    return ApiResponses.badRequest('Invalid supplier name')
  }

  const existing = await prisma.supplier.findFirst({
    where: { name },
    select: { id: true },
  })

  if (existing) {
    return ApiResponses.conflict('Supplier already exists')
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      contactName: parsed.data.contactName ? sanitizeForDisplay(parsed.data.contactName) : null,
      email: parsed.data.email ? sanitizeForDisplay(parsed.data.email).toLowerCase() : null,
      phone: parsed.data.phone ? sanitizeForDisplay(parsed.data.phone) : null,
      address: parsed.data.address ? sanitizeForDisplay(parsed.data.address) : null,
      notes: parsed.data.notes ? sanitizeForDisplay(parsed.data.notes) : null,
      isActive: parsed.data.isActive ?? true,
    },
  })

  return ApiResponses.created({ supplier })
})

export const PATCH = withAuth(async (request, session) => {
  if (!['admin', 'staff'].includes(session.user.role)) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const supplierId = request.nextUrl.searchParams.get('id')
  if (!supplierId) {
    return ApiResponses.badRequest('Supplier ID is required')
  }

  const prisma = await getTenantPrisma()
  const body = await request.json().catch(() => null)
  const parsed = UpdateSupplierSchema.safeParse(body)

  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const data = parsed.data
  const nextName = data.name !== undefined ? sanitizeForDisplay(data.name) : undefined

  if (nextName !== undefined && !nextName) {
    return ApiResponses.badRequest('Invalid supplier name')
  }

  if (nextName) {
    const existing = await prisma.supplier.findFirst({
      where: { name: nextName, id: { not: supplierId } },
      select: { id: true },
    })
    if (existing) {
      return ApiResponses.conflict('Supplier name already exists')
    }
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: nextName,
        contactName:
          data.contactName !== undefined
            ? data.contactName
              ? sanitizeForDisplay(data.contactName)
              : null
            : undefined,
        email:
          data.email !== undefined
            ? data.email
              ? sanitizeForDisplay(data.email).toLowerCase()
              : null
            : undefined,
        phone:
          data.phone !== undefined
            ? data.phone
              ? sanitizeForDisplay(data.phone)
              : null
            : undefined,
        address:
          data.address !== undefined
            ? data.address
              ? sanitizeForDisplay(data.address)
              : null
            : undefined,
        notes:
          data.notes !== undefined
            ? data.notes
              ? sanitizeForDisplay(data.notes)
              : null
            : undefined,
        isActive: data.isActive ?? undefined,
      },
    })

    return ApiResponses.success({ supplier })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return ApiResponses.notFound('Supplier not found')
    }
    throw error
  }
})

export const DELETE = withAuth(async (request, session) => {
  if (!['admin', 'staff'].includes(session.user.role)) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const supplierId = request.nextUrl.searchParams.get('id')
  if (!supplierId) {
    return ApiResponses.badRequest('Supplier ID is required')
  }

  const prisma = await getTenantPrisma()

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true },
  })

  if (!supplier) {
    return ApiResponses.notFound('Supplier not found')
  }

  const [skuRefs, poRefs, txRefs] = await Promise.all([
    prisma.sku.count({
      where: {
        OR: [{ defaultSupplierId: supplierId }, { secondarySupplierId: supplierId }],
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        counterpartyName: {
          equals: supplier.name,
          mode: 'insensitive',
        },
      },
    }),
    prisma.inventoryTransaction.count({
      where: {
        supplier: {
          equals: supplier.name,
          mode: 'insensitive',
        },
      },
    }),
  ])

  if (skuRefs > 0 || poRefs > 0 || txRefs > 0) {
    return ApiResponses.conflict(
      `Cannot delete supplier "${supplier.name}". References found: SKUs=${skuRefs}, POs=${poRefs}, transactions=${txRefs}. Deactivate instead.`
    )
  }

  await prisma.supplier.delete({ where: { id: supplierId } })

  return ApiResponses.success({ deleted: true })
})
