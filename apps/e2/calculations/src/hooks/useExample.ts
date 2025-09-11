import { useState, useEffect } from 'react'
import logger from '@/utils/logger';

/**
 * Example custom hook to demonstrate the hook pattern
 * Custom hooks encapsulate reusable stateful logic
 */
export function useExample(initialValue: string = '') {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Example effect
  useEffect(() => {
    // Perform side effects here
    logger.info('Value changed:', value)
  }, [value])

  // Example async operation
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setValue('Fetched data')
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  return {
    value,
    setValue,
    loading,
    error,
    fetchData
  }
}