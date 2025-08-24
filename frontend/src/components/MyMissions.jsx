import { useEffect, useState } from 'react'
import { VisitsAPI, EmployeesAPI } from '../api'
import { RequireAuth } from './auth'
import { useAuth } from './hooks/useAuth'
import Button from './ui/Button'
import { Loading, Empty } from './ui/States'

export default function MyMissions(){
  return (
    <RequireAuth>
  <Inner />
    </RequireAuth>
  )
}

function AssignRow({ visit, emps, onAssign }){
  const [tid, setTid] = useState(visit.assigned_technician_id || '')
  return (
    <div style={{display:'flex', gap:8, alignItems:'center', marginTop:6}}>
      <select className="input" value={tid} onChange={e=> setTid(e.target.value)} style={{maxWidth:260}}>
        <option value="">Velg tekniker…</option>
        {emps.map(e => (
          <option key={e.id} value={e.id}>{e.name || e.email}</option>
        ))}
      </select>
      <button className="btn" disabled={!tid} onClick={()=> onAssign(visit.id, Number(tid))}>Tildel</button>
    </div>
  )
}

function Inner(){
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [emps, setEmps] = useState([])
  const isManager = user?.role === 'manager'

  const load = async () => {
    setLoading(true)
    try{
      const data = await VisitsAPI.myMissions()
      setItems(data)
    } finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])
  useEffect(()=>{ if (isManager) { EmployeesAPI.list().then(setEmps) } }, [isManager])

  const startVisit = async (id) => {
    await VisitsAPI.start(id)
    window.location.hash = `visit:${id}`
  }

  if (loading) return <Loading>Laster oppdrag…</Loading>
  if (!items.length) return <Empty>Ingen planlagte besøk.</Empty>

  return (
    <div className="list">
      {items.map(v => (
        <div key={v.id} className="list-item">
          <div>
            <div><strong>Besøk #{v.id}</strong> — {new Date(v.visit_date).toLocaleString()}</div>
            {v.customer_name ? (
              <div>
                <span style={{fontWeight:600}}>{v.customer_name}</span>
                {v.customer_address ? (
                  <span> — {v.customer_address}{v.customer_postal_code || v.customer_city ? `, ${[v.customer_postal_code, v.customer_city].filter(Boolean).join(' ')}` : ''}</span>
                ) : null}
              </div>
            ) : (v.customer_id ? <div>Kunde #{v.customer_id}</div> : null)}
            <div>Status: {v.status || 'Planlagt'}</div>
            {isManager && (
              <AssignRow visit={v} emps={emps} onAssign={async (vid, tid)=>{ await VisitsAPI.assign(vid, tid); await load() }} />
            )}
            {!isManager && (!v.assigned_technician_id || v.assigned_technician_id === null) && (
              <button className="btn" onClick={async ()=>{ await VisitsAPI.assign(v.id, user.id); await load() }}>Tildel meg</button>
            )}
          </div>
          <div style={{display:'flex', gap:8}}>
            <Button onClick={()=> window.location.hash = `visit:${v.id}`}>Åpne</Button>
            {(v.status === 'Planlagt' || !v.status) && (
              <Button variant="primary" onClick={()=> startVisit(v.id)}>Start</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
