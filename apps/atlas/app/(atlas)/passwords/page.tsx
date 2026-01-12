'use client'

import { LockClosedIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'

export default function PasswordsPage() {
  return (
    <>
      <ListPageHeader
        title="Passwords"
        description="Shared passwords and credentials"
        icon={<LockClosedIcon className="h-6 w-6 text-white" />}
      />

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
        <LockClosedIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Passwords Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This section will contain shared passwords and credentials for team access.
        </p>
      </div>
    </>
  )
}
