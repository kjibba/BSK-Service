import { useEffect, useState, useContext } from 'react'
import { AuthAPI } from '../api'
import { AuthCtx } from './authContext'

export function AuthProvider({ children }){
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AuthAPI.whoami().then(d => {
      if (d.authenticated) setUser(d.user)
    }).finally(() => setReady(true))
  }, [])

  const login = async (email, password) => {
    const d = await AuthAPI.login(email, password)
    // Prefer server's user info if role included; otherwise fetch whoami to populate role
    if (d && d.user && typeof d.user === 'object' && 'role' in d.user) {
      setUser(d.user)
    } else {
      const w = await AuthAPI.whoami()
      if (w && w.authenticated) setUser(w.user)
      else setUser(d.user)
    }
  }
  const logout = async () => {
    try { await AuthAPI.logout() } catch (e) { console.debug(e) }
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function RequireAuth({ children }){
  // Use the context directly here to avoid circular imports
  const { user, ready, login } = useContext(AuthCtx) || { user: null, ready: false, login: async () => {} }
  const [email, setEmail] = useState('')
  if (!ready) return <div>Laster…</div>
  if (!user) {
    return (
      <div className="card" style={{maxWidth:420, margin:'0 auto'}}>
        <h3>Logg inn</h3>
        <p>Skriv inn din e-post for å starte.</p>
        <form onSubmit={(_e)=>{_e.preventDefault(); login(email)}}>
          <input className="input" type="email" placeholder="epost@firma.no" value={email} onChange={e=>setEmail(e.target.value)} required />
          <button className="btn primary" type="submit" style={{marginTop:12}}>Logg inn</button>
        </form>
      </div>
    )
  }
  return children
}
