'use client'

import type { ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'

import type { AppDef } from '@/lib/apps'

import styles from './portal.module.css'

type PortalRoleMap = Record<string, { role: string; depts?: string[] }>

const CATEGORY_ORDER = [
  'Ops',
  'Product',
  'Sales / Marketing',
  'Account / Listing',
  'HR / Admin',
  'Finance',
  'Legal',
]

const OTHER_CATEGORY = 'Other'

const FALLBACK_ICON = (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(0,194,185,0.15)" />
    <path d="M9 9h6v6H9z" fill="#00c2b9" opacity="0.75" />
  </svg>
)

const APP_ICONS: Record<string, ReactNode> = {
  wms: (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M3 9l9-6.5L21 9v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 5 18.5V9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 11.5h6v8.5H9z"
        fill="rgba(0,194,185,0.35)"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  hrms: (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle
        cx="9"
        cy="7"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="rgba(0,194,185,0.25)"
      />
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.1a4 4 0 0 1 0 7.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  ),
  fcc: (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 3v18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M17 6.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M3 12h18"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M12 3a18 18 0 0 1 4.5 9 18 18 0 0 1-4.5 9 18 18 0 0 1-4.5-9A18 18 0 0 1 12 3z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
        fill="none"
      />
    </svg>
  ),
  'x-plan': (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="rgba(0,194,185,0.18)"
      />
      <path
        d="M9 9l6 6m0-6l-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

const getAppIcon = (appId: string): ReactNode => APP_ICONS[appId] ?? FALLBACK_ICON

type PortalClientProps = {
  session: Session
  apps: AppDef[]
  roles?: PortalRoleMap
}

export default function PortalClient({ session, apps, roles }: PortalClientProps) {
  const roleMap = roles ?? {}
  const hasApps = apps.length > 0

  const normalizeCategory = (value?: string | null) => {
    const trimmed = value?.trim()
    return trimmed && trimmed.length > 0 ? trimmed : OTHER_CATEGORY
  }

  const appsByCategory = apps.reduce<Record<string, AppDef[]>>((acc, app) => {
    const assigned = roleMap[app.id]?.depts
    const primaryCategory = normalizeCategory(assigned?.[0] ?? (app as any).category)
    acc[primaryCategory] = acc[primaryCategory]
      ? [...acc[primaryCategory], app]
      : [app]
    return acc
  }, {})

  const orderedCategories = CATEGORY_ORDER.filter((k) => appsByCategory[k]?.length)
    .concat(
      Object.keys(appsByCategory).filter(
        (key) => !CATEGORY_ORDER.includes(key) && appsByCategory[key]?.length
      )
    )

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logo} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                <path
                  d="M12 2 2 7l10 5 10-5-10-5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
                <path
                  d="M2 17l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                />
              </svg>
            </div>
            <span className={styles.brandTitle}>ecomOS Portal</span>
          </div>
          <div className={styles.headerCenter}>Control Center</div>
          <div className={styles.actions}>
            <span>{session.user?.email}</span>
            <button
              type="button"
              className={styles.signOut}
              onClick={() => {
                const origin = typeof window !== 'undefined'
                  ? window.location.origin
                  : process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
                const fallback = origin || '/'
                const callbackUrl = `${fallback.replace(/\/$/, '')}/login`
                void signOut({ callbackUrl })
              }}
            >
              Sign out
            </button>
          </div>
        </header>
      </div>

      <main className={styles.main}>
          <section className={styles.intro}>
            <span className={styles.introSpacer} aria-hidden="true" />
          </section>

          <section aria-label="Available applications" className={styles.categoriesSection}>
            {orderedCategories.map((category) => (
              <div key={category} className={styles.categoryBlock}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryBadge}>{category}</span>
                  <span className={styles.categoryCount}>
                    {appsByCategory[category]?.length ?? 0} apps
                  </span>
                </div>
                <div className={styles.grid}>
                  {appsByCategory[category]?.map((app) => {
                    const isDisabled = app.lifecycle === 'dev'
                    const cardClassName = isDisabled
                      ? `${styles.card} ${styles.cardDisabled}`
                      : styles.card

                    return (
                      <a
                        key={app.id}
                        href={isDisabled ? undefined : app.url}
                        className={cardClassName}
                        aria-disabled={isDisabled}
                        tabIndex={isDisabled ? -1 : undefined}
                      >
                        <div className={styles.iconWrap}>
                          <div className={styles.iconBox}>{getAppIcon(app.id)}</div>
                          <svg className={styles.arrow} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                            <path
                              d="M8 5h6.59L7.3 12.29A1 1 0 0 0 8.7 13.7L16 6.41V13a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1H8a1 1 0 0 0 0 2Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        {isDisabled && <span className={styles.lifecycleBadge}>In development</span>}
                        <div className={styles.name}>{app.name}</div>
                        <p className={styles.description}>{app.description}</p>
                      </a>
                    )
                  })}
                </div>
              </div>
            ))}

            {!hasApps && (
              <div className={styles.empty}>
                <h2 className={styles.emptyTitle}>No applications assigned</h2>
                <p>We could not find any entitlements linked to your account. Reach out to an administrator.</p>
              </div>
            )}
          </section>

          {hasApps && (
            <section aria-label="Current access summary" className={styles.rolesSection}>
              <h2 className={styles.rolesHeading}>Access summary</h2>
              <ul className={styles.rolesList}>
                {apps.map((app) => {
                  const role = roleMap[app.id]?.role
                  return (
                    <li key={app.id}>
                      {app.name}
                      {role ? `: ${role}` : ''}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
      </main>
    </div>
  )
}
