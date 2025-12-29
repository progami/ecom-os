import { EmployeeProfileClient } from '@/components/employee/EmployeeProfileClient'

type EmployeePageProps = {
  params: { id: string }
}

export default function EmployeeViewPage({ params }: EmployeePageProps) {
  return <EmployeeProfileClient employeeId={params.id} />
}
