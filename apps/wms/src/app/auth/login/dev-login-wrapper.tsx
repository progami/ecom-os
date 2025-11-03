'use client'

import { useState, useEffect } from 'react'
import { DevLogin } from '@/components/auth/dev-login'

export function DevLoginWrapper() {
 const [isDevelopment, setIsDevelopment] = useState(false)
 
 useEffect(() => {
 // Check if we're in development mode based on hostname
 const isDev = window.location.hostname === 'localhost' || 
 window.location.hostname === '127.0.0.1' ||
 window.location.hostname.includes('dev.')
 setIsDevelopment(isDev)
 }, [])
 
 if (!isDevelopment) {
 return null
 }

 return (
 <div className="mt-4">
 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <div className="w-full border-t border-slate-300" />
 </div>
 <div className="relative flex justify-center text-sm">
 <span className="px-2 bg-slate-50 text-slate-500">
 Development Only
 </span>
 </div>
 </div>
 <div className="mt-4">
 <DevLogin />
 </div>
 </div>
 )
}