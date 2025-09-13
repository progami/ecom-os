'use client'

import { useEffect, useState } from 'react'
import HRMSNavigation from './components/HRMSNavigation'

type Density = 'compact' | 'comfortable'

export default function HRMSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [density, setDensity] = useState<Density>('compact')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hrmsDensity') as Density | null
      if (stored === 'compact' || stored === 'comfortable') setDensity(stored)
    } catch {}
    const handler = (e: any) => {
      const d = e?.detail as Density | null
      if (d === 'compact' || d === 'comfortable') setDensity(d)
      else {
        // re-read
        try {
          const stored = localStorage.getItem('hrmsDensity') as Density | null
          if (stored === 'compact' || stored === 'comfortable') setDensity(stored)
        } catch {}
      }
    }
    window.addEventListener('hrms:density', handler as any)
    return () => window.removeEventListener('hrms:density', handler as any)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <HRMSNavigation />
      <main className={`flex-1 flex flex-col min-h-0 ${density === 'compact' ? 'hrms-density-compact' : 'hrms-density-comfortable'}`}>
        <div className="px-4 sm:px-6 md:px-8 py-4 flex-1 min-h-0">
          {children}
        </div>
      </main>
    </div>
  )
}
