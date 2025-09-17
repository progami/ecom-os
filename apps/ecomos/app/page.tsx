import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ALL_APPS, resolveAppUrl } from '@/lib/apps'

export default async function PortalHome() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const roles = (session as any).roles as Record<string, { role: string, depts?: string[] }> | undefined
  const apps = roles ? ALL_APPS.filter(a => roles[a.id]) : []

  return (
    <div style={{minHeight:'100vh', background:'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'24px 32px', borderBottom:'1px solid #e9ecef', background:'white', boxShadow:'0 1px 3px rgba(0, 44, 81, 0.05)'}}>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <div style={{width:40, height:40, background:'linear-gradient(135deg, #00C2B9 0%, #002C51 100%)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <svg style={{width:24, height:24, color:'white'}} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{fontSize:24, fontWeight:700, color:'#002C51', letterSpacing:'-0.5px'}}>ecomOS Portal</h1>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:20}}>
          <div style={{color:'#6F7B8B', fontSize:14}}>{session.user?.email}</div>
          <button style={{padding:'8px 16px', background:'#f8f9fa', border:'1px solid #dee2e6', borderRadius:6, color:'#6F7B8B', fontSize:14, fontWeight:500, cursor:'pointer'}}>Sign Out</button>
        </div>
      </header>
      <main style={{maxWidth:1200, margin:'0 auto', padding:'40px 32px'}}>
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:28, fontWeight:700, color:'#002C51', marginBottom:8}}>Welcome back</h2>
          <p style={{fontSize:16, color:'#6F7B8B'}}>Select an application to get started</p>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:24}}>
          {apps.map(app => (
            <a key={app.id} href={resolveAppUrl(app)} style={{
              display:'block',
              padding:24,
              border:'1px solid #e9ecef',
              background:'white',
              borderRadius:12,
              textDecoration:'none',
              transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow:'0 1px 3px rgba(0, 44, 81, 0.08)',
              position:'relative',
              overflow:'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 44, 81, 0.12)';
              e.currentTarget.style.borderColor = '#00C2B9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 44, 81, 0.08)';
              e.currentTarget.style.borderColor = '#e9ecef';
            }}>
              <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16}}>
                <div style={{width:48, height:48, background:'linear-gradient(135deg, #00C2B9 0%, #002C51 100%)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <svg style={{width:24, height:24, color:'white'}} viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <svg style={{width:20, height:20, color:'#00C2B9'}} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </div>
              <div style={{fontWeight:600, fontSize:18, marginBottom:8, color:'#002C51'}}>{app.name}</div>
              <div style={{fontSize:14, color:'#6F7B8B', lineHeight:1.5}}>{app.description}</div>
              <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid #f1f5f9'}}>
                <div style={{fontSize:12, color:'#6F7B8B', marginBottom:4}}>Your Role</div>
                <div style={{fontSize:14, color:'#002C51', fontWeight:600}}>{(roles as any)[app.id]?.role}</div>
              </div>
            </a>
          ))}
          {apps.length === 0 && (
            <div style={{gridColumn:'1 / -1', padding:48, background:'#f8f9fa', borderRadius:12, textAlign:'center'}}>
              <svg style={{width:64, height:64, color:'#dee2e6', margin:'0 auto 16px'}} viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 style={{fontSize:18, fontWeight:600, color:'#002C51', marginBottom:8}}>No Applications Available</h3>
              <p style={{fontSize:14, color:'#6F7B8B', maxWidth:400, margin:'0 auto'}}>You don't have access to any applications yet. Please contact your system administrator for access.</p>
            </div>
          )}
        </div>
        {apps.length > 0 && (
          <div style={{marginTop:48, padding:24, background:'#f8f9fa', borderRadius:12}}>
            <h3 style={{fontSize:14, color:'#002C51', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600}}>Access Summary</h3>
            <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
              {apps.map(app => (
                <div key={app.id} style={{
                  display:'flex',
                  alignItems:'center',
                  gap:8,
                  padding:'8px 16px',
                  background:'white',
                  border:'1px solid #e9ecef',
                  borderRadius:8
                }}>
                  <div style={{width:8, height:8, background:'#00C2B9', borderRadius:'50%'}}></div>
                  <span style={{fontSize:14, color:'#002C51', fontWeight:500}}>{app.name}</span>
                  <span style={{fontSize:14, color:'#6F7B8B'}}>•</span>
                  <span style={{fontSize:14, color:'#6F7B8B'}}>{(roles as any)[app.id]?.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
