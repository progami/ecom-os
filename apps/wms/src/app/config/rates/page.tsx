import { redirect } from 'next/navigation'

export default function RatesRedirectPage() {
 redirect('/config/warehouses?view=rates')
}
