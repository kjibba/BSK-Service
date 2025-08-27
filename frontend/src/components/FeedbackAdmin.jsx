import { useEffect, useState } from 'react'
import { FeedbackAPI } from '../api'
import Button from './ui/Button'

export default function FeedbackAdmin(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tail, setTail] = useState(200)
  const [selected, setSelected] = useState(null)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await FeedbackAPI.list(tail)
      setItems(Array.isArray(r) ? r : (r?.items || []))
    } catch (e) {
      console.error(e)
      setItems([])
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  const refresh = () => load()

  const openDetail = async (id) => {
    try {
      const r = await FeedbackAPI.detail(id)
      setSelected(r || null)
    } catch (e) {
      console.error(e)
    }
  }

  const saveUpdate = async () => {
    if (!selected) return
    setUpdating(true)
    try {
      const payload = { status: selected.status, handler_note: selected.handler_note }
      await FeedbackAPI.update(selected.id, payload)
      await load()
      setSelected(null)
    } catch (e) {
      console.error(e)
    } finally { setUpdating(false) }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Feedback (admin)</h2>
        <div style={{display:'flex',gap:8}}>
          <input type="number" value={tail} onChange={e=> setTail(Number(e.target.value || 0))} style={{width:80}} />
          <Button onClick={refresh}>Last på nytt</Button>
        </div>
      </div>
      {loading ? <div>Laster…</div> : (
        <div style={{display:'flex',gap:16}}>
          <ul style={{flex:1}}>
            {(items || []).slice(0, Math.max(0, Number(tail) || 0)).map(it => (
              <li key={it.id} style={{padding:8,borderBottom:'1px solid #eee',cursor:'pointer'}} onClick={() => openDetail(it.id)}>
                <div style={{fontSize:13,fontWeight:600}}>{it.text}</div>
                <div style={{fontSize:12,color:'#666'}}>{it.created_at} — {it.user_email || 'anon'}</div>
              </li>
            ))}
          </ul>
          <div style={{width:480}}>
            {selected ? (
              <div style={{padding:12,border:'1px solid #eee',borderRadius:6}}>
                <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>{selected.text}</div>
                <div style={{fontSize:12,color:'#666',marginBottom:8}}>{selected.created_at} — {selected.user_email || 'anon'}</div>
                <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>Context</div>
                <pre style={{whiteSpace:'pre-wrap',fontSize:12,marginBottom:8}}>{JSON.stringify(selected.context || {}, null, 2)}</pre>
                <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>Diagnostics</div>
                <pre style={{whiteSpace:'pre-wrap',fontSize:12,marginBottom:8}}>{JSON.stringify(selected.diagnostics || {}, null, 2)}</pre>

                <div style={{marginTop:8}}>
                  <label>Status: </label>
                  <select value={selected.status || 'open'} onChange={e => setSelected({...selected, status: e.target.value})}>
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
                <div style={{marginTop:8}}>
                  <label>Handler note:</label>
                  <textarea value={selected.handler_note || ''} onChange={e => setSelected({...selected, handler_note: e.target.value})} style={{width:'100%'}} />
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
                  <Button onClick={() => setSelected(null)}>Lukk</Button>
                  <Button variant="primary" onClick={saveUpdate} disabled={updating}>{updating ? 'Lagrer…' : 'Lagre'}</Button>
                </div>
              </div>
            ) : (
              <div style={{color:'#666'}}>Velg en tilbakemelding for detaljer</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
