'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function DevLogin() {
  const [loading, setLoading] = useState(false)

  const handleDevLogin = async () => {
    setLoading(true)
    try {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', window.location.origin + '/operations/inventory')
      window.location.href = url.toString()
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
