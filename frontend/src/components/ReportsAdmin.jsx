import { useEffect, useState } from 'react'
import { ReportsAPI } from '../api'
import Card from './ui/Card'
import { Empty, Loading } from './ui/States'

export default function ReportsAdmin(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try { setItems(await ReportsAPI.listAll()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  if (loading) return <Loading>Laster rapporter…</Loading>
  return (
    <div className="stack" style={{gap:16}}>
      <Card title="Servicerapporter (PDF)">
        {!items?.length ? <Empty>Ingen rapporter generert ennå.</Empty> : (
          <ul className="list">
            {items.map(r => (
              <li key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div>
                  <div style={{ fontWeight:600 }}>Rapport #{r.id} — Besøk #{r.visit_id} — Kunde #{r.customer_id}</div>
                  <div style={{ fontSize:13, color:'#475569' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
                </div>
                <div>
                  <a className="btn" href={r.url || r.file_path} target="_blank" rel="noopener noreferrer">Åpne PDF</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
