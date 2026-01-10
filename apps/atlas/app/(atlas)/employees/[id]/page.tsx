import { EmployeeProfileClient } from '@/components/employee/EmployeeProfileClient'

type EmployeePageProps = {
  params: Promise<{ id: string }>
}

export default async function EmployeeViewPage({ params }: EmployeePageProps) {
  const { id } = await params
  return <EmployeeProfileClient employeeId={id} />
}
