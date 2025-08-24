import { useState } from 'react'
import { useAuth } from './hooks/useAuth'

export default function Login(){
  const { user, login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  if (user) {
    return (
      <div className="card" style={{maxWidth:480, margin:'0 auto'}}>
        <h3>Du er innlogget</h3>
        <p><strong>{user.name || user.email}</strong> ({user.email})</p>
        <div className="list">
          <div className="list-item">Rolle: {user.role || '(ukjent)'}</div>
        </div>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <button className="btn" onClick={()=> { window.location.hash = 'customers' }}>Til forsiden</button>
          <button className="btn outline" onClick={async ()=> { await logout(); window.location.hash = 'login' }}>Logg ut</button>
        </div>
      </div>
    )
  }
  return (
    <div className="card" style={{maxWidth:480, margin:'0 auto'}}>
      <h3>Logg inn</h3>
      <p>Skriv inn e-postadressen din for å logge inn.</p>
      <form onSubmit={async (e)=>{ e.preventDefault(); setErr(''); if (email) { try{ await login(email); window.location.hash = 'customers' } catch (err){ setErr(err.message || 'Innlogging feilet') } } }}>
        <input className="input" type="email" placeholder="epost@firma.no" value={email} onChange={e=> setEmail(e.target.value)} required />
        {err ? <div className="error" style={{color:'#b00020', marginTop:8}}>{err}</div> : null}
        <button className="btn primary" type="submit" style={{marginTop:12}}>Logg inn</button>
      </form>
    </div>
  )
}
