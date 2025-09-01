import { useEffect, useState } from 'react'
import { EmployeesAPI } from '../api'
import Button from './ui/Button'
import { IconRefresh } from './ui/icons'
import PageHeader from './ui/PageHeader'
import Card from './ui/Card'
import { Loading, ErrorState } from './ui/States'
import { useToast } from './ui/Toast.jsx'
import { RequireAuth } from './auth'
import { useAuth } from './hooks/useAuth'

export default function Employees(){
  return (
    <RequireAuth>
  <Inner />
    </RequireAuth>
  )
}

function Inner(){
  const { user } = useAuth()
  const toast = useToast()
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
  if (loading) return <Loading>Laster ansatte…</Loading>
  if (error) return <ErrorState message={`Kunne ikke laste ansatte (${error}). Er du innlogget som leder?`} onRetry={load} />

  const updateRole = async (id, role) => {
    try{
      await EmployeesAPI.update(id, { role })
      toast.push({ variant: 'success', title: 'Oppdatert', description: 'Rolle endret.' })
      await load()
    } catch (_e) {
      console.debug(_e)
      toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke oppdatere rolle.' })
    }
  }

  return (
    <Card title="Ansatte">
  <PageHeader title={<h2 style={{margin:0}}>Ansatte</h2>} actions={<Button className="btn-icon" onClick={load}><IconRefresh /> Oppdater</Button>} />
      <p style={{margin:'4px 0 8px', color:'#64748b'}}>Fant {items.length} ansatte.</p>
      <ul className="list">
        {items.map(it => (
          <li key={it.id} style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{flex:1}}>
              <div><strong>{it.name || it.email}</strong></div>
              <div style={{opacity:.7}}>{it.email}</div>
            </div>
            <select className="input" value={it.role || ''} onChange={ev=> updateRole(it.id, ev.target.value)}>
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
    </Card>
  )
}
