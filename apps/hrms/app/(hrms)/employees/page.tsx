import { redirect } from 'next/navigation'

export default function EmployeesPage() {
  redirect('/organogram?view=person')
}
