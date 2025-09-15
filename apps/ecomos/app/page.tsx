import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ALL_APPS, resolveAppUrl } from '@/lib/apps'

export default async function PortalHome() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return (
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', color:'#fff'}}>
        <div style={{textAlign:'center'}}>
          <h1 style={{fontSize:28, fontWeight:700, marginBottom:12}}>ecomOS Portal</h1>
          <p style={{color:'#cbd5e1'}}>Please sign in to continue</p>
          <div style={{marginTop:16}}>
            <Link href="/login" style={{background:'#10b981', color:'#001015', padding:'10px 16px', borderRadius:8, fontWeight:700}}>Sign in</Link>
          </div>
        </div>
      </div>
    )
  }

  const roles = (session as any).roles as Record<string, { role: string, depts?: string[] }> | undefined
  const apps = roles ? ALL_APPS.filter(a => roles[a.id]) : []

  return (
    <div style={{minHeight:'100vh', background:'#0f172a', color:'#fff'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderBottom:'1px solid #1f2a44'}}>
        <h1 style={{fontWeight:700}}>ecomOS Portal</h1>
        <div style={{opacity:0.9}}>{session.user?.email}</div>
      </header>
      <main style={{maxWidth:1000, margin:'0 auto', padding:24}}>
        <h2 style={{fontSize:20, fontWeight:700, margin:'16px 0'}}>Your Apps</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:16}}>
          {apps.map(app => (
            <a key={app.id} href={resolveAppUrl(app)} style={{display:'block', padding:16, border:'1px solid #1f2a44', background:'#0b1220', borderRadius:12, textDecoration:'none', color:'#e2e8f0'}}>
              <div style={{fontWeight:700, marginBottom:6}}>{app.name}</div>
              <div style={{fontSize:12, color:'#94a3b8'}}>{app.description}</div>
              <div style={{marginTop:12, fontSize:12, color:'#10b981'}}>Open →</div>
            </a>
          ))}
          {apps.length === 0 && (
            <div style={{padding:16, border:'1px solid #1f2a44', background:'#0b1220', borderRadius:12}}>
              No apps assigned to your account. Contact your administrator.
            </div>
          )}
        </div>
        <h3 style={{fontSize:14, color:'#94a3b8', marginTop:24}}>Entitlements</h3>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop:8}}>
          {apps.map(app => (
            <span key={app.id} style={{fontSize:12, color:'#94a3b8'}}>
              {app.name}: {(roles as any)[app.id]?.role}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
