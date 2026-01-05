'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DisciplinaryActionsApi, MeApi, type DisciplinaryAction, type Me } from '@/lib/api-client'
import { ExclamationTriangleIcon, PencilIcon, UserIcon } from '@/components/ui/Icons'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardDivider } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { useNavigationHistory } from '@/lib/navigation-history'

const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Minor',
  MODERATE: 'Moderate',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
}

const STATUS_LABELS: Record<string, string> = {
  REPORTED: 'Reported',
  UNDER_REVIEW: 'Under Review',
  PENDING_HR_REVIEW: 'Pending HR Review',
  PENDING_ACKNOWLEDGMENT: 'Pending Acknowledgment',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground sm:text-right">{value}</span>
    </div>
  )
}

export default function DisciplinaryDetailPage() {
  const { goBack } = useNavigationHistory()
  const params = useParams()
  const id = params.id as string

  const [action, setAction] = useState<DisciplinaryAction | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [data, meData] = await Promise.all([
          DisciplinaryActionsApi.get(id),
          MeApi.get().catch(() => null),
        ])
        setAction(data)
        setMe(meData)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const canEdit = Boolean(me?.isHR || me?.isSuperAdmin)

  if (loading) {
    return (
      <>
        <PageHeader
          title="Violation Details"
          description="Loading..."
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </Card>
        </div>
      </>
    )
  }

  if (!action) {
    return (
      <>
        <PageHeader
          title="Violation Details"
          description="Not Found"
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
          showBack
        />
        <div className="max-w-3xl">
          <Card padding="lg">
            <Alert variant="error">{error ?? 'Violation not found'}</Alert>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Violation Details"
        description={`${action.employee?.firstName} ${action.employee?.lastName}`}
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-white" />}
        showBack
        actions={
          canEdit ? (
            <Button href={`/performance/disciplinary/${id}/edit`} icon={<PencilIcon className="h-4 w-4" />}>
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="max-w-3xl space-y-6">
        {/* Employee & Status */}
        <Card padding="lg">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <Link
                  href={`/employees/${action.employeeId}`}
                  className="text-lg font-semibold text-foreground hover:text-accent transition-colors"
                >
                  {action.employee?.firstName} {action.employee?.lastName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {action.employee?.position} • {action.employee?.department}
                </p>
              </div>
            </div>
            <StatusBadge status={STATUS_LABELS[action.status] ?? action.status} />
          </div>

          <CardDivider />

          <div className="space-y-1 mt-4">
            <InfoRow label="Violation Type" value={action.violationType} />
            <InfoRow label="Reason" value={action.violationReason} />
            <InfoRow label="Severity" value={SEVERITY_LABELS[action.severity] ?? action.severity} />
            <InfoRow label="Incident Date" value={formatDate(action.incidentDate)} />
            <InfoRow label="Reported Date" value={formatDate(action.reportedDate)} />
            <InfoRow label="Reported By" value={action.reportedBy} />
          </div>
        </Card>

        {/* Description */}
        <Card padding="lg">
          <h3 className="text-sm font-semibold text-foreground mb-3">Description</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{action.description}</p>
        </Card>

        {/* Values Breached */}
        {action.valuesBreached && action.valuesBreached.length > 0 && (
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">Values Breached</h3>
            <div className="flex flex-wrap gap-2">
              {action.valuesBreached.map((value) => (
                <span
                  key={value}
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-danger-100 text-danger-800"
                >
                  {value}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Evidence & Witnesses */}
        {(action.witnesses || action.evidence) && (
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">Evidence & Witnesses</h3>
            <div className="space-y-3">
              {action.witnesses && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Witnesses</p>
                  <p className="text-sm text-foreground">{action.witnesses}</p>
                </div>
              )}
              {action.evidence && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Evidence</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{action.evidence}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Action Taken */}
        <Card padding="lg">
          <h3 className="text-sm font-semibold text-foreground mb-3">Action Taken</h3>
          <div className="space-y-1">
            <InfoRow label="Action" value={action.actionTaken} />
            {action.actionDate && <InfoRow label="Action Date" value={formatDate(action.actionDate)} />}
            {action.actionDetails && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">Details</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{action.actionDetails}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Follow-up */}
        {(action.followUpDate || action.followUpNotes) && (
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">Follow-up</h3>
            <div className="space-y-1">
              {action.followUpDate && <InfoRow label="Follow-up Date" value={formatDate(action.followUpDate)} />}
              {action.followUpNotes && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{action.followUpNotes}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Resolution */}
        {action.resolution && (
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">Resolution</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{action.resolution}</p>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={goBack}>
            Back
          </Button>
          {canEdit && (
            <Button href={`/performance/disciplinary/${id}/edit`}>
              Edit Violation
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
