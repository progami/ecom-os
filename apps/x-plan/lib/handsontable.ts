import Handsontable from 'handsontable'

export function finishEditingSafely(hot: Handsontable) {
  const core = hot as unknown as {
    finishEditing?: (restoreOriginalValue?: boolean) => void
    getPlugin?: (key: string) => unknown
    getActiveEditor?: () => { close?: () => void; finishEditing?: (restore?: boolean) => void } | undefined
  }

  if (typeof core.finishEditing === 'function') {
    try {
      core.finishEditing(false)
      return
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error
      }
    }
  }

  const editorManager = core.getPlugin?.('editorManager') as
    | {
        finishEditing?: (restoreOriginalValue?: boolean) => void
        closeAll?: () => void
        getActiveEditor?: () => { close?: () => void; finishEditing?: (restore?: boolean) => void } | undefined
      }
    | undefined

  if (editorManager) {
    if (typeof editorManager.finishEditing === 'function') {
      editorManager.finishEditing(false)
      return
    }
    if (typeof editorManager.closeAll === 'function') {
      editorManager.closeAll()
      return
    }
  }

  const activeEditor = editorManager?.getActiveEditor?.() ?? core.getActiveEditor?.()
  if (activeEditor) {
    if (typeof activeEditor.finishEditing === 'function') {
      activeEditor.finishEditing(false)
      return
    }
    activeEditor.close?.()
  }
}

export type HandsontableSelectionStats = {
  rangeCount: number
  cellCount: number
  numericCount: number
  sum: number
  average: number | null
}

function parseNumericCandidate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') return null

  let raw = value.trim()
  if (!raw || raw === '∞') return null

  let isNegative = false
  if (raw.startsWith('(') && raw.endsWith(')')) {
    isNegative = true
    raw = raw.slice(1, -1).trim()
  }

  const normalized = raw.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return isNegative ? -parsed : parsed
}

export function getSelectionStats(hot: Handsontable): HandsontableSelectionStats | null {
  const ranges = hot.getSelectedRange()
  if (!ranges || ranges.length === 0) return null

  const maxRow = hot.countRows() - 1
  const maxCol = hot.countCols() - 1
  if (maxRow < 0 || maxCol < 0) return null

  let cellCount = 0
  let numericCount = 0
  let sum = 0

  const visited = ranges.length > 1 ? new Set<string>() : null

  for (const range of ranges as any[]) {
    const from = range?.from
    const to = range?.to
    if (!from || !to) continue

    const top = Math.min(Number(from.row), Number(to.row))
    const bottom = Math.max(Number(from.row), Number(to.row))
    const left = Math.min(Number(from.col), Number(to.col))
    const right = Math.max(Number(from.col), Number(to.col))

    const rowStart = Math.max(0, top)
    const rowEnd = Math.min(maxRow, bottom)
    const colStart = Math.max(0, left)
    const colEnd = Math.min(maxCol, right)

    if (rowStart > rowEnd || colStart > colEnd) continue

    const matrix = hot.getData(rowStart, colStart, rowEnd, colEnd)
    for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
      const row = matrix[rowOffset]
      if (!row) continue
      for (let colOffset = 0; colOffset < row.length; colOffset += 1) {
        const absoluteRow = rowStart + rowOffset
        const absoluteCol = colStart + colOffset
        if (visited) {
          const key = `${absoluteRow}:${absoluteCol}`
          if (visited.has(key)) continue
          visited.add(key)
        }

        cellCount += 1
        const numeric = parseNumericCandidate(row[colOffset])
        if (numeric == null) continue
        numericCount += 1
        sum += numeric
      }
    }
  }

  if (cellCount === 0) return null

  return {
    rangeCount: ranges.length,
    cellCount,
    numericCount,
    sum,
    average: numericCount > 0 ? sum / numericCount : null,
  }
}
