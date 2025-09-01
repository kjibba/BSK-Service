import { useEffect, useState, useCallback, useRef, useMemo, useContext } from 'react'
import { VisitsAPI, EquipmentTypesAPI, MaterialsAPI, ServiceLogsAPI } from '../api'
import Button from './ui/Button'
import Card from './ui/Card'
import { Loading, Empty } from './ui/States'
import { useToast } from './ui/Toast.jsx'
import { RequireAuth } from './auth'
import { AuthCtx } from './authContext'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.gridlayer.googlemutant'
import FeedbackButton from './FeedbackButton'
import ActionBar from './ui/ActionBar'
import PageHeader from './ui/PageHeader'
import { IconRefresh } from './ui/icons'
import Fab from './ui/Fab'

export default function VisitDetail({ visitId }){
  return (
    <RequireAuth>
  <Inner visitId={visitId} />
    </RequireAuth>
  )
}

function Inner({ visitId }){
  const toast = useToast()
  const { user } = useContext(AuthCtx) || { user: null }
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logForm, setLogForm] = useState({ equipment_id: '', description: '', hours_worked: '' })
  const [summary, setSummary] = useState('')
  const [checklist, setChecklist] = useState({ sjekk_advarselskilt: false, sjekk_agnstasjoner: false, sjekk_inngangspunkter: false, sjekk_fellefangst: false })
  const [signatures, setSignatures] = useState({ customer_signature_url: '', technician_signature_url: '' })
  const fileToDataUrl = async (file) => new Promise((resolve, reject) => { try { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file) } catch (e) { reject(e) } })
  const [types, setTypes] = useState([])
  const [showLogModal, setShowLogModal] = useState(false)
  const [selectedEq, setSelectedEq] = useState(null)
  const [dynamicValues, setDynamicValues] = useState({})
  const [materials, setMaterials] = useState({ poison: [], nonpoison: [] })
  const [editingLog, setEditingLog] = useState(null)
  const [savingLog, setSavingLog] = useState(false)
  const [mapsKeyMissing, setMapsKeyMissing] = useState(false)
  const enableNewUi = (import.meta && import.meta.env && import.meta.env.VITE_ENABLE_NEW_UI) === 'true'
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.matchMedia && window.matchMedia('(max-width: 900px)').matches } catch { return false }
  })
  useEffect(() => {
    try {
      const mq = window.matchMedia('(max-width: 900px)')
      const onChange = () => setIsMobile(mq.matches)
      mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
      return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange) }
    } catch {}
  }, [])

  const extractNote = useCallback((text) => {
    try {
      if (!text) return ''
      const s = String(text)
      const idx = s.lastIndexOf('Notat:')
      if (idx === -1) return ''
      return s.slice(idx + 'Notat:'.length).trim().replace(/^[:\s-]+/, '')
    } catch (_) { return '' }
  }, [])

  const prepareDynamicDefaults = useCallback((eq) => {
    const vals = {}
    try {
      const props = (eq && eq.properties) || {}
      if (props && props.standard_giftaate_id) {
        vals.benyttet_giftaate_id = String(props.standard_giftaate_id)
        const m = (materials.poison||[]).find(x => Number(x.id) === Number(props.standard_giftaate_id))
        if (m && m.standard_amount != null) vals.giftaate_etterfylt = m.standard_amount
      }
      if (props && props.standard_giftfritt_aate_id) {
        vals.benyttet_giftfritt_aate_id = String(props.standard_giftfritt_aate_id)
        const m2 = (materials.nonpoison||[]).find(x => Number(x.id) === Number(props.standard_giftfritt_aate_id))
        if (m2 && m2.standard_amount != null) vals.giftfritt_etterfylt = m2.standard_amount
      }
    } catch (_) {}
    return vals
  }, [materials])

  // map refs
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(null)
  const layerCtrlRef = useRef(null)
  const activeBaseRef = useRef('google_sat')
  const [baseReady, setBaseReady] = useState(false)

  // Show labels for equipment at high zoom levels (mobile-friendly)
  const updateMarkerLabels = useCallback(() => {
    const map = mapRef.current
    const group = markersRef.current
    if (!map || !group) return
    const show = (map.getZoom() || 0) >= 17
    try {
      group.eachLayer(layer => {
        try {
          // Only toggle tooltips for equipment markers
          if (layer && layer._isEq && typeof layer.openTooltip === 'function' && typeof layer.closeTooltip === 'function') {
            if (show) layer.openTooltip(); else layer.closeTooltip()
          }
        } catch (_) {}
      })
    } catch (_) {}
  }, [])

  const load = useCallback(async (opts) => {
    const silent = !!(opts && opts.silent)
    if (!silent) setLoading(true)
    try{
      const d = await VisitsAPI.detail(visitId)
      setData(d)
      setSummary(d?.visit?.oppsummering_notat || '')
      setSignatures({
        customer_signature_url: d?.visit?.customer_signature_url || '',
        technician_signature_url: d?.visit?.technician_signature_url || '',
      })
      setChecklist({
        sjekk_advarselskilt: !!d?.visit?.sjekk_advarselskilt,
        sjekk_agnstasjoner: !!d?.visit?.sjekk_agnstasjoner,
        sjekk_inngangspunkter: !!d?.visit?.sjekk_inngangspunkter,
        sjekk_fellefangst: !!d?.visit?.sjekk_fellefangst,
      })
      // Load types once (for dynamic service form)
      if (!types.length) {
        try { setTypes(await EquipmentTypesAPI.list()) } catch (e) { /* ignore */ }
      }
    } finally{
      if (!silent) setLoading(false)
    }
  }, [visitId])
  useEffect(()=>{ load() }, [load])

  // Preload bait materials for Åtekasse service modal
  useEffect(() => {
    let canceled = false
    const run = async () => {
      try {
        const [poison, nonpoison] = await Promise.all([
          MaterialsAPI.list('Giftåte'),
          MaterialsAPI.list('Giftfritt Åte'),
        ])
        if (!canceled) setMaterials({ poison, nonpoison })
      } catch (_) { /* ignore */ }
    }
    run()
    return () => { canceled = true }
  }, [])

  // Initialize map with Google only (no OSM fallback). Show placeholder if no API key.
  useEffect(() => {
    let cancelled = false
    const tryInit = () => {
      if (cancelled) return
      if (mapRef.current) return
      if (!mapEl.current) { setTimeout(tryInit, 120); return }
      try {
        const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        if (!key) { setMapsKeyMissing(true); return }
        const map = L.map(mapEl.current, { center: [60.39299, 5.32415], zoom: 13 })
        layerCtrlRef.current = { }
        markersRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        try { map.on('zoomend', () => { try { updateMarkerLabels() } catch (e) {} }) } catch (e) {}
        setTimeout(() => { try { map.invalidateSize(true) } catch (e) {} }, 50)

        const tryAddGoogle = () => {
          try {
            if (typeof window !== 'undefined' && window.google && L.gridLayer && L.gridLayer.googleMutant) {
              const gSat = L.gridLayer.googleMutant({ type: 'satellite' })
              const gRoad = L.gridLayer.googleMutant({ type: 'roadmap' })
              layerCtrlRef.current.gRoad = gRoad
              layerCtrlRef.current.gSat = gSat
              gSat.addTo(map); activeBaseRef.current = 'google_sat'
              setBaseReady(true)
              setTimeout(() => { try { map.invalidateSize(true) } catch (e) {} }, 50)
            }
          } catch (e) {}
        }
        const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
        if (!existing) {
          const s = document.createElement('script')
          s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`
          s.async = true; s.defer = true
          s.onload = () => { tryAddGoogle() }
          s.onerror = () => { setMapsKeyMissing(true) }
          document.head.appendChild(s)
        } else {
          setTimeout(() => { tryAddGoogle() }, 60)
        }
      } catch (e) {
        setTimeout(tryInit, 200)
      }
    }
    tryInit()
    return () => { cancelled = true; try { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } } catch (e) {} }
  }, [])

  // Build color-coded icons: outer ring by equipment type, inner dot by status (red/green)
  const iconFor = useMemo(() => {
    const typeColors = {
      'Åtekasse': '#0ea5e9',
      'Gassfelle': '#a855f7',
      'Kamera': '#f97316',
      'Limfelle': '#06b6d4',
    }
    return (eqTypeName, isChecked) => {
      const ring = typeColors[eqTypeName] || '#64748b'
      const fill = isChecked ? '#16a34a' : '#dc2626'
      return L.divIcon({
        className: 'visit-eq-marker',
        html: `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${fill};border:2px solid ${ring};box-shadow:0 0 0 2px rgba(255,255,255,0.85);"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
    }
  }, [])

  // Update markers when data changes
  useEffect(() => {
    if (!data || !data.customer || !Array.isArray(data.equipment)) return
    const map = mapRef.current
    const group = markersRef.current
    if (!map || !group) return
    group.clearLayers()

    const toNum = (v) => { if (v == null) return null; const s = String(v).replace(',', '.').trim(); const n = Number(s); return Number.isFinite(n) ? n : null }
    const toFit = []
    let eqCount = 0
    // Always show customer marker when coords exist (with address)
    const cLat = toNum(data.customer.latitude)
    const cLng = toNum(data.customer.longitude)
    if (cLat != null && cLng != null) {
      const addr = [data.customer.address, [data.customer.postal_code, data.customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      const cm = L.circleMarker([cLat, cLng], { radius: 7, color: '#0f172a', weight: 2, fillColor: '#60a5fa', fillOpacity: 0.9 })
      cm.bindPopup(`<div><strong>${data.customer.name || 'Kunde'}</strong>${addr ? `<div style=\"font-size:12px;color:#475569\">${addr}</div>`:''}<div style=\"margin-top:6px\"><a href=\"#customer:${data.customer.id}\">Åpne kundekort</a></div></div>`)
      cm.addTo(group)
      toFit.push([cLat, cLng])
    }
    data.equipment.forEach(e => {
      const lat = toNum(e.latitude)
      const lng = toNum(e.longitude)
      if (lat == null || lng == null) return
      const typeName = e.type || e.equipment_type_name || (e.equipment_type && e.equipment_type.name) || ''
      const icon = iconFor(typeName, !!e.checked)
  const m = L.marker([lat, lng], { icon })
  // mark as equipment marker for label toggling
  m._isEq = true
  const hasExisting = (data?.logs || []).some(l => l.equipment_id === e.id)
  const btnText = hasExisting ? 'Endre service' : 'Registrer service'
  const html = `<div style=\"min-width:200px\"><div style=\"font-weight:600\">${e.name || 'Utstyr'}</div><div style=\"font-size:12px;color:#475569;margin:2px 0\">${typeName}</div><div style=\"margin-top:6px;display:flex;gap:6px;justify-content:flex-end\"><a href=\"#\" class=\"btn-open-service\" style=\"padding:6px 10px;font-size:12px\">${btnText}</a></div></div>`
      m.bindPopup(html)
      try {
        const isChecked = !!e.checked
        const statusEmoji = isChecked ? '✅' : '⛔'
        const tooltipText = `${statusEmoji} ${e.name || 'Utstyr'}${typeName ? ` (${typeName})` : ''}`
        m.bindTooltip(tooltipText, { direction: 'top', offset: [0, -8], opacity: 0.95, sticky: true, permanent: false })
      } catch (_) {}
      m.on('popupopen', (ev) => {
        try {
          const root = ev.popup.getElement()
          const btn = root && root.querySelector && root.querySelector('.btn-open-service')
          if (btn) {
            btn.addEventListener('click', (evt) => {
              evt.preventDefault(); evt.stopPropagation();
              setSelectedEq(e);
              setDynamicValues(prepareDynamicDefaults(e));
              try {
                const existing = (data?.logs || []).find(l => l.equipment_id === e.id)
                setEditingLog(existing || null)
                if (existing) {
                  setLogForm(f => ({ ...f, equipment_id: e.id, description: extractNote(existing.description || ''), hours_worked: existing.hours_worked ?? '' }))
                  const mus = existing.materials_used || []
                  const findFirst = (arr, type) => (arr||[]).find(u => (u.material && u.material.material_type) === type)
                  const pb = findFirst(mus, 'Giftåte')
                  const npb = findFirst(mus, 'Giftfritt Åte')
                  setDynamicValues(v => ({
                    ...v,
                    benyttet_giftaate_id: pb?.material?.id ? String(pb.material.id) : v.benyttet_giftaate_id,
                    giftaate_etterfylt: (pb && pb.amount != null) ? pb.amount : v.giftaate_etterfylt,
                    benyttet_giftfritt_aate_id: npb?.material?.id ? String(npb.material.id) : v.benyttet_giftfritt_aate_id,
                    giftfritt_etterfylt: (npb && npb.amount != null) ? npb.amount : v.giftfritt_etterfylt,
                  }))
                } else {
                  setLogForm(f => ({ ...f, equipment_id: e.id, description: '', hours_worked: '' }))
                }
              } catch (_) { setEditingLog(null) }
              setShowLogModal(true)
              try { ev.popup._close() } catch (_) {}
            }, { once: true })
          }
        } catch (_) {}
      })
  m.addTo(group)
      toFit.push([lat, lng])
      eqCount += 1
    })
  // If no equipment markers, the customer marker above is already shown
    try {
      if (toFit.length === 1) map.setView(toFit[0], 16)
      else if (toFit.length > 1) map.fitBounds(L.latLngBounds(toFit), { padding: [16, 16] })
    } catch (e) {}
    try { map.invalidateSize(true) } catch (e) {}
    // Ensure labels reflect current zoom after markers render
    try { updateMarkerLabels() } catch (e) {}
  }, [data, iconFor, visitId, baseReady, updateMarkerLabels])

  if (loading) return <Loading>Laster besøk…</Loading>
  if (!data) return <div>Ikke funnet.</div>

  const v = data.visit
  const role = (user && user.role) || ''
  const isAdminOrManager = role === 'admin' || role === 'manager'
  const canStart = (v.status === 'Planlagt' || !v.status)
  const canComplete = v.status === 'Pågående'
  const canDelete = (v.status === 'Planlagt') && isAdminOrManager

  const addLog = async (e) => {
    e.preventDefault()
    if (savingLog) return
    // Basic validation of numeric inputs
    const nonNeg = (val) => val === '' || val == null || (typeof val === 'number' ? val >= 0 : Number(val) >= 0)
    if (!nonNeg(logForm.hours_worked)) { toast.push({ variant:'error', title:'Ugyldig timer', description:'Timer må være et ikke-negativt tall.' }); return }
    if (!nonNeg(dynamicValues.giftaate_etterfylt) || !nonNeg(dynamicValues.giftfritt_etterfylt)) {
      toast.push({ variant:'error', title:'Ugyldig mengde', description:'Etterfylt mengde må være et ikke-negativt tall.' }); return
    }
    const parts = []
    if (selectedEq && selectedEq.type) parts.push(`[${selectedEq.type}]`)
    Object.entries(dynamicValues || {}).forEach(([k, val]) => { parts.push(`${k}: ${val === true ? 'ja' : val === false ? 'nei' : (val ?? '')}`) })
    if (logForm.description) parts.push(`Notat: ${logForm.description}`)
    const t = (types || []).find(x => x.id === (selectedEq && selectedEq.equipment_type_id))
    const typeName = (selectedEq && selectedEq.type) || (t && t.name) || ''
    let payload = {
      equipment_id: Number(logForm.equipment_id || (selectedEq && selectedEq.id)),
      description: parts.join(' | '),
      hours_worked: logForm.hours_worked ? Number(logForm.hours_worked) : undefined,
    }
    if (/åtekasse/i.test(typeName)) {
      const poisonId = dynamicValues.benyttet_giftaate_id || dynamicValues.used_material_id_poison
      const nonId = dynamicValues.benyttet_giftfritt_aate_id || dynamicValues.used_material_id_nonpoison
      const poisonAmt = dynamicValues.giftaate_etterfylt || dynamicValues.refilled_grams_poison
      const nonAmt = dynamicValues.giftfritt_etterfylt || dynamicValues.refilled_grams_nonpoison
      const findName = (arr, id) => { const x = (arr||[]).find(m => Number(m.id) === Number(id)); return x ? x.name : null }
      if (poisonId || poisonAmt) {
        payload.poison_bait = { used_material_id: poisonId ? Number(poisonId) : undefined, refilled_grams: (poisonAmt === '' || poisonAmt == null) ? undefined : Number(poisonAmt) }
        const nm = findName(materials.poison, poisonId)
        parts.push(`Giftåte: ${nm || poisonId || ''} ${poisonAmt? `(${poisonAmt}g)`:''}`)
      }
      if (nonId || nonAmt) {
        payload.nonpoison_bait = { used_material_id: nonId ? Number(nonId) : undefined, refilled_grams: (nonAmt === '' || nonAmt == null) ? undefined : Number(nonAmt) }
        const nm2 = findName(materials.nonpoison, nonId)
        parts.push(`Giftfritt åte: ${nm2 || nonId || ''} ${nonAmt? `(${nonAmt}g)`:''}`)
      }
      payload.description = parts.join(' | ')
    }
    try {
      setSavingLog(true)
      if (editingLog && editingLog.id) {
        await ServiceLogsAPI.update(editingLog.id, payload)
      } else {
        await VisitsAPI.logs.create(visitId, payload)
      }
      setLogForm({ equipment_id: '', description: '', hours_worked: '' })
      setShowLogModal(false)
      setEditingLog(null)
      toast.push({ variant: 'success', title: 'Logg lagret' })
      await load({ silent: true })
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Kunne ikke lagre logg'
      toast.push({ variant: 'error', title: 'Lagring feilet', description: String(msg) })
    } finally {
      setSavingLog(false)
    }
  }

  const start = async () => {
    try {
      await VisitsAPI.start(visitId)
      toast.push({ variant: 'info', title: 'Besøk startet' })
      await load()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Kunne ikke starte besøk'
      toast.push({ variant: 'error', title: 'Start feilet', description: String(msg) })
    }
  }

  const complete = async () => {
    const missingChecklist = Object.keys(checklist).filter(k => checklist[k] !== true)
    if (!summary || !summary.trim()) {
      toast.push({ variant: 'error', title: 'Mangler oppsummering', description: 'Skriv en kort oppsummering før fullføring.' })
      return
    }
    const unchecked = (data?.equipment || []).filter(e => !e.checked)
    if (unchecked.length > 0) {
      const ok = window.confirm('Ikke alt utstyr er kontrollert. Er du sikker på at du vil fullføre?')
      if (!ok) return
    }
    if (missingChecklist.length > 0) {
      const ok2 = window.confirm('Sjekklisten er ikke komplett. Vil du fullføre likevel?')
      if (!ok2) return
    }
    try {
      // Persist signature URLs (if changed) before completion
      try {
        await VisitsAPI.update?.(visitId, {
          customer_signature_url: signatures.customer_signature_url || undefined,
          technician_signature_url: signatures.technician_signature_url || undefined,
        })
      } catch (_) { /* non-fatal */ }
  await VisitsAPI.complete(visitId, { summary, checklist })
      toast.push({ variant: 'success', title: 'Besøk fullført' })
      window.location.hash = 'missions'
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Kunne ikke fullføre besøk'
      toast.push({ variant: 'error', title: 'Fullføring feilet', description: String(msg) })
    }
  }

  const niceName = (k) => {
    const map = {
      sjekk_advarselskilt: 'Advarselskilt',
      sjekk_agnstasjoner: 'Substitusjon',
      sjekk_inngangspunkter: 'Inngangspunkter',
      sjekk_fellefangst: 'Fellefangst',
    }
    return map[k] || (k || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="stack" style={{gap:16}}>
      <PageHeader
        title={`Besøksdetalj${v?.id ? ` #${v.id}` : ''}`}
        actions={(
          <>
            <button className="btn btn-icon" onClick={() => load({ silent: false })}><IconRefresh /> Oppdater</button>
            <button className="btn" onClick={() => window.history.back()}>Tilbake</button>
          </>
        )}
      />
  <FeedbackButton context={{ page: 'visit', visitId }} />
  <Card title="Besøksdetalj">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
          <div>
            <div>Besøk #{v.id} — {new Date(v.visit_date).toLocaleString()}</div>
            {data?.customer?.id ? (
              <div style={{fontSize:13}}>
                Kunde: <a href={`#customer:${data.customer.id}`}>{data.customer.name || `#${data.customer.id}`}</a>
              </div>
            ) : null}
            <div style={{fontSize:13, color:'#475569'}}>Status: {v.status || 'Planlagt'}</div>
          </div>
          <div style={{display:'flex', gap:8}}>
            {canStart && <Button variant="primary" onClick={start}>Start besøk</Button>}
            {canDelete && (
              <Button variant="danger" onClick={async () => {
                try {
                  if (!window.confirm('Slette dette oppdraget?')) return
                  await VisitsAPI.delete(visitId)
                  toast.push({ variant:'success', title:'Slettet', description:'Oppdraget ble slettet.' })
                  // Naviger tilbake til kundekort om vi har det; ellers til missions
                  const cid = data?.customer?.id
                  window.location.hash = cid ? `customer:${cid}` : 'missions'
                } catch (e) {
                  const msg = e?.response?.data?.error || e?.message || 'Kunne ikke slette oppdrag'
                  toast.push({ variant:'error', title:'Sletting feilet', description: String(msg) })
                }
              }}>Slett oppdrag</Button>
            )}
            <Button onClick={() => window.history.back()}>Tilbake</Button>
          </div>
        </div>
      </Card>

      <Card title="Utstyrskart">
        {mapsKeyMissing ? (
          <div className="card" style={{padding:12, fontSize:14, color:'#475569'}}>Google Maps API-nøkkel mangler. Kartet kan ikke vises.</div>
        ) : (
          <div style={{ height: 380, borderRadius: 8, overflow: 'hidden' }}>
            <div ref={mapEl} style={{ width: '100%', height: '100%' }} />
          </div>
        )}
        {(!data.equipment || data.equipment.length === 0) ? (
          <div style={{marginTop:8, fontSize:13, color:'#475569'}}>Ingen utstyr registrert hos kunden ennå. Du kan legge til utstyr fra kundekortet.</div>
        ) : (
          <div style={{marginTop:8, fontSize:12, color:'#475569'}}>Zoom inn for å se navn på utstyr. Klikk en markør og velg «Utfør service» for å registrere kontroll.</div>
        )}
      </Card>

      <Card title="Oppsummering og sjekkliste">
        <textarea className="input" placeholder="Oppsummering til kunde" value={summary} onChange={e=> setSummary(e.target.value)} />
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <div style={{ fontWeight: 600 }}>Signaturer</div>
          <div className="stack" style={{ gap: 6 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input className="input" placeholder="Kundesignatur URL (valgfritt)" value={signatures.customer_signature_url} onChange={e=> setSignatures(s=> ({...s, customer_signature_url: e.target.value}))} style={{ flex: 1, minWidth:220 }} />
              <label className="btn">
                Last opp
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={async (ev) => {
                  try {
                    const f = ev.target.files && ev.target.files[0]; if (!f) return
                    const dataUrl = await fileToDataUrl(f)
                    setSignatures(s => ({ ...s, customer_signature_url: String(dataUrl||'') }))
                  } catch {}
                }} />
              </label>
            </div>
            {signatures.customer_signature_url ? (
              <div style={{ fontSize: 12, color:'#64748b' }}>
                Forhåndsvisning:
                <div style={{ marginTop:6 }}>
                  <img src={signatures.customer_signature_url} alt="Kundesignatur" style={{ maxWidth: 240, borderRadius: 6, border:'1px solid #e2e8f0' }} />
                </div>
              </div>
            ) : null}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input className="input" placeholder="Teknikersignatur URL (valgfritt)" value={signatures.technician_signature_url} onChange={e=> setSignatures(s=> ({...s, technician_signature_url: e.target.value}))} style={{ flex: 1, minWidth:220 }} />
              <label className="btn">
                Last opp
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={async (ev) => {
                  try {
                    const f = ev.target.files && ev.target.files[0]; if (!f) return
                    const dataUrl = await fileToDataUrl(f)
                    setSignatures(s => ({ ...s, technician_signature_url: String(dataUrl||'') }))
                  } catch {}
                }} />
              </label>
            </div>
            {signatures.technician_signature_url ? (
              <div style={{ fontSize: 12, color:'#64748b' }}>
                Forhåndsvisning:
                <div style={{ marginTop:6 }}>
                  <img src={signatures.technician_signature_url} alt="Teknikersignatur" style={{ maxWidth: 240, borderRadius: 6, border:'1px solid #e2e8f0' }} />
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Du kan lime inn URL eller laste opp bilde direkte. Ved opplasting lagres bildet i systemet og feltet for URL settes automatisk.</div>
        </div>
        <div className="list" style={{marginTop:8}}>
          {Object.keys(checklist).map(k => (
            <label key={k} className="list-item" style={{gap:8}}>
              <input type="checkbox" checked={!!checklist[k]} onChange={e=> setChecklist(c=> ({...c, [k]: e.target.checked}))} />
              <span>{niceName(k)}</span>
            </label>
          ))}
        </div>
        {canComplete && <Button variant="success" onClick={complete} style={{marginTop:8}}>Fullfør besøk</Button>}
      </Card>

      <Card title="Utstyrsliste">
        {!data.equipment?.length ? (
          <Empty>Ingen utstyr registrert.</Empty>
        ) : (
          <ul className="list">
            {data.equipment.map(eq => {
              const hasExisting = (data?.logs || []).some(l => l.equipment_id === eq.id)
              const btnLabel = hasExisting ? 'Endre service' : 'Utfør service'
              return (
                <li key={eq.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{eq.name || 'Utstyr'}</div>
                    <div style={{ fontSize: 12, color:'#475569' }}>{eq.type || ''}</div>
                  </div>
                  <div>
                    <Button size="sm" onClick={() => {
                      setSelectedEq(eq);
                      setDynamicValues(prepareDynamicDefaults(eq));
                      try {
                        const existing = (data?.logs || []).find(l => l.equipment_id === eq.id)
                        setEditingLog(existing || null)
                        if (existing) {
                          setLogForm(f => ({ ...f, equipment_id: eq.id, description: extractNote(existing.description || ''), hours_worked: existing.hours_worked ?? '' }))
                          const mus = existing.materials_used || []
                          const findFirst = (arr, type) => (arr||[]).find(u => (u.material && u.material.material_type) === type)
                          const pb = findFirst(mus, 'Giftåte')
                          const npb = findFirst(mus, 'Giftfritt Åte')
                          setDynamicValues(v => ({
                            ...v,
                            benyttet_giftaate_id: pb?.material?.id ? String(pb.material.id) : v.benyttet_giftaate_id,
                            giftaate_etterfylt: (pb && pb.amount != null) ? pb.amount : v.giftaate_etterfylt,
                            benyttet_giftfritt_aate_id: npb?.material?.id ? String(npb.material.id) : v.benyttet_giftfritt_aate_id,
                            giftfritt_etterfylt: (npb && npb.amount != null) ? npb.amount : v.giftfritt_etterfylt,
                          }))
                        } else {
                          setLogForm(f => ({ ...f, equipment_id: eq.id, description: '', hours_worked: '' }))
                        }
                      } catch (_) { setEditingLog(null) }
                      setShowLogModal(true)
                    }}>{btnLabel}</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Logger">
        {!data.logs?.length ? <Empty>Ingen logger ennå.</Empty> : (
          <ul>
            {data.logs.map(l => (
              <li key={l.id}>{new Date(l.log_date || v.visit_date).toLocaleString()} — {l.description} {l.hours_worked ? `(${l.hours_worked}t)` : ''}</li>
            ))}
          </ul>
        )}
      </Card>

      {showLogModal && selectedEq && (
        <div className="modal-backdrop" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000}}>
          <div className="modal" style={{background:'#fff',borderRadius:8,padding:16,minWidth:320,maxWidth:560,width:'96%', zIndex:3100}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:600}}>Registrer service: {selectedEq.name}</div>
              <button type="button" className="btn" onClick={()=> { setShowLogModal(false); setEditingLog(null) }}>Lukk</button>
            </div>
            <form className="stack" style={{gap:8}} onSubmit={addLog}>
              {(() => {
                const t = (types || []).find(x => x.id === selectedEq.equipment_type_id)
                let fields = Array.isArray(t?.fields) ? t.fields : []
                // Fallbacks based on equipment type name when no configured fields
                const typeName = selectedEq.type || t?.name || ''
                if (!fields.length) {
                  if (/åtekasse/i.test(typeName)) {
                    fields = [
                      { key: 'forbruk_giftaate', label: 'Forbruk giftåte (%)', type: 'select', options: ['0%','25%','50%','75%','100%'] },
                      { key: 'benyttet_giftaate_id', label: 'Benyttet giftåte', type: 'select', options: (materials.poison||[]).map(m => ({ value: m.id, label: m.name })) },
                      { key: 'giftaate_etterfylt', label: 'Giftåte etterfylt (gram)', type: 'number' },
                      { key: 'benyttet_giftfritt_aate_id', label: 'Benyttet giftfritt åte', type: 'select', options: (materials.nonpoison||[]).map(m => ({ value: m.id, label: m.name })) },
                      { key: 'giftfritt_etterfylt', label: 'Giftfritt åte etterfylt (gram)', type: 'number' },
                    ]
                  } else if (/gassfelle/i.test(typeName)) {
                    fields = [ { key: 'antall_slag', label: 'Antall slag', type: 'number' } ]
                  } else if (/limfelle/i.test(typeName)) {
                    fields = [ { key: 'antall_fangst', label: 'Antall fangst', type: 'number' } ]
                  }
                }
                if (!fields.length) return null
                return (
                  <div className="stack" style={{gap:8}}>
                    <div style={{fontSize:12, color:'#475569'}}>{typeName ? `Type: ${typeName}` : ''}</div>
                    {fields.map((f, idx) => {
                      const key = (f.key || '').trim()
                      const label = f.label || key || 'Felt'
                      const type = (f.type || 'text')
                      if (!key) return null
                      if (type === 'boolean') {
                        return (
                          <label key={idx} style={{display:'flex',alignItems:'center',gap:8}}>
                            <input type="checkbox" checked={!!dynamicValues[key]} onChange={e=> setDynamicValues(v=> ({...v, [key]: e.target.checked}))} />
                            <span>{label}</span>
                          </label>
                        )
                      }
                      if (type === 'select') {
                        const opts = Array.isArray(f.options) ? f.options : []
                        return (
                          <label key={idx} className="stack" style={{gap:4}}>
                            <div>{label}</div>
                            <select className="input" value={dynamicValues[key] ?? ''} onChange={e=> setDynamicValues(v=> ({...v, [key]: e.target.value}))}>
                              <option value="">Velg…</option>
                              {opts.map((o,i) => {
                                if (o && typeof o === 'object' && 'value' in o) return <option key={i} value={String(o.value)}>{String(o.label ?? o.value)}</option>
                                return <option key={i} value={String(o)}>{String(o)}</option>
                              })}
                            </select>
                          </label>
                        )
                      }
                      const isNum = (type === 'number')
                      return (
                        <label key={idx} className="stack" style={{gap:4}}>
                          <div>{label}</div>
                          <input className="input" type={isNum? 'number':'text'} step={isNum? 'any': undefined} value={dynamicValues[key] ?? ''} onChange={e=> setDynamicValues(v=> ({...v, [key]: isNum ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value}))} />
                        </label>
                      )
                    })}
                  </div>
                )
              })()}

              <textarea className="input" placeholder="Notat (valgfritt)" value={logForm.description} onChange={e=> setLogForm(f=>({...f, description: e.target.value}))} />
              <input className="input" type="number" min="0" step="0.25" placeholder="Timer (valgfritt)" value={logForm.hours_worked} onChange={e=> setLogForm(f=>({...f, hours_worked: e.target.value}))} />
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                <div style={{fontSize:12,color:'#64748b'}}>{editingLog ? 'Redigerer tidligere logg for dette utstyret' : ''}</div>
                <div style={{display:'flex',gap:8}}>
                  <Button type="button" onClick={()=> { if (!savingLog) { setShowLogModal(false); setEditingLog(null) } }} disabled={savingLog}>Avbryt</Button>
                  <Button variant="primary" type="submit" disabled={savingLog}>{savingLog ? 'Lagrer…' : (editingLog ? 'Oppdater' : 'Lagre')}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Sticky action bar on mobile (feature-flagged) */}
      {enableNewUi && isMobile && (
        <ActionBar visible>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Besøk #{v.id} — {new Date(v.visit_date).toLocaleDateString()}</div>
            {data?.customer?.id ? (
              <a className="btn btn-ghost" href={`#customer:${data.customer.id}`}>Kundekort</a>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
            {canStart && <Button variant="primary" onClick={start}>Start</Button>}
            {canComplete && <Button variant="success" onClick={complete}>Fullfør</Button>}
            {/* Overflow for secondary actions */}
            {(canDelete) && (
              <div className="dropdown" style={{ position:'relative' }}>
                <details>
                  <summary className="btn">Mer</summary>
                  <div className="card" style={{ position:'absolute', right:0, bottom:'100%', marginBottom:6, minWidth:160, padding:6 }}>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          if (!window.confirm('Slette dette oppdraget?')) return
                          await VisitsAPI.delete(visitId)
                          toast.push({ variant:'success', title:'Slettet', description:'Oppdraget ble slettet.' })
                          const cid = data?.customer?.id
                          window.location.hash = cid ? `customer:${cid}` : 'missions'
                        } catch (e) {
                          const msg = e?.response?.data?.error || e?.message || 'Kunne ikke slette oppdrag'
                          toast.push({ variant:'error', title:'Sletting feilet', description: String(msg) })
                        }
                      }}
                    >Slett oppdrag</button>
                  </div>
                </details>
              </div>
            )}
          </div>
        </ActionBar>
      )}

      {/* Contextuell FAB på mobil: Start/Fullfør besøk */}
      {enableNewUi && isMobile && (
        canStart ? (
          <Fab label="Start besøk" icon="▶" ariaLabel="Start besøk" onClick={start} />
        ) : canComplete ? (
          <Fab label="Fullfør besøk" icon="✓" ariaLabel="Fullfør besøk" onClick={complete} />
        ) : null
      )}
    </div>
  )
}
