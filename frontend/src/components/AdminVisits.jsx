import { useEffect, useMemo, useState } from 'react'
import { VisitsAPI } from '../api'
import Button from './ui/Button'
import { Loading, Empty, ErrorState } from './ui/States'
import { RequireAuth } from './auth'

export default function AdminVisits(){
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState([])
  const [statusFilter, setStatusFilter] = useState('Planlagt')

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const data = await VisitsAPI.office.list()
      setItems(data)
    } catch (e) {
      setError(e?.message || 'Kunne ikke hente oppdrag')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!statusFilter) return items
    return items.filter(v => (v.status || '') === statusFilter)
  }, [items, statusFilter])

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={load} />

  const allPlannedIds = filtered.filter(v => (v.status||'') === 'Planlagt').map(v => v.id)
  const allChecked = allPlannedIds.length>0 && allPlannedIds.every(id => selected.includes(id))

  const batchDelete = async () => {
    if (!selected.length) return
    if (!window.confirm(`Slette ${selected.length} planlagte oppdrag?`)) return
    try {
      const res = await VisitsAPI.batchDelete(selected)
      alert(`Slettet ${res.deleted_count}. ${res.skipped_ids?.length ? `Hoppet over ${res.skipped_ids.length}.` : ''}`)
      setSelected([])
      await load()
    } catch (e) {
      alert('Kunne ikke slette valgte')
    }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'8px 0 12px',gap:12}}>
        <h1 style={{margin:0}}>Oppdrag (admin)</h1>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <label style={{fontSize:12,color:'#475569'}}>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Alle</option>
            <option value="Planlagt">Planlagt</option>
            <option value="Pågående">Pågående</option>
            <option value="Fullført">Fullført</option>
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6, marginLeft:12, fontSize:13}}>
            <input type="checkbox" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? allPlannedIds : [])} />
            <span>Velg alle planlagte</span>
          </label>
          <Button size="sm" variant="danger" disabled={!selected.length} onClick={batchDelete}>Slett valgte</Button>
        </div>
      </div>
      {!filtered.length ? (
        <Empty>Ingen oppdrag.</Empty>
      ) : (
        <div className="list">
          {filtered.map(v => (
            <div key={v.id} className="list-item" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {(v.status||'') === 'Planlagt' ? (
                  <input type="checkbox" checked={selected.includes(v.id)} onChange={(e)=> setSelected(prev => e.target.checked ? Array.from(new Set([...prev, v.id])) : prev.filter(x => x !== v.id))} />
                ) : <div style={{width:16}} />}
                <div>
                  <div style={{fontWeight:600}}>{v.customer?.name || 'Kunde'} — {v.technician || v.assigned_technician_id ? `(${v.technician || ('Tekniker #' + v.assigned_technician_id)})` : ''}</div>
                  <div style={{fontSize:12, color:'#475569'}}>{v.visit_date ? new Date(v.visit_date).toLocaleString() : '-'} — {v.status || 'Planlagt'}</div>
                </div>
              </div>
              <div style={{whiteSpace:'nowrap',display:'flex',gap:8}}>
                <Button size="sm" onClick={() => window.location.hash = `visit:${v.id}`}>Åpne</Button>
                {(v.status||'') === 'Planlagt' && (
                  <Button size="sm" variant="danger" onClick={async ()=>{ if (!window.confirm('Slette oppdrag?')) return; try{ await VisitsAPI.delete(v.id); await load() } catch { alert('Sletting feilet') }}}>Slett</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
