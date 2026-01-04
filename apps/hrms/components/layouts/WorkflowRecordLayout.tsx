'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ActionButton } from '@/components/ui/ActionButton';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline';
import { ArrowLeftIcon } from '@/components/ui/Icons';
import type { ActionId } from '@/lib/contracts/action-ids';
import type { WorkflowRecordDTO, WorkflowTone } from '@/lib/contracts/workflow-record';
import type { WorkflowActionVariant } from '@/lib/contracts/workflow-record';

type WorkflowRecordLayoutProps = {
  backHref?: string;
  data: WorkflowRecordDTO;
  onAction?: (actionId: ActionId) => void | Promise<void>;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
};

function toDisplayText(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toneToBadgeVariant(
  tone: WorkflowTone,
): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    case 'info':
      return 'info';
    case 'neutral':
    default:
      return 'default';
  }
}

function actionVariantToButtonVariant(
  variant: WorkflowActionVariant,
): 'primary' | 'secondary' | 'ghost' | 'danger' {
  switch (variant) {
    case 'danger':
      return 'danger';
    case 'secondary':
      return 'secondary';
    case 'ghost':
      return 'ghost';
    case 'primary':
    default:
      return 'primary';
  }
}

export function WorkflowRecordLayout({
  backHref = '/work',
  data,
  onAction,
  headerActions,
  children,
}: WorkflowRecordLayoutProps) {
  const safeData = (data ?? {}) as Partial<WorkflowRecordDTO>;
  const identity = safeData.identity ?? { title: 'Record', recordId: '', href: backHref };
  const subject = safeData.subject ?? { displayName: '—' };
  const workflow = safeData.workflow ?? {
    currentStageId: 'unknown',
    currentStageLabel: 'Unknown',
    stages: [],
  };
  const access = safeData.access ?? { canView: true };
  const actions = safeData.actions ?? { primary: null, secondary: [], more: [] };
  const summary = Array.isArray(safeData.summary) ? safeData.summary : [];
  const timeline = Array.isArray(safeData.timeline) ? safeData.timeline : [];
  const stages = Array.isArray(workflow.stages) ? workflow.stages : [];

  const headerBadges = useMemo(() => {
    const badges: Array<{ label: string; tone: WorkflowTone }> = [];
    if (workflow.statusBadge?.label) {
      badges.push({
        label: toDisplayText(workflow.statusBadge.label, 'Status'),
        tone: workflow.statusBadge.tone,
      });
    }
    if (workflow.severity?.label) {
      badges.push({
        label: toDisplayText(workflow.severity.label, 'Severity'),
        tone: workflow.severity.tone,
      });
    }
    if (subject.statusChip?.label) {
      badges.push({
        label: toDisplayText(subject.statusChip.label, 'Status'),
        tone: subject.statusChip.tone,
      });
    }

    if (workflow.sla) {
      if (workflow.sla.isOverdue && workflow.sla.overdueLabel) {
        badges.push({
          label: toDisplayText(workflow.sla.overdueLabel, 'Overdue'),
          tone: workflow.sla.tone === 'danger' ? 'danger' : 'warning',
        });
      } else if (workflow.sla.dueAt) {
        const due = new Date(workflow.sla.dueAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        badges.push({ label: `Due ${due}`, tone: 'neutral' });
      }
    }

    return badges.filter((b) => typeof b.label === 'string' && b.label.trim());
  }, [subject.statusChip, workflow.severity, workflow.sla, workflow.statusBadge]);

  if (!access.canView) {
    return (
      <Card padding="lg">
        <h1 className="text-lg font-semibold text-foreground">No access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {access.noAccessReason ?? "You don't have access to this record."}
        </p>
        <div className="mt-4">
          <Link href={backHref} className="text-sm text-accent hover:underline">
            Back
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </Link>
              <div className="mt-2">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  {toDisplayText(identity.title, 'Record')}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {toDisplayText(subject.displayName, '—')}
                  {subject.employeeId ? ` • ${toDisplayText(subject.employeeId, '')}` : ''}
                  {subject.subtitle ? ` • ${toDisplayText(subject.subtitle, '')}` : ''}
                </p>
              </div>
              {headerBadges.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {headerBadges.map((b) => (
                    <Badge key={`${b.label}-${b.tone}`} variant={toneToBadgeVariant(b.tone)}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex flex-wrap items-start justify-end gap-2">
              {headerActions ?? null}
              {actions.primary ? (
                <ActionButton
                  label={actions.primary.label}
                  variant={actionVariantToButtonVariant(actions.primary.variant)}
                  disabled={actions.primary.disabled}
                  disabledReason={actions.primary.disabledReason}
                  onClick={() => {
                    if (!onAction) {
                      // eslint-disable-next-line no-console
                      console.warn(
                        '[WorkflowRecordLayout] onAction not provided for',
                        actions.primary?.id,
                      );
                      return;
                    }
                    void onAction(actions.primary!.id);
                  }}
                />
              ) : null}

              {actions.secondary.map((action) => (
                <ActionButton
                  key={action.id}
                  label={action.label}
                  variant={actionVariantToButtonVariant(action.variant)}
                  disabled={action.disabled}
                  disabledReason={action.disabledReason}
                  onClick={() => {
                    if (!onAction) {
                      // eslint-disable-next-line no-console
                      console.warn('[WorkflowRecordLayout] onAction not provided for', action.id);
                      return;
                    }
                    void onAction(action.id);
                  }}
                />
              ))}

              {actions.more.length ? (
                <details className="relative">
                  <summary className="list-none">
                    <ActionButton label="More" variant="secondary" />
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card shadow-lg p-2 z-10">
                    {actions.more.map((action) => (
                      <button
                        key={action.id}
                        className={
                          action.variant === 'danger'
                            ? 'w-full text-left px-3 py-2 text-sm rounded-md text-danger-700 hover:bg-danger-50'
                            : 'w-full text-left px-3 py-2 text-sm rounded-md text-foreground hover:bg-muted/50'
                        }
                        onClick={() => {
                          if (!onAction) {
                            // eslint-disable-next-line no-console
                            console.warn(
                              '[WorkflowRecordLayout] onAction not provided for',
                              action.id,
                            );
                            return;
                          }
                          void onAction(action.id);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
            {stages.map((stage, idx) => (
              <div key={stage.id ?? idx} className="flex items-center gap-2">
                <div
                  className={
                    stage.status === 'completed'
                      ? 'h-2.5 w-2.5 rounded-full bg-success-500'
                      : stage.status === 'current'
                        ? 'h-2.5 w-2.5 rounded-full bg-primary'
                        : 'h-2.5 w-2.5 rounded-full bg-border'
                  }
                />
                <span
                  className={
                    stage.status === 'upcoming' ? 'text-xs text-muted-foreground' : 'text-xs text-foreground'
                  }
                >
                  {toDisplayText(stage.label, '—')}
                </span>
                {idx < stages.length - 1 ? <div className="w-8 h-px bg-muted" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.map((row, idx) => (
                <div key={`${toDisplayText(row.label, 'Field')}-${idx}`}>
                  <p className="text-xs font-medium text-muted-foreground">
                    {toDisplayText(row.label, 'Field')}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {toDisplayText(row.value, '—')}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {children ? children : null}
        </div>

        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-foreground mb-3">Timeline</h3>
            <WorkflowTimeline items={timeline} />
          </Card>
        </div>
      </div>
    </div>
  );
}
