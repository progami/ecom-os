"use client"

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
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
  const router = useRouter()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const [csrfToken, setCsrfToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState(() => {
    if (process.env.NODE_ENV === 'production') {
      return { emailOrUsername: '', password: '' }
    }

    return {
      emailOrUsername: process.env.NEXT_PUBLIC_DEMO_ADMIN_USERNAME ?? 'demo-admin',
      password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? 'demo-password',
    }
  })
  const [errors, setErrors] = useState({ emailOrUsername: '', password: '' })
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    const error = searchParams.get('error')
    if (!error) {
      setGlobalError('')
      return
    }
    const code = error
    const friendly: Record<string, string> = {
      CredentialsSignin: 'Invalid email or password. Please try again.',
      AccessDenied: 'Your account does not have access. Contact an administrator.',
      default: 'Unable to sign in right now. Please try again or reach out to support.',
    }
    setGlobalError(friendly[code] || friendly.default)
  }, [searchParams])

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

  const validateForm = () => {
    let valid = true
    const newErrors = { emailOrUsername: '', password: '' }

    if (!formData.emailOrUsername.trim()) {
      newErrors.emailOrUsername = 'Email or username is required'
      valid = false
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
      valid = false
    }

    setErrors(newErrors)
    return valid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    if (globalError) setGlobalError('')
    setIsLoading(true)

    // Use NextAuth client signIn to handle errors in UI (no hard redirects)
    ;(async () => {
      try {
        const res = await signIn('credentials', {
          redirect: false,
          emailOrUsername: formData.emailOrUsername,
          password: formData.password,
          callbackUrl,
        })

        if (res && res.ok) {
          router.push(res.url || callbackUrl)
          return
        }

        const err = (res && (res.error || '')) || 'Invalid credentials'
        const friendly: Record<string, string> = {
          CredentialsSignin: 'Invalid email or password. Please try again.',
        }
        if (err in friendly) setGlobalError(friendly[err])
        else if (/Too many sign-in attempts/i.test(err)) setGlobalError('Too many sign-in attempts. Please try again later.')
        else setGlobalError('Invalid email or password. Please try again.')
      } catch (e) {
        setGlobalError('Unable to sign in right now. Please try again.')
      } finally {
        setIsLoading(false)
      }
    })()
  }

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="gradient-orb gradient-orb-1"></div>
        <div className="gradient-orb gradient-orb-2"></div>
        <div className="gradient-orb gradient-orb-3"></div>
      </div>

      <div className="login-card-wrapper">
        <form
          method="post"
          action="/api/auth/callback/credentials"
          className="login-card"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

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
            <p className="login-subtitle">Sign in to your account to launch connected apps</p>
          </div>

          {globalError && (
            <div className="form-global-error" role="alert">
              {globalError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="emailOrUsername" className="form-label">
              Email or Username
            </label>
            <div className="input-wrapper">
              <input
                id="emailOrUsername"
                name="emailOrUsername"
                type="text"
                placeholder="you@example.com"
                className={`form-input ${errors.emailOrUsername ? 'input-error' : ''}`}
                value={formData.emailOrUsername}
                onChange={(e) => {
                  setFormData({ ...formData, emailOrUsername: e.target.value })
                  if (errors.emailOrUsername) setErrors({ ...errors, emailOrUsername: '' })
                }}
                aria-label="Email or Username"
                aria-invalid={!!errors.emailOrUsername}
                aria-describedby={errors.emailOrUsername ? 'email-error' : undefined}
              />
              <div className="input-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 10C12.7614 10 15 7.76142 15 5C15 2.23858 12.7614 0 10 0C7.23858 0 5 2.23858 5 5C5 7.76142 7.23858 10 10 10Z" fill="currentColor" opacity="0.3"/>
                  <path d="M10 12C5.58172 12 2 15.5817 2 20H18C18 15.5817 14.4183 12 10 12Z" fill="currentColor" opacity="0.3"/>
                </svg>
              </div>
            </div>
            {errors.emailOrUsername && (
              <span id="email-error" className="form-error">{errors.emailOrUsername}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value })
                  if (errors.password) setErrors({ ...errors, password: '' })
                }}
                aria-label="Password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="toggle-password"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(s => !s)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
              <div className="input-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="8" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
                  <path d="M7 8V6C7 3.79086 8.79086 2 11 2H11C13.2091 2 15 3.79086 15 6V8" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
                  <circle cx="10" cy="13" r="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </div>
            </div>
            {errors.password && (
              <span id="password-error" className="form-error">{errors.password}</span>
            )}
          </div>

          <div className="form-footer">
            <label className="remember-me">
              <input type="checkbox" name="remember" className="checkbox" />
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-link">Forgot password?</a>
          </div>

          <button
            disabled={!csrfToken || isLoading}
            type="submit"
            className="submit-button"
          >
            <span className="button-content">
              {isLoading ? (
                <>
                  <svg className="spinner" width="20" height="20" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="50.27" strokeDashoffset="0" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                  Signing in...
                </>
              ) : csrfToken ? (
                'Sign In'
              ) : (
                'Loading...'
              )}
            </span>
          </button>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <div className="social-buttons">
            <button type="button" className="social-button" aria-label="Sign in with Google">
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path d="M19.8 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.5c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4"/>
                <path d="M10 20c2.7 0 5-1 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H1.1v2.6C2.7 17.8 6.1 20 10 20z" fill="#34A853"/>
                <path d="M4.4 12c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V5.4H1.1C.4 6.8 0 8.3 0 10s.4 3.2 1.1 4.6l3.3-2.6z" fill="#FBBC04"/>
                <path d="M10 4c1.5 0 2.8.5 3.8 1.5l2.9-2.9C15 1 12.7 0 10 0 6.1 0 2.7 2.2 1.1 5.4l3.3 2.6C5.2 5.8 7.4 4 10 4z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button type="button" className="social-button" aria-label="Sign in with GitHub">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 0C4.48 0 0 4.48 0 10c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.57 9.57 0 0110 4.84c.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.02 10.02 0 0020 10c0-5.52-4.48-10-10-10z"/>
              </svg>
              GitHub
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
