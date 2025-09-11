import { useState, useEffect } from 'react'

interface Toast {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (newToast: Toast) => {
    // For now, just console log - you can enhance this with a proper toast UI
    if (newToast.variant === 'destructive') {
      console.error(`❌ ${newToast.title}: ${newToast.description}`)
    } else {
      console.log(`✅ ${newToast.title}: ${newToast.description}`)
    }
    
    // Show browser notification if available
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(newToast.title, {
          body: newToast.description,
          icon: newToast.variant === 'destructive' ? '❌' : '✅'
        })
      }
    }
  }

  return { toast }
}