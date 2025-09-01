import { useEffect, useState } from 'react'
import { ReportsAPI, api } from '../api'
import Card from './ui/Card'
import { Empty, Loading } from './ui/States'
import PageHeader from './ui/PageHeader'
import { IconRefresh } from './ui/icons'

export default function ReportsAdmin(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsErr, setLogsErr] = useState('')
  const load = async () => {
    setLoading(true)
    try { setItems(await ReportsAPI.listAll()) } finally { setLoading(false) }
  }
  const loadLogs = async () => {
    setLogsLoading(true); setLogsErr('')
    try {
      const r = await api.get('/meta/client-log', { params: { limit: 200 } })
      setLogs(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setLogsErr(e?.response?.data?.error || e.message || 'Kunne ikke hente klientlogger')
    } finally {
      setLogsLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  if (loading) return <Loading>Laster rapporter…</Loading>
  return (
    <div className="stack" style={{gap:16}}>
      <Card title="Servicerapporter (PDF)">
        <PageHeader
          title={<h2 style={{margin:0}}>Servicerapporter (PDF)</h2>}
          actions={<a className="btn btn-icon" href="#reports" onClick={(e)=>{ e.preventDefault(); load() }}><IconRefresh /> Oppdater</a>}
        />
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
      <Card title="Klientfeil (siste)">
        <PageHeader
          title={<h2 style={{margin:0}}>Klientfeil (siste)</h2>}
          actions={<>
            <button className="btn" onClick={(e)=>{ e.preventDefault(); loadLogs() }}><IconRefresh /> Oppdater</button>
          </>}
        />
        {logsLoading ? <Loading>Laster klientlogger…</Loading> : logsErr ? (
          <div className="card" style={{color:'#b91c1c'}}>{logsErr}</div>
        ) : !logs.length ? (
          <Empty>Ingen klientfeil logget enda. Trykk Oppdater for å hente.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tid</th>
                  <th>Nivå</th>
                  <th>Melding</th>
                  <th>Rute</th>
                  <th>User</th>
                  <th>UA</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{whiteSpace:'nowrap'}}>{l.createdAt || l.created_at ? new Date(l.createdAt || l.created_at).toLocaleString() : ''}</td>
                    <td>{l.level}</td>
                    <td style={{maxWidth:420, overflow:'hidden', textOverflow:'ellipsis'}} title={l.stack || ''}>{l.message}</td>
                    <td>{l.route}</td>
                    <td>{l.userId || ''}</td>
                    <td style={{maxWidth:260, overflow:'hidden', textOverflow:'ellipsis'}} title={l.userAgent}>{l.userAgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
