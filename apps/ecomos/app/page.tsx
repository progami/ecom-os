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
    <div style={{minHeight:'100vh', background:'#020617', color:'#f1f5f9'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderBottom:'1px solid #334155', background:'rgba(30, 41, 59, 0.5)', backdropFilter:'blur(10px)'}}>
        <h1 style={{fontWeight:700, background:'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>ecomOS Portal</h1>
        <div style={{color:'#94a3b8'}}>{session.user?.email}</div>
      </header>
      <main style={{maxWidth:1000, margin:'0 auto', padding:24}}>
        <h2 style={{fontSize:20, fontWeight:700, margin:'16px 0', color:'#f1f5f9'}}>Your Apps</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:16}}>
          {apps.map(app => (
            <a key={app.id} href={resolveAppUrl(app)} style={{display:'block', padding:20, border:'1px solid #334155', background:'rgba(30, 41, 59, 0.3)', borderRadius:12, textDecoration:'none', color:'#f1f5f9', transition:'all 0.2s', boxShadow:'0 0 20px rgba(0,0,0,0.3)'}}>
              <div style={{fontWeight:700, marginBottom:6}}>{app.name}</div>
              <div style={{fontSize:13, color:'#94a3b8'}}>{app.description}</div>
              <div style={{marginTop:12, fontSize:13, color:'#8b5cf6', fontWeight:500}}>Open →</div>
            </a>
          ))}
          {apps.length === 0 && (
            <div style={{padding:20, border:'1px solid #334155', background:'rgba(30, 41, 59, 0.3)', borderRadius:12, color:'#94a3b8'}}>
              No apps assigned to your account. Contact your administrator.
            </div>
          )}
        </div>
        <h3 style={{fontSize:14, color:'#64748b', marginTop:32, textTransform:'uppercase', letterSpacing:'0.5px'}}>Entitlements</h3>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop:12}}>
          {apps.map(app => (
            <span key={app.id} style={{fontSize:13, color:'#94a3b8', padding:'6px 12px', background:'rgba(51, 65, 85, 0.3)', borderRadius:6}}>
              {app.name}: {(roles as any)[app.id]?.role}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
