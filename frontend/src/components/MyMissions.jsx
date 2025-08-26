import { useEffect, useMemo, useState } from 'react'
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
  const [selected, setSelected] = useState([])
  const [statusFilter, setStatusFilter] = useState('') // '' | 'Planlagt' | 'Pågående'
  const [groupBy, setGroupBy] = useState('') // '' | 'customer' | 'date'
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
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

  // Parse EU date like 'DD.MM.YYYY' optionally with ' HH:MM'
  const parseEuDate = (s) => {
    try {
      if (!s || typeof s !== 'string') return NaN
      const [dmy, hm] = s.split(' ')
      const [dd, mm, yyyy] = dmy.split('.').map(x => Number(x))
      if (!dd || !mm || !yyyy) return NaN
      const [hh, mi] = (hm || '').split(':').map(x => Number(x))
      const dt = new Date(yyyy, (mm - 1), dd, hh || 0, mi || 0)
      return dt.getTime()
    } catch { return NaN }
  }

  const itemsFilteredSorted = useMemo(() => {
    const base = statusFilter ? items.filter(v => (v.status || '') === statusFilter) : items.slice()
    base.sort((a, b) => {
      const ta = parseEuDate(a.visit_date)
      const tb = parseEuDate(b.visit_date)
      return (sortOrder === 'asc' ? (ta - tb) : (tb - ta))
    })
    return base
  }, [items, statusFilter, sortOrder])

  const plannedIds = useMemo(() => itemsFilteredSorted.filter(v => (v.status||'') === 'Planlagt').map(v => v.id), [itemsFilteredSorted])
  const allChecked = plannedIds.length>0 && plannedIds.every(id => selected.includes(id))

  const batchDelete = async () => {
    if (!selected.length) return
    if (!window.confirm(`Slette ${selected.length} planlagte oppdrag?`)) return
    await VisitsAPI.batchDelete(selected)
    setSelected([])
    await load()
  }

  const grouped = useMemo(() => {
    if (!groupBy) return []
    const map = new Map()
    for (const v of itemsFilteredSorted) {
      const key = groupBy === 'customer' ? (v.customer_name || `Kunde #${v.customer_id || ''}`) : (v.visit_date || '')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(v)
    }
    return Array.from(map.entries()).map(([key, arr]) => ({ key, label: key, items: arr }))
  }, [itemsFilteredSorted, groupBy])

  if (loading) return <Loading>Laster oppdrag…</Loading>
  if (!items.length) return <Empty>Ingen oppdrag.</Empty>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12, marginBottom:8, flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <label style={{fontSize:12, color:'#475569'}}>Status:</label>
          <select className="input" value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value)}>
            <option value="">Alle</option>
            <option value="Planlagt">Planlagt</option>
            <option value="Pågående">Pågående</option>
          </select>
          <label style={{fontSize:12, color:'#475569', marginLeft:8}}>Grupper:</label>
          <select className="input" value={groupBy} onChange={(e)=> setGroupBy(e.target.value)}>
            <option value="">Ingen</option>
            <option value="customer">Kunde</option>
            <option value="date">Dato</option>
          </select>
          <label style={{fontSize:12, color:'#475569', marginLeft:8}}>Sorter:</label>
          <select className="input" value={sortOrder} onChange={(e)=> setSortOrder(e.target.value)}>
            <option value="asc">Eldst først</option>
            <option value="desc">Nyest først</option>
          </select>
        </div>
        {isManager && (
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <label style={{display:'flex',alignItems:'center',gap:6, fontSize:13}}>
            <input type="checkbox" checked={allChecked} onChange={(e)=> setSelected(e.target.checked ? plannedIds : [])} />
            <span>Velg alle planlagte</span>
          </label>
          <Button size="sm" variant="danger" disabled={!selected.length} onClick={batchDelete}>Slett valgte</Button>
        </div>) }
      </div>
      {!groupBy ? (
      <div className="list missions-list">
      {itemsFilteredSorted.map(v => {
        const st = (v.status || 'Planlagt')
        const statusClass = st === 'Pågående' ? 'status-ongoing' : (st === 'Planlagt' ? 'status-planned' : 'status-other')
        return (
        <div key={v.id} className={`list-item mission ${statusClass}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {isManager && (v.status === 'Planlagt' || !v.status) ? (
              <input type="checkbox" checked={selected.includes(v.id)} onChange={(e)=> setSelected(prev => e.target.checked ? Array.from(new Set([...prev, v.id])) : prev.filter(x => x !== v.id))} aria-label="Velg oppdrag" />
            ) : <div style={{width:16}} />}
            <div>
              <div style={{fontWeight:600}}>{v.customer_name || `Kunde #${v.customer_id || ''}`}</div>
              <div style={{fontSize:12, color:'#475569'}}>
                {v.visit_date} — {v.status || 'Planlagt'}
                {v.technician || v.assigned_technician_id ? ` — ${v.technician || ('Tekniker #' + v.assigned_technician_id)}` : ''}
              </div>
              {v.customer_address && (
                <div style={{fontSize:12, color:'#64748b'}}>
                  {v.customer_address}{(v.customer_postal_code||v.customer_city) ? `, ${[v.customer_postal_code, v.customer_city].filter(Boolean).join(' ')}` : ''}
                </div>
              )}
            </div>
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
            {isManager && (v.status === 'Planlagt' || !v.status) && (
              <Button variant="danger" onClick={async ()=> { if (!window.confirm('Slette oppdrag?')) return; await VisitsAPI.delete(v.id); await load() }}>Slett</Button>
            )}
          </div>
        </div>
      )})}
      </div>
      ) : (
        <div className="stack" style={{gap:12}}>
          {grouped.map(g => (
            <div key={g.key}>
              <div style={{fontWeight:700, margin:'10px 0 6px'}}>{g.label}</div>
              <div className="list missions-list">
                {g.items.map(v => {
                  const st = (v.status || 'Planlagt')
                  const statusClass = st === 'Pågående' ? 'status-ongoing' : (st === 'Planlagt' ? 'status-planned' : 'status-other')
                  return (
                  <div key={v.id} className={`list-item mission ${statusClass}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      {isManager && (v.status === 'Planlagt' || !v.status) ? (
                        <input type="checkbox" checked={selected.includes(v.id)} onChange={(e)=> setSelected(prev => e.target.checked ? Array.from(new Set([...prev, v.id])) : prev.filter(x => x !== v.id))} aria-label="Velg oppdrag" />
                      ) : <div style={{width:16}} />}
                      <div>
                        <div style={{fontWeight:600}}>{v.customer_name || `Kunde #${v.customer_id || ''}`}</div>
                        <div style={{fontSize:12, color:'#475569'}}>
                          {v.visit_date} — {v.status || 'Planlagt'}
                          {v.technician || v.assigned_technician_id ? ` — ${v.technician || ('Tekniker #' + v.assigned_technician_id)}` : ''}
                        </div>
                        {v.customer_address && (
                          <div style={{fontSize:12, color:'#64748b'}}>
                            {v.customer_address}{(v.customer_postal_code||v.customer_city) ? `, ${[v.customer_postal_code, v.customer_city].filter(Boolean).join(' ')}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <Button onClick={()=> window.location.hash = `visit:${v.id}`}>Åpne</Button>
                      {(v.status === 'Planlagt' || !v.status) && (
                        <Button variant="primary" onClick={()=> startVisit(v.id)}>Start</Button>
                      )}
                      {isManager && (v.status === 'Planlagt' || !v.status) && (
                        <Button variant="danger" onClick={async ()=> { if (!window.confirm('Slette oppdrag?')) return; await VisitsAPI.delete(v.id); await load() }}>Slett</Button>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
