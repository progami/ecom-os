import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AdminPage() {
 const session = await auth()
 
 if (!session || session.user.role !== 'admin') {
 redirect('/unauthorized')
 }
 
 // Redirect to admin dashboard by default
 redirect('/admin/dashboard')
}