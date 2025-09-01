import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { AuthAPI } from '../api'

export default function Login(){
  const { user, login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [requiresSetup, setRequiresSetup] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Etter re-mount, sjekk om innlogget bruker må sette passord
    async function check() {
      try {
        const d = await AuthAPI.passwordStatus()
        if (!cancelled && d && d.authenticated) {
          setRequiresSetup(Boolean(d.requiresSetup))
        }
      } catch (_) { /* no-op */ }
    }
    check()
    return () => { cancelled = true }
  }, [])
  if (user) {
    return (
      <div className="card" style={{maxWidth:480, margin:'0 auto'}}>
        <h3>Du er innlogget</h3>
        <p><strong>{user.name || user.email}</strong> ({user.email})</p>
        <div className="list">
          <div className="list-item">Rolle: {user.role || '(ukjent)'}</div>
        </div>
        {requiresSetup && (
          <div className="surface" style={{marginTop:12, padding:12, border:'1px solid var(--border)', borderRadius:8}}>
            <div style={{fontWeight:700, marginBottom:8}}>Sett passord</div>
            <p style={{marginTop:0}}>For ekstra sikkerhet må du velge et passord nå.</p>
            <form onSubmit={async (e)=>{
              e.preventDefault()
              setErr('')
              if (newPass !== newPass2) { setErr('Passordene er ikke like'); return }
              if ((newPass||'').length < 8) { setErr('Passord må være minst 8 tegn'); return }
              try {
                setSaving(true)
                const r = await AuthAPI.setPassword(newPass)
                if (r && r.token) {
                  try { sessionStorage.setItem('bsk:token', r.token) } catch {}
                  try { const { setAuthToken } = await import('../api'); setAuthToken(r.token) } catch {}
                }
                setRequiresSetup(false)
                window.dispatchEvent(new CustomEvent('app:toast', { detail: { variant: 'success', title: 'Passord lagret', description: 'Du kan nå bruke passord ved innlogging.' } }))
              } catch (e) {
                setErr(e?.response?.data?.error || e.message || 'Kunne ikke lagre passord')
              } finally {
                setSaving(false)
              }
            }}>
              <input className="input" type="password" placeholder="Nytt passord (minst 8 tegn)" value={newPass} onChange={e=> setNewPass(e.target.value)} />
              <input className="input" type="password" placeholder="Gjenta nytt passord" value={newPass2} onChange={e=> setNewPass2(e.target.value)} style={{marginTop:8}} />
              {err ? <div className="error" style={{color:'#b00020', marginTop:8}}>{err}</div> : null}
              <button className="btn primary" type="submit" disabled={saving} style={{marginTop:12}}>{saving ? 'Lagrer…' : 'Lagre passord'}</button>
            </form>
          </div>
        )}
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <button className="btn" onClick={()=> {
            const redirect = (()=>{ try { return sessionStorage.getItem('post-login-redirect') || 'customers' } catch { return 'customers' } })()
            window.location.hash = redirect
          }}>Til forsiden</button>
          <button className="btn outline" onClick={async ()=> { await logout(); window.location.hash = 'login' }}>Logg ut</button>
        </div>
      </div>
    )
  }
  return (
    <div className="card" style={{maxWidth:480, margin:'0 auto'}}>
      <h3>Logg inn</h3>
      <p>Skriv inn e-postadressen din for å logge inn.</p>
      <form onSubmit={async (e)=>{ e.preventDefault(); setErr(''); if (email) { try{ await login(email, password); const redirect = (()=>{ try { return sessionStorage.getItem('post-login-redirect') || 'customers' } catch { return 'customers' } })(); window.location.hash = redirect } catch (err){ setErr(err?.response?.data?.error || err.message || 'Innlogging feilet') } } }}>
        <input className="input" type="email" placeholder="epost@firma.no" value={email} onChange={e=> setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Passord" value={password} onChange={e=> setPassword(e.target.value)} style={{marginTop:8}} />
        {err ? <div className="error" style={{color:'#b00020', marginTop:8}}>{err}</div> : null}
        <button className="btn primary" type="submit" style={{marginTop:12}}>Logg inn</button>
      </form>
    </div>
  )
}
