import { NextResponse } from 'next/server';
import { Prisma } from '@targon/prisma-x-plan';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withXPlanAuth } from '@/lib/api/auth';
import { getStrategyActor } from '@/lib/strategy-access';

export const runtime = 'nodejs';

const migrateSchema = z.object({
  strategyId: z.string().min(1),
  oldSku: z.string().min(1),
  newSku: z.string().min(1),
  deleteEmptyConflict: z.boolean().default(false),
});

export const POST = withXPlanAuth(async (request: Request, session) => {
  const actor = getStrategyActor(session);
  if (!actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = migrateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.format() }, { status: 400 });
  }

  const { strategyId, oldSku, newSku, deleteEmptyConflict } = parsed.data;

  const sourceProduct = await prisma.product.findFirst({
    where: { strategyId, sku: oldSku },
    select: {
      id: true,
      sku: true,
      _count: {
        select: {
          salesWeeks: true,
          purchaseOrders: true,
          leadTimeOverrides: true,
          batchTableRows: true,
        },
      },
    },
  });

  if (!sourceProduct) {
    return NextResponse.json({ error: `Product with SKU "${oldSku}" not found` }, { status: 404 });
  }

  const conflictProduct = await prisma.product.findFirst({
    where: { strategyId, sku: newSku },
    select: {
      id: true,
      sku: true,
      _count: {
        select: {
          salesWeeks: true,
          purchaseOrders: true,
          leadTimeOverrides: true,
          batchTableRows: true,
        },
      },
    },
  });

  if (conflictProduct) {
    const conflictHasData =
      conflictProduct._count.salesWeeks > 0 ||
      conflictProduct._count.purchaseOrders > 0 ||
      conflictProduct._count.leadTimeOverrides > 0 ||
      conflictProduct._count.batchTableRows > 0;

    if (conflictHasData && !deleteEmptyConflict) {
      return NextResponse.json({
        error: `SKU "${newSku}" already exists with associated data. Cannot auto-delete.`,
        conflictProduct: {
          id: conflictProduct.id,
          salesWeeks: conflictProduct._count.salesWeeks,
          purchaseOrders: conflictProduct._count.purchaseOrders,
          leadTimeOverrides: conflictProduct._count.leadTimeOverrides,
          batchTableRows: conflictProduct._count.batchTableRows,
        },
      }, { status: 409 });
    }

    if (!deleteEmptyConflict) {
      return NextResponse.json({
        error: `SKU "${newSku}" already exists. Set deleteEmptyConflict=true to delete it.`,
        conflictProduct: { id: conflictProduct.id },
      }, { status: 409 });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.salesWeek.deleteMany({ where: { productId: conflictProduct.id } });
      await tx.purchaseOrder.deleteMany({ where: { productId: conflictProduct.id } });
      await tx.leadTimeOverride.deleteMany({ where: { productId: conflictProduct.id } });
      await tx.batchTableRow.deleteMany({ where: { productId: conflictProduct.id } });
      await tx.product.delete({ where: { id: conflictProduct.id } });

      await tx.product.update({
        where: { id: sourceProduct.id },
        data: { sku: newSku },
      });
    });

    return NextResponse.json({
      ok: true,
      message: `Deleted conflicting SKU "${newSku}" and renamed "${oldSku}" to "${newSku}"`,
      deletedProductId: conflictProduct.id,
      renamedProductId: sourceProduct.id,
    });
  }

  await prisma.product.update({
    where: { id: sourceProduct.id },
    data: { sku: newSku },
  });

  return NextResponse.json({
    ok: true,
    message: `Renamed SKU "${oldSku}" to "${newSku}"`,
    renamedProductId: sourceProduct.id,
  });
});
