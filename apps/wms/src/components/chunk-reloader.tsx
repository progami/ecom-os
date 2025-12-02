'use client'

import { useEffect } from 'react'

/**
 * Forces a single hard reload if a chunk fails to load (stale cached bundle).
 * Prevents endless loops by gating on sessionStorage.
 */
export function ChunkReloader() {
  useEffect(() => {
    const reloadKey = 'wms_chunk_reload'

    const handler = (event: ErrorEvent) => {
      const message = event?.message?.toLowerCase() || ''
      const target = event?.target
      const isChunkScript =
        target instanceof HTMLScriptElement && target.src.includes('/_next/static/chunks/')
      const isChunkError = message.includes('loading chunk') || isChunkScript

      if (!isChunkError) return

      // Only reload once per session to avoid loops.
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(reloadKey)) return
      try {
        sessionStorage.setItem(reloadKey, '1')
      } catch (_err) {
        // ignore storage failures
      }
      window.location.reload()
    }

    window.addEventListener('error', handler)
    return () => window.removeEventListener('error', handler)
  }, [])

  return null
}

export default ChunkReloader
