"use client"

import { Suspense, useEffect, useMemo, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import './login.css'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-container" />}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const error = searchParams.get('error') || ''

  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !callbackUrl) return
    try {
      const target = new URL(callbackUrl, window.location.origin)
      const current = new URL(window.location.href)
      const hostnameDiffers = target.hostname !== current.hostname
      const bothPortalHosts =
        target.hostname.endsWith('.ecomos.targonglobal.com') &&
        current.hostname.endsWith('.ecomos.targonglobal.com')
      if (hostnameDiffers && bothPortalHosts) {
        const redirect = new URL('/login', `${target.protocol}//${target.hostname}`)
        redirect.searchParams.set('callbackUrl', target.toString())
        window.location.replace(redirect.toString())
      }
    } catch {
      // ignore malformed URLs
    }
  }, [callbackUrl])

  const errorMessage = useMemo(() => {
    if (!error) return ''
    const messages: Record<string, string> = {
      AccessDenied: 'Your account is not allowed to sign in. Please contact an administrator.',
      PortalUserMissing: 'Your account is not provisioned in the portal directory.',
      OAuthCallback: 'Google rejected the sign-in request. Please try again.',
    }
    return messages[error] || 'Unable to sign in right now. Please try again or reach out to support.'
  }, [error])

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
        <div className="gradient-orb gradient-orb-3"></div>
      </div>

      <div className="login-card-wrapper">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-container">
              <div className="logo-gradient">
                <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <h1 className="login-title">ecomOS Portal</h1>
            <p className="login-headline">Welcome back</p>
            <p className="login-subtitle">Sign in with your targonglobal.com Google account</p>
          </div>

          {errorMessage && (
            <div className="form-global-error" role="alert">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            className="login-google-button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            <svg className="google-icon" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M17.64 9.2045C17.64 8.56632 17.5827 7.95268 17.4764 7.36364H9V10.8455H13.8436C13.635 11.97 13.0009 12.9236 12.0473 13.5636V15.8191H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z"
                fill="#4285F4"
              />
              <path
                d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8191L12.0473 13.5636C11.2423 14.1036 10.2114 14.4091 9 14.4091C6.65614 14.4091 4.67182 12.825 3.96409 10.71H0.957275V13.0418C2.43545 15.9832 5.48182 18 9 18Z"
                fill="#34A853"
              />
              <path
                d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.59091C10.3214 3.59091 11.49 4.04545 12.3941 4.90409L15.0191 2.27909C13.4632 0.834545 11.4264 0 9 0C5.48182 0 2.43545 2.01636 0.957275 4.95818L3.96409 7.29C4.67182 5.175 6.65614 3.59091 9 3.59091Z"
                fill="#EA4335"
              />
            </svg>
            {isGoogleLoading ? 'Signing in…' : 'Sign in with Google'}
          </button>

          <p className="login-note">
            Need access or see an issue? Contact the platform team.
          </p>
        </div>
      </div>
    </div>
  )
}
