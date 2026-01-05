import { useCallback, useRef, useState } from 'react'

export interface UndoRedoOptions<T> {
  /**
   * Maximum number of history entries to keep.
   * Default: 50
   */
  maxHistory?: number
  /**
   * Callback when state changes via undo/redo.
   * Use this to sync with external state (e.g., trigger API updates).
   */
  onStateChange?: (state: T, action: 'undo' | 'redo') => void
}

export interface UndoRedoHandle<T> {
  /**
   * Current state
   */
  state: T
  /**
   * Update state and push to history
   */
  setState: (state: T) => void
  /**
   * Replace current state without creating history entry.
   * Use for external state updates (e.g., from server).
   */
  replaceState: (state: T) => void
  /**
   * Undo last change
   */
  undo: () => void
  /**
   * Redo last undone change
   */
  redo: () => void
  /**
   * Whether undo is available
   */
  canUndo: boolean
  /**
   * Whether redo is available
   */
  canRedo: boolean
  /**
   * Clear all history
   */
  clearHistory: () => void
  /**
   * Create a checkpoint in history (batches multiple edits)
   */
  checkpoint: () => void
}

/**
 * Hook for undo/redo functionality with configurable history depth.
 *
 * Usage:
 * ```tsx
 * const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo(initialData)
 *
 * // In keydown handler:
 * if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
 *   if (event.shiftKey) {
 *     redo()
 *   } else {
 *     undo()
 *   }
 * }
 * ```
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions<T> = {}
): UndoRedoHandle<T> {
  const { maxHistory = 50, onStateChange } = options

  const [state, setStateInternal] = useState<T>(initialState)
  const historyRef = useRef<T[]>([initialState])
  const currentIndexRef = useRef<number>(0)
  const checkpointIndexRef = useRef<number | null>(null)

  const setState = useCallback((newState: T) => {
    // If we're not at the end of history, truncate future states
    if (currentIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1)
    }

    // Add new state to history
    historyRef.current.push(newState)
    currentIndexRef.current = historyRef.current.length - 1

    // Trim history if it exceeds maxHistory
    if (historyRef.current.length > maxHistory) {
      const excess = historyRef.current.length - maxHistory
      historyRef.current = historyRef.current.slice(excess)
      currentIndexRef.current = Math.max(0, currentIndexRef.current - excess)
    }

    setStateInternal(newState)
  }, [maxHistory])

  const replaceState = useCallback((newState: T) => {
    // Replace current state without creating history entry
    historyRef.current[currentIndexRef.current] = newState
    setStateInternal(newState)
  }, [])

  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current -= 1
      const previousState = historyRef.current[currentIndexRef.current]
      setStateInternal(previousState)
      onStateChange?.(previousState, 'undo')
    }
  }, [onStateChange])

  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current += 1
      const nextState = historyRef.current[currentIndexRef.current]
      setStateInternal(nextState)
      onStateChange?.(nextState, 'redo')
    }
  }, [onStateChange])

  const canUndo = currentIndexRef.current > 0
  const canRedo = currentIndexRef.current < historyRef.current.length - 1

  const clearHistory = useCallback(() => {
    const currentState = historyRef.current[currentIndexRef.current]
    historyRef.current = [currentState]
    currentIndexRef.current = 0
    checkpointIndexRef.current = null
  }, [])

  const checkpoint = useCallback(() => {
    // Marks current position as a checkpoint for batch operations
    checkpointIndexRef.current = currentIndexRef.current
  }, [])

  return {
    state,
    setState,
    replaceState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    checkpoint,
  }
}

/**
 * Hook to handle Ctrl+Z/Cmd+Z keyboard shortcuts for undo/redo.
 * Returns a keydown handler to attach to your container element.
 */
export function useUndoRedoKeyHandler(
  undo: () => void,
  redo: () => void,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options

  return useCallback(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      if (!enabled) return false

      const isCtrlOrCmd = event.ctrlKey || event.metaKey
      const isZ = event.key.toLowerCase() === 'z'
      const isY = event.key.toLowerCase() === 'y'

      if (isCtrlOrCmd && isZ) {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return true
      }

      // Also support Ctrl+Y for redo (Windows convention)
      if (isCtrlOrCmd && isY && !event.shiftKey) {
        event.preventDefault()
        redo()
        return true
      }

      return false
    },
    [enabled, undo, redo]
  )
}
