import { useEffect, useState } from 'react'
import { VisitsAPI } from '../api'
import { RequireAuth } from './auth'

export default function VisitDetail({ visitId }){
  return (
    <RequireAuth>
      <_Inner visitId={visitId} />
    </RequireAuth>
  )
}

function _Inner({ visitId }){
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logForm, setLogForm] = useState({ equipment_id: '', description: '', hours_worked: '' })
  const [summary, setSummary] = useState('')
  const [checklist, setChecklist] = useState({ sjekk_advarselskilt: false, sjekk_agnstasjoner: false, sjekk_inngangspunkter: false, sjekk_fellefangst: false })

  const load = async () => {
    setLoading(true)
    try{
      const d = await VisitsAPI.detail(visitId)
      setData(d)
      setSummary(d?.visit?.oppsummering_notat || '')
      setChecklist({
        sjekk_advarselskilt: !!d?.visit?.sjekk_advarselskilt,
        sjekk_agnstasjoner: !!d?.visit?.sjekk_agnstasjoner,
        sjekk_inngangspunkter: !!d?.visit?.sjekk_inngangspunkter,
        sjekk_fellefangst: !!d?.visit?.sjekk_fellefangst,
      })
    } finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [visitId])

  if (loading) return <div>Laster besøk…</div>
  if (!data) return <div>Ikke funnet.</div>

  const v = data.visit
  const canStart = v.status === 'Planlagt' || !v.status
  const canComplete = v.status === 'Pågående'

  const addLog = async (e) => {
    e.preventDefault()
    const payload = {
      equipment_id: Number(logForm.equipment_id),
      description: logForm.description,
      hours_worked: logForm.hours_worked ? Number(logForm.hours_worked) : undefined,
    }
    await VisitsAPI.logs.create(visitId, payload)
    setLogForm({ equipment_id: '', description: '', hours_worked: '' })
    await load()
  }

  const start = async () => {
    await VisitsAPI.start(visitId)
    await load()
  }

  const complete = async () => {
    await VisitsAPI.complete(visitId, { summary, checklist })
    await load()
  }

  return (
    <div className="stack" style={{gap:16}}>
      <div className="card">
        <h3>Besøksdetalj</h3>
        <div>Besøk #{v.id} — {new Date(v.visit_date).toLocaleString()}</div>
        <div>Status: {v.status || 'Planlagt'}</div>
        {canStart && <button className="btn primary" onClick={start} style={{marginTop:8}}>Start</button>}
      </div>

      <div className="card">
        <h4>Utstyr hos kunde</h4>
        <ul>
          {data.equipment.map(e => (
            <li key={e.id}>
              <input type="checkbox" readOnly checked={!!e.checked} /> {e.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h4>Legg til logg</h4>
        <form onSubmit={addLog} className="stack" style={{gap:8}}>
          <select className="input" value={logForm.equipment_id} onChange={e=> setLogForm(f=>({...f, equipment_id: e.target.value}))} required>
            <option value="">Velg utstyr</option>
            {data.equipment.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <textarea className="input" placeholder="Beskrivelse" value={logForm.description} onChange={e=> setLogForm(f=>({...f, description: e.target.value}))} required />
          <input className="input" type="number" min="0" step="0.25" placeholder="Timer brukt (valgfritt)" value={logForm.hours_worked} onChange={e=> setLogForm(f=>({...f, hours_worked: e.target.value}))} />
          <button className="btn" type="submit">Lagre logg</button>
        </form>
      </div>

      <div className="card">
        <h4>Oppsummering og sjekkliste</h4>
        <textarea className="input" placeholder="Oppsummering" value={summary} onChange={e=> setSummary(e.target.value)} />
        <div className="list" style={{marginTop:8}}>
          {Object.keys(checklist).map(k => (
            <label key={k} className="list-item" style={{gap:8}}>
              <input type="checkbox" checked={!!checklist[k]} onChange={e=> setChecklist(c=> ({...c, [k]: e.target.checked}))} />
              <span>{niceName(k)}</span>
            </label>
          ))}
        </div>
        {canComplete && <button className="btn success" onClick={complete} style={{marginTop:8}}>Fullfør besøk</button>}
      </div>

      <div className="card">
        <h4>Logger</h4>
        {!data.logs?.length ? <div>Ingen logger ennå.</div> : (
          <ul>
            {data.logs.map(l => (
              <li key={l.id}>{new Date(l.log_date || v.visit_date).toLocaleString()} — {l.description} {l.hours_worked ? `(${l.hours_worked}t)` : ''}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function niceName(key){
  const map = {
    sjekk_advarselskilt: 'Advarselskilt',
    sjekk_agnstasjoner: 'Agnstasjoner',
    sjekk_inngangspunkter: 'Inngangspunkter',
    sjekk_fellefangst: 'Fellefangst',
  }
  return map[key] || key
}
