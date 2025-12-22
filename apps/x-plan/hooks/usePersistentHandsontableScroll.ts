"use client"

import { useCallback } from 'react'
import type Handsontable from 'handsontable'
import { usePersistentScroll } from '@/hooks/usePersistentScroll'

function resolveScrollHolder(hot: Handsontable | null): HTMLElement | null {
  if (!hot?.rootElement) return null
  return (
    (hot.rootElement.querySelector('.ht_master .wtHolder') as HTMLElement | null) ??
    (hot.rootElement.querySelector('.wtHolder') as HTMLElement | null)
  )
}

export function usePersistentHandsontableScroll(
  hotRef: React.RefObject<Handsontable | null>,
  key: string | null | undefined,
  enabled = true,
) {
  const getScrollElement = useCallback(() => resolveScrollHolder(hotRef.current), [hotRef])
  usePersistentScroll(key ? `hot:${key}` : key, enabled, getScrollElement)
}

