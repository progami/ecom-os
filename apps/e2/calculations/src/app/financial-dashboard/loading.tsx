import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid gap-4">
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}