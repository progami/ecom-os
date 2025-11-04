import Link from 'next/link'
import { type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSafeServerSession } from '@/lib/safe-session'
import { LogoutForm } from './logout-form'
import '../login/login.css'
import './logout.css'

type LogoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function normalizeCallbackUrl(raw?: string | string[]): string {
  if (!raw) return '/'
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return '/'
  return value.startsWith('/') ? value : '/'
}

function getAvatarInitial(session: Session | null): string {
  const source = session?.user?.name || session?.user?.email || ''
  const letter = source.trim().charAt(0)
  return letter ? letter.toUpperCase() : 'U'
}

export default async function LogoutPage({ searchParams }: LogoutPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined
  const session = await getSafeServerSession(authOptions)
  const callbackUrl = normalizeCallbackUrl(resolvedParams?.callbackUrl)
  const signedIn = Boolean(session)
  const userName = session?.user?.name
  const userEmail = session?.user?.email

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
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h1 className="login-title">ecomOS Portal</h1>
            <p className="login-headline">{signedIn ? 'Ready to sign out?' : 'You are already signed out'}</p>
            <p className="login-subtitle">
              {signedIn
                ? 'Your session will end and you will need to sign in with Google again to access the portal.'
                : 'Sign back in to continue using the portal.'}
            </p>
          </div>

          {signedIn && (
            <div className="logout-summary">
              <div className="logout-avatar">{getAvatarInitial(session)}</div>
              <p className="logout-name">{userName || userEmail || 'Signed in user'}</p>
              {userEmail && <p className="logout-email">{userEmail}</p>}
              <p className="logout-note">
                Signing out clears your ecomOS session across the connected applications.
              </p>
            </div>
          )}

          <div className="logout-actions">
            {signedIn ? (
              <>
                <LogoutForm callbackUrl={callbackUrl} />
                <Link href={callbackUrl} className="logout-cancel-link">
                  Stay signed in
                </Link>
              </>
            ) : (
              <Link href="/login" className="logout-submit-button">
                Return to sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
