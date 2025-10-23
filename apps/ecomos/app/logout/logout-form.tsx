"use client"

import { useEffect, useState } from 'react'
import { getCsrfToken } from 'next-auth/react'

type LogoutFormProps = {
  callbackUrl: string
}

export function LogoutForm({ callbackUrl }: LogoutFormProps) {
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getCsrfToken().then((token) => {
      if (!active) return
      setCsrfToken(token ?? '')
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <form className="logout-form" method="post" action="/api/auth/signout">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button type="submit" className="logout-submit-button" disabled={loading || !csrfToken}>
        Sign out securely
      </button>
    </form>
  )
}
