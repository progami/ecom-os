'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ChartBarIcon, DocumentIcon, SpinnerIcon } from '@/components/ui/Icons'
import { OpsDashboardsApi, type ComplianceDashboardSnapshot, type HrOpsDashboardSnapshot } from '@/lib/api-client'

type Tab = 'HR_OPS' | 'COMPLIANCE'

function pct(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

function sumCounts(values: Record<string, number>): number {
  return Object.values(values).reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0)
}

export default function AdminDashboardsPage() {
  const [tab, setTab] = useState<Tab>('HR_OPS')
  const [hrOps, setHrOps] = useState<HrOpsDashboardSnapshot | null>(null)
  const [compliance, setCompliance] = useState<ComplianceDashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [hrOpsData, complianceData] = await Promise.all([
          OpsDashboardsApi.getHrOps(),
          OpsDashboardsApi.getCompliance(),
        ])
        setHrOps(hrOpsData)
        setCompliance(complianceData)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load dashboards'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const overallCompliancePct = useMemo(() => {
    if (!compliance) return null
    const totals = compliance.policies.reduce(
      (acc, p) => {
        acc.applicable += p.applicableCount
        acc.ack += p.acknowledgedCount
        return acc
      },
      { applicable: 0, ack: 0 }
    )
    if (totals.applicable === 0) return 100
    return Math.round((totals.ack / totals.applicable) * 1000) / 10
  }, [compliance])

  const exportHrOps = () => {
    window.location.href = '/api/exports/hr-ops-overdue'
  }

  const exportPolicyCompliance = () => {
    window.location.href = '/api/exports/policy-ack-compliance?status=PENDING'
  }

  if (loading) {
    return (
      <>
        <PageHeader
          title="Dashboards"
          description="Admin"
          icon={<ChartBarIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <Card padding="lg">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <SpinnerIcon className="h-5 w-5 animate-spin text-blue-600" />
            Loading dashboards…
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboards"
        description="Admin"
        icon={<ChartBarIcon className="h-6 w-6 text-white" />}
        showBack
        actions={(
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<DocumentIcon className="h-4 w-4" />}
              onClick={tab === 'HR_OPS' ? exportHrOps : exportPolicyCompliance}
              disabled={Boolean(error)}
            >
              Export CSV
            </Button>
          </div>
        )}
      />

      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => setTab('HR_OPS')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'HR_OPS' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          HR Ops
        </button>
        <button
          onClick={() => setTab('COMPLIANCE')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'COMPLIANCE' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Compliance
        </button>
      </div>

      {tab === 'HR_OPS' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overdue approvals</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {(hrOps?.overdue.leaves.count ?? 0) + (hrOps?.overdue.reviews.count ?? 0) + (hrOps?.overdue.violations.count ?? 0)}
              </p>
              <p className="mt-1 text-sm text-gray-600">Leaves, reviews, violations</p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ack pending</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{hrOps?.overdue.acknowledgements.count ?? 0}</p>
              <p className="mt-1 text-sm text-gray-600">Reviews + violations</p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Onboarding blocked</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{hrOps?.overdue.onboarding.blockedCount ?? 0}</p>
              <p className="mt-1 text-sm text-gray-600">Waiting on dependencies</p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open cases</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{hrOps ? sumCounts(hrOps.cases.byStatus) : 0}</p>
              <p className="mt-1 text-sm text-gray-600">All statuses</p>
            </Card>
          </div>

          <Card padding="lg">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Overdue items</h2>

            <div className="space-y-6">
              {([
                { title: 'Leaves', items: hrOps?.overdue.leaves.items ?? [] },
                { title: 'Reviews', items: hrOps?.overdue.reviews.items ?? [] },
                { title: 'Violations', items: hrOps?.overdue.violations.items ?? [] },
                { title: 'Acknowledgements', items: hrOps?.overdue.acknowledgements.items ?? [] },
                { title: 'Onboarding blocked', items: hrOps?.overdue.onboarding.blockedItems ?? [] },
                { title: 'Onboarding overdue tasks', items: hrOps?.overdue.onboarding.overdueTasks ?? [] },
              ] as const).map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{section.title}</p>
                  {section.items.length === 0 ? (
                    <p className="text-sm text-gray-500">No items.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
                      {section.items.slice(0, 12).map((item) => (
                        <a
                          key={`${section.title}:${item.id}`}
                          href={item.href}
                          className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{item.subtitle}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Policies</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{compliance?.policies.length ?? 0}</p>
              <p className="mt-1 text-sm text-gray-600">Active</p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending acknowledgements</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {compliance?.policies.reduce((acc, p) => acc + p.pendingCount, 0) ?? 0}
              </p>
              <p className="mt-1 text-sm text-gray-600">Across all policies</p>
            </Card>
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall compliance</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{overallCompliancePct === null ? '—' : pct(overallCompliancePct)}</p>
              <p className="mt-1 text-sm text-gray-600">Applicable acknowledgements</p>
            </Card>
          </div>

          <Card padding="lg">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Policy acknowledgement compliance</h2>
            {compliance?.policies.length ? (
              <div className="overflow-auto border border-gray-100 rounded-lg">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Policy</th>
                      <th className="text-left px-4 py-3 font-semibold">Region</th>
                      <th className="text-right px-4 py-3 font-semibold">Applicable</th>
                      <th className="text-right px-4 py-3 font-semibold">Ack</th>
                      <th className="text-right px-4 py-3 font-semibold">Pending</th>
                      <th className="text-right px-4 py-3 font-semibold">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {compliance.policies.map((p) => (
                      <tr key={p.policyId} className="bg-white">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.title}</p>
                          <p className="text-xs text-gray-500">{p.category} • v{p.version}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.region}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.applicableCount}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.acknowledgedCount}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{p.pendingCount}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{pct(p.compliancePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No active policies found.</p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
