import { Avatar } from '@/components/ui/Avatar';
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

export function WorkflowTimeline({ items }: WorkflowTimelineProps) {
  if (!items.length) {
    return <p className="text-sm text-gray-500">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <div className="pt-0.5">
            {item.actor.avatarUrl ? (
              <Avatar src={item.actor.avatarUrl} alt={item.actor.name} size="sm" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                {item.actor.type === 'system'
                  ? 'SYS'
                  : (item.actor.name?.slice(0, 1) || '?').toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-gray-900 truncate">{item.event}</p>
              <p className="text-xs text-gray-500 whitespace-nowrap">{formatWhen(item.at)}</p>
            </div>
            {item.transition ? (
              <p className="text-xs text-gray-600 mt-0.5">
                {item.transition.from} → {item.transition.to}
              </p>
            ) : null}
            {item.note ? (
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{item.note}</p>
            ) : null}
            {item.attachments?.length ? (
              <div className="mt-2 flex flex-col gap-1">
                {item.attachments.map((att) => (
                  <a
                    key={att.downloadHref}
                    href={att.downloadHref}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    {att.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
