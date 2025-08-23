import { useEffect, useState } from 'react'
import { EmployeesAPI } from '../api'
import { RequireAuth, useAuth } from './auth'

export default function Employees(){
  return (
    <RequireAuth>
      <_Inner />
    </RequireAuth>
  )
}

function _Inner(){
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const load = async ()=>{
    setLoading(true)
    setError(null)
    try{
      const data = await EmployeesAPI.list()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e?.response?.status ? `Feil ${e.response.status}` : 'Kunne ikke laste ansatte')
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])

  if (!isManager) return <div>Kun leder kan endre roller.</div>
  if (loading) return <div>Laster ansatte…</div>
  if (error) return (
    <div className="card" style={{maxWidth:600}}>
      <h3>Ansatte</h3>
      <p style={{color:'#b91c1c'}}>Kunne ikke laste ansatte ({error}). Er du innlogget som leder?</p>
      <div style={{display:'flex', gap:8}}>
        <button className="btn" onClick={load}>Prøv igjen</button>
      </div>
    </div>
  )

  const updateRole = async (id, role) => {
    await EmployeesAPI.update(id, { role })
    await load()
  }

  return (
    <div className="card">
      <h3>Ansatte</h3>
      <p style={{marginTop:0, color:'#64748b'}}>Fant {items.length} ansatte.</p>
      <ul className="list">
        {items.map(e => (
          <li key={e.id} style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{flex:1}}>
              <div><strong>{e.name || e.email}</strong></div>
              <div style={{opacity:.7}}>{e.email}</div>
            </div>
            <select className="input" value={e.role || ''} onChange={ev=> updateRole(e.id, ev.target.value)}>
              <option value="">(ingen rolle)</option>
              <option value="technician">Tekniker</option>
              <option value="manager">Leder</option>
            </select>
          </li>
        ))}
        {items.length === 0 && (
          <li style={{opacity:.7}}>Ingen ansatte å vise.</li>
        )}
      </ul>
    </div>
  )
}
