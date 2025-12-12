'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LeavePoliciesApi, type LeavePolicy } from '@/lib/api-client'
import { DocumentIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

const REGION_LABELS: Record<string, string> = {
  KANSAS_US: 'Kansas (USA)',
  PAKISTAN: 'Pakistan',
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO (Paid Time Off)',
  PARENTAL: 'Parental Leave',
  BEREAVEMENT_IMMEDIATE: 'Bereavement (Immediate Family)',
  BEREAVEMENT_EXTENDED: 'Bereavement (Extended Family)',
  JURY_DUTY: 'Jury Duty',
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  )
}

export default function ViewLeavePolicyPage() {
  const params = useParams()
  const id = params.id as string

  const [policy, setPolicy] = useState<LeavePolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await LeavePoliciesApi.get(id)
        setPolicy(data)
      } catch (e: any) {
        setError(e.message || 'Failed to load leave policy')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    )
  }

  if (error || !policy) {
    return (
      <div className="py-12">
        <EmptyState
          icon={<DocumentIcon className="h-12 w-12" />}
          title={error || 'Leave policy not found'}
          description="The leave policy you're looking for doesn't exist or has been removed."
          action={{
            label: 'Back to leave policies',
            href: '/policies',
          }}
        />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={policy.title}
        description={LEAVE_TYPE_LABELS[policy.leaveType] || policy.leaveType}
        icon={<DocumentIcon className="h-6 w-6 text-white" />}
        backHref="/policies"
      />

      <div className="max-w-4xl space-y-6">
        {/* Basic Info */}
        <Card padding="md">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <MetaItem label="Region">
              {REGION_LABELS[policy.region] || policy.region}
            </MetaItem>
            <MetaItem label="Status">
              <StatusBadge status={policy.status} />
            </MetaItem>
            <MetaItem label="Entitled Days">
              <span className="text-lg font-semibold text-cyan-700">{policy.entitledDays}</span>
              <span className="text-slate-500 ml-1">days/year</span>
            </MetaItem>
            <MetaItem label="Paid Leave">
              {policy.isPaid ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                  Yes
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                  No
                </span>
              )}
            </MetaItem>
          </div>
        </Card>

        {/* Policy Details */}
        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Policy Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <MetaItem label="Carryover Maximum">
              {policy.carryoverMax != null ? `${policy.carryoverMax} days` : 'No carryover'}
            </MetaItem>
            <MetaItem label="Minimum Notice">
              {policy.minNoticeDays > 0 ? `${policy.minNoticeDays} days` : 'None required'}
            </MetaItem>
            <MetaItem label="Max Consecutive Days">
              {policy.maxConsecutive != null ? `${policy.maxConsecutive} days` : 'No limit'}
            </MetaItem>
          </div>
        </Card>

        {/* Description */}
        {policy.description && (
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Description</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{policy.description}</p>
          </Card>
        )}
      </div>
    </>
  )
}
