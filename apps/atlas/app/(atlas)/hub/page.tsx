import { redirect } from 'next/navigation'
import { EmployeeProfileClient } from '@/components/employee/EmployeeProfileClient'
import { getCurrentEmployeeId } from '@/lib/current-user'

export default async function HubPage() {
  const employeeId = await getCurrentEmployeeId()
  if (!employeeId) {
    redirect('/no-access')
  }
  return <EmployeeProfileClient employeeId={employeeId} variant="hub" />
}
