import { redirect } from 'next/navigation'
import { getTenantPrisma } from '@/lib/tenant/server'

export default async function BatchRedirectPage({
  params,
}: {
  params: { batchId: string }
}) {
  const prisma = await getTenantPrisma()
  const batch = await prisma.skuBatch.findUnique({
    where: { id: params.batchId },
    select: { skuId: true },
  })

  if (!batch) {
    redirect('/config/products/batches')
  }

  redirect(`/config/products/batches?skuId=${encodeURIComponent(batch.skuId)}`)
}

