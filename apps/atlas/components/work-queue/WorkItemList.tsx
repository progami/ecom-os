'use client'

import type { WorkItemDTO } from '@/lib/contracts/work-items'
import { WorkItemCard } from './WorkItemCard'

type WorkItemListProps = {
  items: WorkItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function WorkItemList({ items, selectedId, onSelect }: WorkItemListProps) {
  if (!items.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-6 py-12">
          <div className="w-12 h-12 rounded-full bg-brand-teal-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-brand-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">You're all caught up</p>
          <p className="text-sm text-muted-foreground mt-1">No pending work items</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* List header */}
      <div className="flex items-center justify-between pb-3 mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Work Items
        </span>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0 -mr-2 pr-2 space-y-2">
        {items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={() => onSelect(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

