'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to finance page
    router.replace('/finance')
  }, [router])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <LoadingSpinner />
    </div>
  )
}