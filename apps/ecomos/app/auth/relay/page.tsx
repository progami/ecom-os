"use client"

import { useEffect } from 'react'

export default function AuthRelay({ searchParams }: { searchParams?: { to?: string } }) {
  const to = searchParams?.to || '/'
  useEffect(() => {
    try {
      const url = new URL(to)
      window.location.replace(url.toString())
    } catch {
      window.location.replace('/')
    }
  }, [to])

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', color:'#fff', padding:16}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{fontSize:20, fontWeight:700}}>Redirecting…</h1>
        <p style={{opacity:0.8}}>Taking you to your application.</p>
      </div>
    </div>
  )
}

