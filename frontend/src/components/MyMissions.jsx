import { useEffect, useState, useRef } from 'react'
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
      <select className="input" value={tid} onChange={e=> setTid(e.target.value)} style={{minWidth:320}}>
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
  const [searchTerm, setSearchTerm] = useState('')
  const searchTimeout = useRef(null)
  const isManager = user?.role === 'manager'

  const load = async (q) => {
    setLoading(true)
    try{
      const params = {}
      if (q && q.trim()) params.q = q.trim()
      const data = await VisitsAPI.myMissions(params)
      // Client-side filter by simple text match over customer_name and id if q present
      let out = data
      if (params.q) {
        const needle = params.q.toLowerCase()
        out = data.filter(v => (
          String(v.id).includes(needle) ||
          (v.customer_name && v.customer_name.toLowerCase().includes(needle)) ||
          (v.customer_address && v.customer_address.toLowerCase().includes(needle))
        ))
      }
      setItems(out)
    } finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])
  useEffect(()=>{ if (isManager) { EmployeesAPI.list().then(setEmps) } }, [isManager])

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current)
    searchTimeout.current = window.setTimeout(() => { load(searchTerm) }, 300)
    return () => { if (searchTimeout.current) window.clearTimeout(searchTimeout.current) }
  }, [searchTerm])

  const startVisit = async (id) => {
    await VisitsAPI.start(id)
    window.location.hash = `visit:${id}`
  }

  if (loading) return <Loading>Laster oppdrag…</Loading>
  if (!items.length) return <Empty>Ingen planlagte besøk.</Empty>

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'8px 0 12px', gap: 12}}>
        <h1 style={{margin:0}}>Mine oppdrag</h1>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <input
            type="search"
            aria-label="Søk oppdrag"
            placeholder="Søk (kunde, adresse eller id)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{padding:'8px 10px', borderRadius:6, border:'1px solid #ccc', width:320}}
          />
          {searchTerm && <button className="btn" onClick={() => setSearchTerm('')}>Tøm</button>}
          <button className="btn" onClick={() => load()}>Oppdater</button>
        </div>
      </div>
      <div className="list">
      {items.map(v => (
        <div key={v.id} className="list-item">
          <div>
            <div><strong>Besøk #{v.id}</strong> — {new Date(v.visit_date).toLocaleString()}</div>
            {v.customer_id ? (
              <div>
                Kunde #{v.customer_id}
                {v.customer_name ? <> — <a href={`#customer:${v.customer_id}`}>{v.customer_name}</a></> : null}
              </div>
            ) : null}
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
    </div>
  )
}
