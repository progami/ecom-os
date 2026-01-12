'use client'

import { FolderIcon, LockClosedIcon, BriefcaseIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ResourcesPage() {
  return (
    <>
      <ListPageHeader
        title="Resources"
        description="Company resources, passwords, and contractor information"
        icon={<FolderIcon className="h-6 w-6 text-white" />}
      />

      <Tabs defaultValue="resources" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="resources" className="gap-2">
            <FolderIcon className="h-4 w-4" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="passwords" className="gap-2">
            <LockClosedIcon className="h-4 w-4" />
            Passwords
          </TabsTrigger>
          <TabsTrigger value="contractors" className="gap-2">
            <BriefcaseIcon className="h-4 w-4" />
            Contractors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resources">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <FolderIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Resources Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This section will contain company resources, documents, and helpful materials for employees.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="passwords">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <LockClosedIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Passwords Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This section will contain shared passwords and credentials for team access.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="contractors">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <BriefcaseIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Contractors Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This section will contain contractor information and management tools.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
