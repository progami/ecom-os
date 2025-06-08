'use client'

import { useState, useEffect } from 'react'

/**
 * Hook for functional components to throw errors to the nearest error boundary
 * @returns A function to throw an error
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return setError
}