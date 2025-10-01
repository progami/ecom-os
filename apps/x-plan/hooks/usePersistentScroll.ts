"use client"

import { useEffect, useRef } from 'react'

export function usePersistentScroll(key: string | null | undefined, enabled = true) {
  useEffect(() => {
    if (!enabled || !key || typeof window === 'undefined') return

    const storageKey = `xplan:scroll:${key}`
    let restoreFrame = 0
    let saveFrame = 0

    const writePosition = () => {
      try {
        const top = Math.max(0, Math.floor(window.scrollY))
        window.sessionStorage.setItem(storageKey, String(top))
      } catch (error) {
        console.warn('[x-plan] failed to persist scroll position', storageKey, error)
      }
    }

    const scheduleSave = () => {
      if (saveFrame) cancelAnimationFrame(saveFrame)
      saveFrame = requestAnimationFrame(writePosition)
    }

    const restorePosition = () => {
      try {
        const raw = window.sessionStorage.getItem(storageKey)
        if (raw == null) return
        const top = Number.parseInt(raw, 10)
        if (!Number.isNaN(top)) {
          window.scrollTo({ top })
        }
      } catch (error) {
        console.warn('[x-plan] failed to restore scroll position', storageKey, error)
      }
    }

    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(restorePosition)
    })

    window.addEventListener('scroll', scheduleSave, { passive: true })
    window.addEventListener('beforeunload', writePosition)
    window.addEventListener('pagehide', writePosition)

    return () => {
      if (restoreFrame) cancelAnimationFrame(restoreFrame)
      if (saveFrame) cancelAnimationFrame(saveFrame)
      window.removeEventListener('scroll', scheduleSave)
      window.removeEventListener('beforeunload', writePosition)
      window.removeEventListener('pagehide', writePosition)
      writePosition()
    }
  }, [key, enabled])
}
