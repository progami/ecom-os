'use client'

import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'

type ConfirmDialogTone = 'default' | 'danger'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  isBusy?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isBusy = false,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => {
      previous?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  const confirmClasses =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white dark:text-white'
      : 'bg-cyan-600 hover:bg-cyan-700 dark:bg-[#00c2b9] dark:hover:bg-[#00a39e] text-white dark:text-[#002430]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={() => {
        if (isBusy) return
        onOpenChange(false)
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_26px_55px_rgba(1,12,24,0.25)] outline-none backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#041324]/95"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description ? (
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-200/80">{description}</p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm transition hover:border-cyan-500 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-cyan-300/50 dark:hover:text-cyan-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={clsx(
              'rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] shadow-md transition disabled:cursor-not-allowed disabled:opacity-60',
              confirmClasses
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

