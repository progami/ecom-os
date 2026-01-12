import { redirect } from 'next/navigation'
import { HubDashboard } from '@/components/hub'
import { getCurrentEmployeeId } from '@/lib/current-user'

export default async function HubPage() {
  const employeeId = await getCurrentEmployeeId()
  if (!employeeId) {
    redirect('/no-access')
  }

  return <HubDashboard employeeId={employeeId} />
}
