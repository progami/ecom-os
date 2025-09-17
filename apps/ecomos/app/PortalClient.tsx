'use client'

import './portal.css'

export default function PortalClient({ session, apps, roles }: any) {
  // Icon mapping for different apps
  const getAppIcon = (appId: string) => {
    switch(appId) {
      case 'wms':
        return (
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22V12h6v10M8 12H5m14 0h-3m-7-7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="9" y="14" width="6" height="3" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        )
      case 'hrms':
        return (
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'fcc':
        return (
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
          </svg>
        )
      case 'website':
        return (
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      default:
        return (
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 9h6v6H9z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        )
    }
  }

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
          <h2 className="welcome-title">Control Center</h2>
          <p className="welcome-subtitle">Manage your business operations from one unified platform</p>
        </div>

        <div className="apps-grid">
          {apps.map((app: any) => (
            <a key={app.id} href={app.url} className="app-card">
              <div className="app-card-glow"></div>
              <div className="app-card-header">
                <div className="app-icon">
                  {getAppIcon(app.id)}
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
                <div className="role-chip">
                  <span className="role-label">Role:</span>
                  <span className="role-value">{(roles as any)[app.id]?.role}</span>
                </div>
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
      </main>

      {apps.length > 0 && (
        <footer className="portal-footer">
          <div className="footer-content">
            <h3 className="footer-title">Your Access Privileges</h3>
            <div className="access-grid">
              {apps.map((app: any) => (
                <div key={app.id} className="access-item">
                  <div className="access-icon">{getAppIcon(app.id)}</div>
                  <div className="access-details">
                    <span className="access-app">{app.name}</span>
                    <span className="access-role">{(roles as any)[app.id]?.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}