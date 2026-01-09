import type { WorkflowTimelineEntry } from '@/lib/contracts/workflow-record';

type WorkflowTimelineProps = {
  items: WorkflowTimelineEntry[];
};

function formatWhen(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Determine event type for color coding
function getEventType(event: string): 'approve' | 'reject' | 'submit' | 'neutral' {
  const lower = event.toLowerCase();
  if (lower.includes('approved') || lower.includes('acknowledged')) return 'approve';
  if (lower.includes('rejected') || lower.includes('requested changes') || lower.includes('request changes')) return 'reject';
  if (lower.includes('submitted') || lower.includes('resubmitted')) return 'submit';
  return 'neutral';
}

export function WorkflowTimeline({ items }: WorkflowTimelineProps) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const eventType = getEventType(item.event);
        const eventColor =
          eventType === 'approve'
            ? 'text-success-600'
            : eventType === 'reject'
              ? 'text-warning-600'
              : eventType === 'submit'
                ? 'text-accent'
                : 'text-foreground';
        const dotColor =
          eventType === 'approve'
            ? 'bg-success-500'
            : eventType === 'reject'
              ? 'bg-warning-500'
              : eventType === 'submit'
                ? 'bg-accent'
                : 'bg-muted-foreground';

        return (
          <li key={item.id} className="flex gap-3">
            {/* Timeline dot instead of avatar for cleaner look */}
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full ${dotColor} mt-1.5`} />
              <div className="flex-1 w-px bg-border mt-1" />
            </div>
            <div className="flex-1 pb-4">
              <p className={`text-sm font-medium ${eventColor}`}>{item.event}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.actor.name} • {formatWhen(item.at)}
              </p>
              {item.note ? (
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line bg-muted/50 rounded-md px-3 py-2">
                  {item.note}
                </p>
              ) : null}
              {item.attachments?.length ? (
                <div className="mt-2 flex flex-col gap-1">
                  {item.attachments.map((att) => (
                    <a
                      key={att.downloadHref}
                      href={att.downloadHref}
                      className="text-xs text-accent hover:underline"
                    >
                      {att.name}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
