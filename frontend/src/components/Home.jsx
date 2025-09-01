import { useEffect, useMemo, useState } from 'react'
import { RequireAuth } from './auth'
import { useAuth } from './hooks/useAuth'
import { VisitsAPI } from '../api'
import PageHeader from './ui/PageHeader'
import Button from './ui/Button'
import { IconRefresh } from './ui/icons'

export default function Home(){
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner(){
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try{
      const data = await VisitsAPI.myMissions()
      setItems(Array.isArray(data) ? data : [])
    } finally{
      setLoading(false)
    }
  }
  useEffect(()=>{ load() }, [])

  const nextVisit = useMemo(() => {
    if (!items.length) return null
    const now = Date.now()
    const planned = items.filter(v => (v.status === 'Planlagt' || !v.status))
    if (!planned.length) return null
    // Velg nærmeste i tid (>= nå), ellers tidligste
    const sorted = planned.slice().sort((a,b) => new Date(a.visit_date) - new Date(b.visit_date))
    const upcoming = sorted.find(v => new Date(v.visit_date).getTime() >= now)
    return upcoming || sorted[0]
  }, [items])

  const startVisit = async (id) => {
    try {
      if (!id) return
      await VisitsAPI.start(id)
      window.location.hash = `visit:${id}`
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Kunne ikke starte besøk')
    }
  }

  return (
    <div>
      <PageHeader title="Hjem" actions={<button className="btn btn-icon" onClick={() => load()}><IconRefresh /> Oppdater</button>}>
        <span>Velkommen{user?.name ? `, ${user.name}` : ''}</span>
      </PageHeader>

      <section className="card" style={{padding:16}}>
        <h2 style={{marginTop:0}}>I dag</h2>
        {loading ? (
          <p>Laster dine oppdrag…</p>
        ) : nextVisit ? (
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <div>
              <div style={{fontWeight:600}}>Neste besøk #{nextVisit.id}</div>
              <div>{new Date(nextVisit.visit_date).toLocaleString()}</div>
              {nextVisit.customer_id && (
                <div>
                  Kunde #{nextVisit.customer_id}
                  {nextVisit.customer_name ? <> — <a href={`#customer:${nextVisit.customer_id}`}>{nextVisit.customer_name}</a></> : null}
                </div>
              )}
              <div>Status: {nextVisit.status || 'Planlagt'}</div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <Button onClick={()=> window.location.hash = `visit:${nextVisit.id}`}>Åpne</Button>
              <Button variant="primary" onClick={()=> startVisit(nextVisit.id)}>Start</Button>
            </div>
          </div>
        ) : (
          <p>Ingen planlagte besøk funnet. <a href="#missions">Gå til Mine oppdrag</a>.</p>
        )}
      </section>
    </div>
  )
}
