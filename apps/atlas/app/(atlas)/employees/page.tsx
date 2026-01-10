import { Suspense } from 'react'
import { EmployeesClientPage } from './EmployeesClientPage'

export default function EmployeesPage() {
  return (
    <Suspense>
      <EmployeesClientPage />
    </Suspense>
  )
}
