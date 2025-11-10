import { useState, useEffect, useCallback } from 'react'
import type { Session } from 'next-auth'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

export function usePortalSession() {
  const [data, setData] = useState<Session | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/session', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) {
        setData(null)
        setStatus(response.status === 401 ? 'unauthenticated' : 'unauthenticated')
        return
      }
      const session = (await response.json()) as Session
      setData(session)
      setStatus('authenticated')
    } catch (error) {
      console.warn('[wms usePortalSession] failed to load session', error)
      setData(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const refresh = useCallback(async () => {
    setStatus('loading')
    await fetchSession()
  }, [fetchSession])

  return { data, status, update: refresh }
}

// Backwards-compatible alias so other modules can keep calling useSession.
export const useSession = usePortalSession
