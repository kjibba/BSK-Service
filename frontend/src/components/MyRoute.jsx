import { useEffect, useMemo, useRef, useState } from 'react'
import { RouteChoicesAPI, VisitsAPI } from '../api'
import { RequireAuth } from './auth'
import Button from './ui/Button'
import { IconRefresh } from './ui/icons'
import PageHeader from './ui/PageHeader'
import Card from './ui/Card'
import { Loading, Empty } from './ui/States'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MyRoute(){
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const mapRef = useRef(null)
  const groupRef = useRef(null)
  const mapEl = useRef(null)

  const load = async () => {
    setLoading(true)
    try { setItems(await RouteChoicesAPI.myToday()) } finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  useEffect(() => {
    if (mapRef.current || !mapEl.current) return
    const map = L.map(mapEl.current, { center: [60.39299, 5.32415], zoom: 11 })
    groupRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
  }, [])

  useEffect(() => {
    const map = mapRef.current; const group = groupRef.current
    if (!map || !group) return
    group.clearLayers()
    const toFit = []
    items.forEach(it => {
      const c = it.customer || {}
      if (c.latitude && c.longitude){
        const m = L.marker([c.latitude, c.longitude])
        m.bindPopup(`<div><strong>${c.name||'Kunde'}</strong><div>${c.address||''}</div><div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end"><a href="#customer:${c.id}">Åpne kundekort</a></div></div>`)
        m.addTo(group)
        toFit.push([c.latitude, c.longitude])
      }
    })
    try { if (toFit.length === 1) map.setView(toFit[0], 15); else if (toFit.length > 1) map.fitBounds(L.latLngBounds(toFit), { padding: [12,12] }) } catch {}
  }, [items])

  const startOrContinue = async (customerId) => {
    try {
      const created = await fetch('/api/visits/start_or_create_by_customer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId }) }).then(r => r.json())
      if (created && created.id) location.hash = `visit:${created.id}`
      else alert('Kunne ikke starte/fortsette besøk')
    } catch (e) { alert('Kunne ikke starte/fortsette besøk') }
  }

  if (loading) return <Loading>Laster dagsrute…</Loading>
  if (!items.length) return <Empty>Ingen kunder i dagsruten i dag.</Empty>

  return (
    <div className="stack" style={{ gap: 16 }}>
  <PageHeader title="Min dagsrute" actions={(<Button className="btn-icon" onClick={load}><IconRefresh /> Oppdater</Button>)} />
      <div className="layout-columns">
        <div className="col">
          <Card>
            <div style={{height: 380}} ref={mapEl} />
          </Card>
        </div>
        <div className="col">
          <Card>
            <ul className="list">
              {items.map(it => (
                <li key={it.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                  <div>
                    <div style={{fontWeight:600}}>{it.customer?.name || `Kunde #${it.customer_id}`}</div>
                    <div style={{fontSize:12, color:'#475569'}}>{[it.customer?.address, [it.customer?.postal_code, it.customer?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <Button size="sm" onClick={()=> startOrContinue(it.customer_id)}>Start/Fortsett</Button>
                    <Button size="sm" variant="ghost" onClick={async ()=> { await RouteChoicesAPI.remove(it.id); await load() }}>Fjern</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
