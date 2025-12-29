import { redirect } from 'next/navigation'
import { getCurrentEmployeeId } from '@/lib/current-user'

export default async function HubPage() {
  const employeeId = await getCurrentEmployeeId()
  if (!employeeId) {
    redirect('/no-access')
  }
  redirect(`/employees/${employeeId}`)
}
