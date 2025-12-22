'use client'

import { useTheme } from 'next-themes'

const HANDSONTABLE_THEME_LIGHT = 'ht-theme-classic'
const HANDSONTABLE_THEME_DARK = 'ht-theme-classic-dark'

export function useHandsontableThemeName() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark' ? HANDSONTABLE_THEME_DARK : HANDSONTABLE_THEME_LIGHT
}

