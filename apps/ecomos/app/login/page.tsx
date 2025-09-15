"use client"

import { useEffect, useState } from 'react'

export default function LoginPage({ searchParams }: { searchParams?: { callbackUrl?: string } }) {
  const callbackUrl = searchParams?.callbackUrl || '/'
  const [csrfToken, setCsrfToken] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch('/api/auth/csrf', { credentials: 'include' })
        if (!res.ok) return
        const json = await res.json()
        if (mounted) setCsrfToken(json?.csrfToken || '')
      } catch { /* ignore */ }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', color:'#fff', padding:16}}>
      <form method="post" action="/api/auth/callback/credentials" style={{background:'#0b1220', border:'1px solid #1f2a44', borderRadius:12, padding:24, width:360}}>
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <h1 style={{fontSize:24, fontWeight:700, marginBottom:16}}>Sign in to ecomOS</h1>
        <div style={{marginBottom:12}}>
          <label style={{display:'block', fontSize:12, color:'#cbd5e1', marginBottom:6}}>Email or Username</label>
          <input name="emailOrUsername" placeholder="you@example.com" style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #1f2a44', background:'#0a1220', color:'#fff'}} />
        </div>
        <div style={{marginBottom:16}}>
          <label style={{display:'block', fontSize:12, color:'#cbd5e1', marginBottom:6}}>Password</label>
          <input name="password" type="password" placeholder="••••••••" style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #1f2a44', background:'#0a1220', color:'#fff'}} />
        </div>
        <button disabled={!csrfToken} type="submit" style={{width:'100%', padding:12, borderRadius:8, background: csrfToken ? '#10b981' : '#475569', border:'none', color:'#001015', fontWeight:700}}>
          {csrfToken ? 'Sign In' : 'Loading…'}
        </button>
      </form>
    </div>
  )
}
