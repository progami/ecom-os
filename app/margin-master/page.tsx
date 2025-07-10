import { redirect } from 'next/navigation'

export default function MarginMasterPage() {
  // Redirect to Margin Master app running on port 3400
  redirect('http://localhost:3400')
}