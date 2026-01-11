'use client'

import Link from 'next/link'
import type { DisciplinaryAction } from '@/lib/api-client'
import { ChevronRightIcon, ShieldExclamationIcon } from '@/components/ui/Icons'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  VIOLATION_TYPE_LABELS,
  DISCIPLINARY_STATUS_LABELS,
  DISCIPLINARY_ACTION_TYPE_LABELS,
} from '@/lib/domain/disciplinary/constants'
import { formatDate } from '../utils'

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'CRITICAL':
      return { label: 'Critical', bgClass: 'bg-red-100', textClass: 'text-red-700' }
    case 'MAJOR':
      return { label: 'Major', bgClass: 'bg-orange-100', textClass: 'text-orange-700' }
    case 'MODERATE':
      return { label: 'Moderate', bgClass: 'bg-amber-100', textClass: 'text-amber-700' }
    case 'MINOR':
      return { label: 'Minor', bgClass: 'bg-slate-100', textClass: 'text-slate-700' }
    default:
      return { label: severity, bgClass: 'bg-slate-100', textClass: 'text-slate-600' }
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'CLOSED':
    case 'DISMISSED':
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-slate-100', textClass: 'text-slate-600' }
    case 'ACTIVE':
    case 'ACTION_TAKEN':
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' }
    case 'APPEALED':
    case 'APPEAL_PENDING_HR':
    case 'APPEAL_PENDING_SUPER_ADMIN':
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-purple-100', textClass: 'text-purple-700' }
    default:
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-amber-100', textClass: 'text-amber-700' }
  }
}

export function EmployeeViolationsTab({
  violations,
  loading,
}: {
  violations: DisciplinaryAction[]
  loading: boolean
}) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Disciplinary Actions</h2>
        {violations.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {violations.length} record{violations.length !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      ) : violations.length === 0 ? (
        <div className="text-center py-8">
          <ShieldExclamationIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No disciplinary records</p>
        </div>
      ) : (
        <div className="space-y-3">
          {violations.map((violation) => {
            const severityConfig = getSeverityConfig(violation.severity)
            const statusConfig = getStatusConfig(violation.status)
            const violationType = VIOLATION_TYPE_LABELS[violation.violationType as keyof typeof VIOLATION_TYPE_LABELS] ?? violation.violationType
            const actionType = violation.actionTaken
              ? DISCIPLINARY_ACTION_TYPE_LABELS[violation.actionTaken as keyof typeof DISCIPLINARY_ACTION_TYPE_LABELS] ?? violation.actionTaken
              : null

            return (
              <Link key={violation.id} href={`/violations/${violation.id}`} className="block group">
                <div className="rounded-lg border border-border bg-card p-4 hover:border-input hover:bg-muted/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{violationType}</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                            severityConfig.bgClass,
                            severityConfig.textClass
                          )}
                        >
                          {severityConfig.label}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                            statusConfig.bgClass,
                            statusConfig.textClass
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {actionType ? <span>{actionType}</span> : null}
                        {actionType ? <span>•</span> : null}
                        <span>Incident: {formatDate(violation.incidentDate)}</span>
                        {violation.caseId ? (
                          <>
                            <span>•</span>
                            <span className="font-mono text-xs">{violation.caseId}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
