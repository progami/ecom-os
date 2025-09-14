'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

export function DevLogin() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDevLogin = async () => {
    setLoading(true)
    try {
      // Use environment variables for dev credentials to avoid hardcoding
      const result = await signIn('credentials', {
        emailOrUsername: process.env.NEXT_PUBLIC_DEV_EMAIL || 'admin@test.com',
        password: process.env.NEXT_PUBLIC_DEV_PASSWORD || process.env.NEXT_PUBLIC_DEV_PASS || '',
        callbackUrl: '/operations/inventory',
        redirect: true,
      })

      // If redirect: true, we won't reach here on success.
      // If we do, show error toast.
      if (result?.error) {
        toast.error('Login failed - check if demo user exists')
      }
    } catch (_error) {
      toast.error('Login error')
    } finally {
      setLoading(false)
    }
  }

  // This component is only rendered in development from the parent
  return (
    <button
      onClick={handleDevLogin}
      disabled={loading}
      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Logging in...' : 'Quick Dev Login (Demo Admin)'}
    </button>
  )
}
