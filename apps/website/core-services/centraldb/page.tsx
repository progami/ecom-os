import { redirect } from 'next/navigation'

export default function CentralDBPage() {
  // Redirect to CentralDB app running on port 3004
  redirect('http://localhost:3004')
}