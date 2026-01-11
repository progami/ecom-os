'use client'

import { FolderIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'

export default function ResourcesPage() {
  return (
    <>
      <ListPageHeader
        title="Resources"
        description="Company resources and documents"
        icon={<FolderIcon className="h-6 w-6 text-white" />}
      />

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <FolderIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Resources Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This section will contain company resources, documents, and helpful materials for employees.
        </p>
      </div>
    </>
  )
}
