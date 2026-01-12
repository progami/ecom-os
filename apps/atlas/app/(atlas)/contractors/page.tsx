'use client'

import { BriefcaseIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'

export default function ContractorsPage() {
  return (
    <>
      <ListPageHeader
        title="Contractors"
        description="Contractor information and management"
        icon={<BriefcaseIcon className="h-6 w-6 text-white" />}
      />

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <BriefcaseIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Contractors Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This section will contain contractor information and management tools.
        </p>
      </div>
    </>
  )
}
