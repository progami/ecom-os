'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSheetConfig } from '@/lib/sheets'

type LastLocation = {
  slug?: string
  query?: string
}

function parseLastLocation(raw: string | null): LastLocation | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as LastLocation
  } catch (error) {
    console.warn('[x-plan] failed to parse last location', error)
    return null
  }
}

export function LastSheetRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentQueryString = useMemo(() => searchParams?.toString() ?? '', [searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = parseLastLocation(window.sessionStorage.getItem('xplan:last-location'))
    const storedSlug = stored?.slug && getSheetConfig(stored.slug) ? stored.slug : '0-strategies'

    const mergedParams = new URLSearchParams(stored?.query ?? '')
    const currentParams = new URLSearchParams(currentQueryString)

    for (const [key, value] of currentParams.entries()) {
      mergedParams.set(key, value)
    }

    const query = mergedParams.toString()
    router.replace(`/${storedSlug}${query ? `?${query}` : ''}`)
  }, [currentQueryString, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-[#041324] dark:text-slate-300">
      Loading workbook…
    </div>
  )
}

