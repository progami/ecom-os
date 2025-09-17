'use client'

import './portal.css'

export default function PortalClient({ session, apps, roles }: any) {
  return (
    <div className="portal-container">
      <header className="portal-header">
        <div className="header-brand">
          <div className="logo-box">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="portal-title">ecomOS Portal</h1>
        </div>
        <div className="header-actions">
          <div className="user-email">{session.user?.email}</div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="signout-btn">Sign Out</button>
          </form>
        </div>
      </header>

      <main className="portal-main">
        <div className="welcome-section">
          <h2 className="welcome-title">Welcome back</h2>
          <p className="welcome-subtitle">Select an application to get started</p>
        </div>

        <div className="apps-grid">
          {apps.map((app: any) => (
            <a key={app.id} href={app.url} className="app-card">
              <div className="app-card-header">
                <div className="app-icon">
                  <svg className="icon-svg" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <svg className="arrow-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="app-card-body">
                <div className="app-name">{app.name}</div>
                <div className="app-description">{app.description}</div>
              </div>
              <div className="app-card-footer">
                <div className="role-label">Your Role</div>
                <div className="role-value">{(roles as any)[app.id]?.role}</div>
              </div>
            </a>
          ))}

          {apps.length === 0 && (
            <div className="empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 className="empty-title">No Applications Available</h3>
              <p className="empty-text">You don't have access to any applications yet. Please contact your system administrator for access.</p>
            </div>
          )}
        </div>

        {apps.length > 0 && (
          <div className="access-summary">
            <h3 className="summary-title">Access Summary</h3>
            <div className="summary-badges">
              {apps.map((app: any) => (
                <div key={app.id} className="access-badge">
                  <div className="badge-dot"></div>
                  <span className="badge-app">{app.name}</span>
                  <span className="badge-separator">•</span>
                  <span className="badge-role">{(roles as any)[app.id]?.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}