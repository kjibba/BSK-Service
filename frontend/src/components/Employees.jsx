import { useEffect, useState } from 'react'
import { EmployeesAPI } from '../api'
import Button from './ui/Button'
import { useToast } from './ui/Toast.jsx'
import { RequireAuth } from './auth'

export default function Employees(){
  const toast = useToast()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  async function load(){
    setLoading(true)
    try{
      const list = await EmployeesAPI.list()
      setEmployees(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{
    let active = true
    load()
    return ()=> { active = false }
  }, [])

  const removeEmp = async (id, name) => {
    if (!confirm(`Slette ansatt ${name ? `“${name}”` : ''}? Dette kan ikke angres.`)) return
    try{
      await EmployeesAPI.delete(id)
      toast.push({ variant: 'success', title: 'Slettet' })
      await load()
    } catch (e){
      toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke slette ansatt' })
    }
  }

  return (
    <RequireAuth>
      <div className="employees-page">
        <div className="toolbar">
          <h2>Ansatte</h2>
          <div className="actions">
            <button className="btn" onClick={() => (location.hash = '#employee:new')}>Ny ansatt</button>
          </div>
        </div>

        {loading && <div>Laster ansatte...</div>}

        {!loading && (
          <div className="employee-list">
            {employees.length === 0 && <div style={{opacity:.7}}>Ingen ansatte å vise.</div>}

            {employees.map((e) => (
              <div key={e.id} className="employee-row" style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                <div>
                  <div className="employee-name"><a href={`#employee:${e.id}`}>{e.name}</a></div>
                  <div className="employee-meta" style={{fontSize:12, color:'#666'}}>
                    <span style={{marginRight:12}}>{e.email}</span>
                    <span style={{marginRight:12}}>{e.phone || '—'}</span>
                    <span>{e.role || '—'}</span>
                  </div>
                </div>

                <div className="employee-actions">
                  <button className="btn" onClick={() => location.hash = `#employee:${e.id}`}>Detaljer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  )
}

function EmployeeStats({ id }){
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    EmployeesAPI.stats(id).then(d => { if (active) setStats(d) }).finally(()=> active && setLoading(false))
    return () => { active = false }
  }, [id])
  if (loading) return <div style={{fontSize:12, opacity:.7}}>Henter statistikk…</div>
  if (!stats) return <div style={{fontSize:12, opacity:.7}}>Ingen data</div>
  return (
    <div style={{fontSize:12, textAlign:'right', color:'#64748b'}}>
      <div>Oppdrag tildelt: <strong>{stats.assigned_visits ?? 0}</strong></div>
      <div>Fullført: <strong>{stats.completed_visits ?? 0}</strong></div>
      <div>Timer logget: <strong>{(stats.total_hours_logged ?? 0).toFixed(1)}</strong></div>
      <div>Effektivitet: <strong>{stats.efficiency != null ? Math.round(stats.efficiency * 100) + '%' : '–'}</strong></div>
    </div>
  )
}
