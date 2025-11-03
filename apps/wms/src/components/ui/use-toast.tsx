'use client'

import * as React from "react"

type Toast = {
 id: string
 title?: string
 description?: string
 action?: React.ReactNode
 variant?: "default" | "destructive"
}

type ToastContextType = {
 toasts: Toast[]
 toast: (toast: Omit<Toast, "id">) => void
 dismiss: (toastId?: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function useToast() {
 const context = React.useContext(ToastContext)
 if (!context) {
 // Return a mock implementation when no provider exists
 return {
 toast: (_toast: Omit<Toast, "id">) => {
 // console.log("Toast:", toast)
 },
 toasts: [],
 dismiss: () => {},
 }
 }
 return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
 const [toasts, setToasts] = React.useState<Toast[]>([])

 const toast = React.useCallback((toast: Omit<Toast, "id">) => {
 const id = Date.now().toString()
 setToasts((prev) => [...prev, { ...toast, id }])
 
 // Auto dismiss after 5 seconds
 setTimeout(() => {
 setToasts((prev) => prev.filter((t) => t.id !== id))
 }, 5000)
 }, [])

 const dismiss = React.useCallback((toastId?: string) => {
 setToasts((prev) => {
 if (toastId) {
 return prev.filter((t) => t.id !== toastId)
 }
 return []
 })
 }, [])

 return (
 <ToastContext.Provider value={{ toasts, toast, dismiss }}>
 {children}
 </ToastContext.Provider>
 )
}