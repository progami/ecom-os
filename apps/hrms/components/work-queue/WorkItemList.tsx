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
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm font-medium text-gray-900">You’re all caught up</p>
        <p className="text-sm text-gray-600 mt-1">No work items are pending for you right now.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <WorkItemCard
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </div>
  )
}

