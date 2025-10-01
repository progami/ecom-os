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
