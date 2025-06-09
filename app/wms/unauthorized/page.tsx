import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldX } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <ShieldX className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Unauthorized Access</h1>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page.
        </p>
        <div className="space-x-4">
          <Button asChild>
            <Link href="/app-selector">
              Go to App Selector
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/auth/login">
              Sign in with different account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}