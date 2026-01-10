import { prisma } from '@/lib/prisma'

export type ConductCompanyWideResult = {
  canonicalPolicyId: string | null
  archivedPolicyIds: string[]
  acknowledgementsCopied: number
  updatedCanonical: boolean
  reason?: string
}

function normalizeCodeOfConductTitle(title: string): string {
  const trimmed = title.trim()
  if (!/^code of conduct\b/i.test(trimmed)) return trimmed
  return 'Code of Conduct'
}

function scoreCanonicalCandidate(candidate: {
  fileUrl: string | null
  content: string | null
  updatedAt: Date
  createdAt: Date
}): [number, number, number, number] {
  const fileScore = candidate.fileUrl ? 10 : 0
  const contentScore = candidate.content ? Math.min(10_000, candidate.content.length) : 0
  return [fileScore, contentScore, candidate.updatedAt.getTime(), candidate.createdAt.getTime()]
}

export async function ensureConductPolicyCompanyWide(): Promise<ConductCompanyWideResult> {
  const conductPolicies = await prisma.policy.findMany({
    where: { category: 'CONDUCT' },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      region: true,
      status: true,
      version: true,
      summary: true,
      content: true,
      fileUrl: true,
      updatedAt: true,
      createdAt: true,
    },
  })

  if (conductPolicies.length === 0) {
    return { canonicalPolicyId: null, archivedPolicyIds: [], acknowledgementsCopied: 0, updatedCanonical: false, reason: 'No CONDUCT policies found' }
  }

  const companyWide = conductPolicies.find((p) => p.region === 'ALL') ?? null

  const activeRegionSpecific = conductPolicies.filter(
    (p) => p.status === 'ACTIVE' && p.region !== 'ALL'
  )

  const canonicalCandidate = companyWide ??
    [...conductPolicies]
      .filter((p) => p.status === 'ACTIVE')
      .sort((a, b) => {
        const as = scoreCanonicalCandidate(a)
        const bs = scoreCanonicalCandidate(b)
        for (let i = 0; i < as.length; i += 1) {
          if (as[i] !== bs[i]) return bs[i] - as[i]
        }
        return a.id.localeCompare(b.id)
      })[0] ??
    conductPolicies[0]!

  const canonicalId = canonicalCandidate.id

  const canonicalTitle = normalizeCodeOfConductTitle(canonicalCandidate.title)
  const shouldUpdateCanonical = canonicalCandidate.region !== 'ALL' || canonicalTitle !== canonicalCandidate.title

  const otherActiveIds = activeRegionSpecific
    .map((p) => p.id)
    .filter((id) => id !== canonicalId)

  const acknowledgementsToCopy =
    otherActiveIds.length > 0
      ? await prisma.policyAcknowledgement.findMany({
          where: { policyId: { in: otherActiveIds }, policyVersion: canonicalCandidate.version },
          select: { employeeId: true, acknowledgedAt: true },
        })
      : []

  const archivedPolicyIds: string[] = []
  let acknowledgementsCopied = 0

  await prisma.$transaction(async (tx) => {
    if (shouldUpdateCanonical) {
      await tx.policy.update({
        where: { id: canonicalId },
        data: {
          region: 'ALL',
          title: canonicalTitle,
        },
      })
    }

    if (otherActiveIds.length > 0) {
      await tx.policy.updateMany({
        where: { id: { in: otherActiveIds } },
        data: { status: 'ARCHIVED' },
      })
      archivedPolicyIds.push(...otherActiveIds)
    }

    if (acknowledgementsToCopy.length > 0) {
      const created = await tx.policyAcknowledgement.createMany({
        data: acknowledgementsToCopy.map((ack) => ({
          policyId: canonicalId,
          employeeId: ack.employeeId,
          policyVersion: canonicalCandidate.version,
          acknowledgedAt: ack.acknowledgedAt,
        })),
        skipDuplicates: true,
      })
      acknowledgementsCopied = created.count
    }
  })

  return {
    canonicalPolicyId: canonicalId,
    archivedPolicyIds,
    acknowledgementsCopied,
    updatedCanonical: shouldUpdateCanonical,
  }
}
