import { useEffect, useRef, useState, useCallback } from 'react'
import { CustomersAPI, EquipmentAPI, EquipmentTypesAPI, VisitsAPI, EmployeesAPI, MaterialsAPI } from '../api'
import Card from './ui/Card'
import Button from './ui/Button'
import { Loading, Empty, ErrorState } from './ui/States'
import PageHeader from './ui/PageHeader'
import { IconRefresh, IconPlus, IconChevronDown, IconChevronUp, IconEdit } from './ui/icons'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.gridlayer.googlemutant'
import { useToast } from './ui/Toast.jsx'
import { useAuth } from './hooks/useAuth'

export default function CustomerDetail({ customerId }) {
  const { user } = useAuth()
  const isAdmin = (user?.role === 'admin' || user?.role === 'manager')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // map refs
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(null)
  const moveMarkerRef = useRef(null)
  const editMarkerRef = useRef(null)
  const layerCtrlRef = useRef(null)
  const activeBaseRef = useRef('osm')
  const [baseReady, setBaseReady] = useState(false)

  const toast = useToast()

  // forms / UI state
  const [form, setForm] = useState({})
  const [editingEq, setEditingEq] = useState(null)
  const [addingEq, setAddingEq] = useState(false)
  const typesRef = useRef(null)

  // collapsible sections
  const [showEditCustomer, setShowEditCustomer] = useState(false)
  const [showVisits, setShowVisits] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [creatingVisit, setCreatingVisit] = useState(false)
  const [selectedVisits, setSelectedVisits] = useState([])
  // admin bulk assign state
  const [assignMeters, setAssignMeters] = useState(250)
  const [assignLoading, setAssignLoading] = useState(false)

  const load = useCallback(async (opts) => {
    const silent = !!(opts && opts.silent)
    if (!silent) { setLoading(true); setError(null) }
    try {
      const d = await CustomersAPI.detail(customerId)
      setData(d)
    } catch (err) {
      if (!silent) setError(err?.message || 'Kunne ikke laste kunde')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    // Require authenticated user to load customer data
    try {
      if (!user) {
        // redirect to login page
        window.location.hash = 'login'
        return
      }
    } catch (e) { /* ignore */ }
    load()
  }, [load, user])

  const handleDeactivate = async () => {
    if (!window.confirm(`Deaktivere kunden "${data?.customer?.name || ''}" (ID: ${customerId})? Du kan reaktivere senere.`)) return
    try {
      await CustomersAPI.delete(customerId)
      toast.push({ variant: 'success', title: 'Deaktivert', description: 'Kunden ble deaktivert.' })
      try {
        const fromMap = sessionStorage.getItem('bsk:fromMap')
        if (fromMap && String(fromMap) === String(customerId)) {
          sessionStorage.removeItem('bsk:fromMap')
          window.location.hash = 'map'
        } else {
          window.location.hash = 'customers'
        }
      } catch (e) {
        window.location.hash = 'customers'
      }
    } catch (e) {
      console.debug(e)
      const msg = e?.response?.data?.error || e?.message || 'Kunne ikke deaktivere kunde.'
      toast.push({ variant: 'error', title: 'Feil', description: String(msg) })
    }
  }

  // Active visit for this customer, available to effects and render
  const activeVisit = (data?.visits || []).find(v => v.status === 'Pågående')

  // initialize map once
  useEffect(() => {
    let cancelled = false
    const tryInit = () => {
      if (cancelled) return
      if (mapRef.current) return
      if (!mapEl.current) {
        // retry until the DOM node is present
        setTimeout(tryInit, 120)
        return
      }
      try {
        const map = L.map(mapEl.current, { center: [60.39, 5.32], zoom: 12 })
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' })
        osm.addTo(map)
        layerCtrlRef.current = { osm }
        activeBaseRef.current = 'osm'
        markersRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        setBaseReady(true)
  // ensure proper size after render
  setTimeout(() => { try { map.invalidateSize(true) } catch (e) { console.debug(e) } }, 50)

        // attempt to load Google Maps (non-blocking)
        const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        const tryAddGoogle = () => {
          try {
            if (key && typeof window !== 'undefined' && window.google && L.gridLayer && L.gridLayer.googleMutant) {
              const gRoad = L.gridLayer.googleMutant({ type: 'roadmap' })
              const gSat = L.gridLayer.googleMutant({ type: 'satellite' })
              layerCtrlRef.current.gRoad = gRoad
              layerCtrlRef.current.gSat = gSat
              // switch to satellite by default
              try { map.removeLayer(osm) } catch (e) { console.debug(e) }
              gSat.addTo(map); activeBaseRef.current = 'google_sat'
              setTimeout(() => { try { map.invalidateSize(true) } catch (e) { console.debug(e) } }, 50)
            }
          } catch (e) { console.debug(e) }
        }
          if (key) {
          const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
          if (!existing) {
            const s = document.createElement('script')
            s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`
            s.async = true; s.defer = true
            s.onload = () => { tryAddGoogle() }
            s.onerror = () => { console.debug('google maps script failed to load') }
            document.head.appendChild(s)
          } else {
            // Script already present: try to initialize immediately
            setTimeout(() => { tryAddGoogle() }, 50)
          }
        }
      } catch (err) {
        // try again briefly if initialization failed
        console.debug('map init failed', err)
        if (!cancelled) setTimeout(tryInit, 200)
      }
    }
    tryInit()
    return () => { cancelled = true; try { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } } catch (e) { console.debug(e) } }
  }, [])

  // show edit popup by creating a temporary marker and opening a popup with current values
  useEffect(() => {
    if (!editingEq) return
    const map = mapRef.current
    if (!map) return
    try { if (editMarkerRef.current) { map.removeLayer(editMarkerRef.current); editMarkerRef.current = null } } catch (e) { console.debug(e) }
    const start = [Number(editingEq.latitude) || Number(editingEq._lat) || map.getCenter().lat, Number(editingEq.longitude) || Number(editingEq._lng) || map.getCenter().lng]
    const m = L.marker(start, { draggable: true })
    m.addTo(map); editMarkerRef.current = m
    const propsHtml = (() => {
      const p = editingEq.properties || {}
      return Object.keys(p || {}).slice(0, 6).map(k => `<label style="display:block;margin:6px 0">${k}<input class="edit-prop-${k}" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" value="${(p[k]===null||p[k]===undefined)?'':String(p[k])}" /></label>`).join('')
    })()
    const html = `<div style="min-width:260px"><div style="font-size:13px;font-weight:600;margin-bottom:6px">Rediger: ${editingEq.name || ''}</div><label style="display:block;margin-bottom:6px">Navn<input class="edit-eq-name" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" value="${editingEq.name || ''}" /></label><label style="display:block;margin-bottom:6px">Plassering (beskrivelse)<input class="edit-eq-notes" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" value="${editingEq.notes || ''}" /></label><label style="display:block;margin-bottom:6px">Bilde (endre, mobil)<input accept="image/*" capture="environment" type="file" class="edit-eq-photo" style="width:100%;margin-top:6px" /></label><div class="edit-eq-photo-preview" style="margin-top:6px">${editingEq.properties && editingEq.properties.placement_photo_url ? `<img src="${editingEq.properties.placement_photo_url}" style="max-width:220px;display:block;border-radius:6px" />` : ''}</div><div class="edit-eq-props" style="margin-top:6px">${propsHtml}</div><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px"><button type="button" class="btn-cancel-edit" style="padding:6px 10px;font-size:13px">Avbryt</button><button type="button" class="btn-save-edit" style="padding:6px 10px;font-size:13px">Lagre</button></div></div>`
    m.bindPopup(html, { closeButton: false })
    m.on('popupopen', () => {
      const root = m.getPopup().getElement()
      const btnSave = root.querySelector('.btn-save-edit')
      const btnCancel = root.querySelector('.btn-cancel-edit')
      const nameEl = root.querySelector('.edit-eq-name')
      const notesEl = root.querySelector('.edit-eq-notes')
      const photoEl = root.querySelector('.edit-eq-photo')
      const photoPreview = root.querySelector('.edit-eq-photo-preview')
  if (photoEl) photoEl.addEventListener('change', () => {
        const f = photoEl.files && photoEl.files[0]
        if (!f) return
        const reader = new FileReader()
        reader.onload = () => { try { photoPreview.innerHTML = `<img src="${reader.result}" style="max-width:220px;display:block;border-radius:6px" />` } catch (e) { console.debug(e) } }
        reader.readAsDataURL(f)
      })
      if (btnSave) btnSave.addEventListener('click', async (_ev) => {
        _ev.preventDefault(); _ev.stopPropagation()
        const ll = m.getLatLng()
        const payload = { latitude: ll.lat, longitude: ll.lng }
        if (nameEl) payload.name = nameEl.value
        if (notesEl) payload.notes = notesEl.value
        // gather edited props
        const propsBox = root.querySelector('.edit-eq-props')
        if (propsBox) {
          const ps = {}
          Array.from(propsBox.querySelectorAll('input')).forEach(inp => { const cls = inp.className || ''; const mm = cls.match(/edit-prop-(.+)/); if (mm) ps[mm[1]] = inp.value })
          payload.properties = ps
        }
        // photo
        if (photoEl && photoEl.files && photoEl.files[0]) {
          const f = photoEl.files[0]
          const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
            const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file)
          })
          try { payload.placement_photo = await readFileAsDataURL(f) } catch (e) { console.debug(e) }
        }
          try {
            await EquipmentAPI.update(editingEq.id, payload)
            toast.push({ variant: 'success', title: 'Lagret', description: 'Utstyr oppdatert.' })
            try { map.removeLayer(m); editMarkerRef.current = null } catch (e) { console.debug(e) }
            setEditingEq(null)
            await load({ silent: true })
          } catch (e) {
            console.debug(e)
            toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke oppdatere utstyr.' })
          }
      }, { once: true })
  if (btnCancel) btnCancel.addEventListener('click', (_ev) => { _ev.preventDefault(); _ev.stopPropagation(); try { map.removeLayer(m); editMarkerRef.current = null } catch (e) { console.debug(e) }; setEditingEq(null) }, { once: true })
    })
    try { m.openPopup() } catch (e) { console.debug(e) }
    // cleanup when editingEq changes or component unmounts
    return () => { try { if (editMarkerRef.current) { map.removeLayer(editMarkerRef.current); editMarkerRef.current = null } } catch (e) { console.debug(e) } }
  }, [editingEq, load, toast])

  // update map markers when data changes
  useEffect(() => {
    const map = mapRef.current
    const group = markersRef.current
    if (!map || !group || !data) return
    group.clearLayers()

    const customer = data.customer
    const toNum = v => { if (v == null) return null; const s = String(v).replace(',', '.').trim(); const n = Number(s); return Number.isFinite(n) ? n : null }
    const cLat = toNum(customer?.latitude)
    const cLng = toNum(customer?.longitude)
    if (cLat != null && cLng != null) {
      const cm = L.circleMarker([cLat, cLng], { radius: 7 })
      cm.addTo(group)
      cm.bindPopup(`<div><strong>${customer?.name || ''}</strong><div>${customer?.address || ''}</div></div>`)
    }

  const equipment = (data.equipment || []).map(e => {
      const lat = toNum(e.latitude); const lng = toNum(e.longitude)
      return { ...e, _lat: lat, _lng: lng }
    })

    const onDelete = async (id) => {
      if (!window.confirm('Slette utstyr?')) return
      try { await EquipmentAPI.delete(id); await load({ silent: true }) } catch (e) { console.debug(e); toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke slette utstyr.' }) }
    }

    const onEdit = (id) => {
      const item = (data.equipment || []).find(x => x.id === id)
      if (item) setEditingEq({ ...item })
    }

    const onMove = (id, lat0, lng0) => {
      try { if (moveMarkerRef.current) { map.removeLayer(moveMarkerRef.current); moveMarkerRef.current = null } } catch (e) { console.debug(e) }
      const start = [lat0, lng0]
      const m = L.marker(start, { draggable: true })
      m.addTo(map)
      moveMarkerRef.current = m
      const popupHtml = `<div style="min-width:180px"><div style="font-size:12px;color:#475569;margin-bottom:6px">Flytt markøren til korrekt posisjon.</div><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="btn-cancel-move" style="padding:4px 8px;font-size:12px">Avbryt</button><button type="button" class="btn-save-move" style="padding:4px 8px;font-size:12px">Lagre posisjon</button></div></div>`
      m.bindPopup(popupHtml, { closeButton: false })
  m.on('popupopen', () => {
        const root = m.getPopup().getElement()
        const btnSave = root.querySelector('.btn-save-move')
        const btnCancel = root.querySelector('.btn-cancel-move')
        if (btnSave) btnSave.addEventListener('click', async (_ev) => {
          _ev.preventDefault(); _ev.stopPropagation()
          const ll = m.getLatLng()
            try {
              await EquipmentAPI.update(id, { latitude: ll.lat, longitude: ll.lng })
              // Dry-run: foreslå nærmeste kunde, be om bekreftelse før tilordning
              try {
                const probe = await EquipmentAPI.assignNearest(id, { max_distance_m: 250, dry_run: true })
                if (probe && probe.nearest_customer_id && probe.within_threshold && Number(probe.nearest_customer_id) !== Number(customerId)) {
                  const km = Math.round((Number(probe.distance_meters||0))/10)/100 // to km med 2 desimaler
                  const ok = window.confirm(`Foreslått ny kunde basert på posisjon: #${probe.nearest_customer_id} (${probe.nearest_customer_name || ''}) ca. ${km} km unna. Vil du tilordne utstyret til denne kunden?`)
                  if (ok) {
                    const res = await EquipmentAPI.assignNearest(id, { max_distance_m: 250, force: true })
                    if (res && res.assigned_customer_id) {
                      const reassignedId = Number(res.assigned_customer_id)
                      if (reassignedId && reassignedId !== Number(customerId)) {
                        toast.push({ variant: 'info', title: 'Tilordnet nærmeste kunde', description: `Utstyr flyttet til kunde #${reassignedId}.` })
                        try { map.removeLayer(m); moveMarkerRef.current = null } catch (e) { console.debug(e) }
                        window.location.hash = `customer:${reassignedId}`
                        return
                      }
                    }
                  }
                }
              } catch (e) {
                // Ikke-kritisk: bare logg, vis mild toast
                console.debug(e)
                toast.push({ variant: 'warning', title: 'Kunne ikke foreslå tilordning', description: 'Posisjon ble lagret, men forslag feilet.' })
              }
              toast.push({ variant: 'success', title: 'Lagret', description: 'Posisjon oppdatert.' })
              try { map.removeLayer(m); moveMarkerRef.current = null } catch (e) { console.debug(e) }
              await load({ silent: true })
            } catch (e) {
              console.debug(e)
              toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke lagre posisjon.' })
            }
        }, { once: true })
        if (btnCancel) btnCancel.addEventListener('click', (_ev) => {
          _ev.preventDefault(); _ev.stopPropagation()
          try { map.removeLayer(m); moveMarkerRef.current = null } catch (e) { console.debug(e) }
        }, { once: true })
      })
    try { m.openPopup() } catch (e) { console.debug(e) }
    }

  // Active visit is computed at component scope to enable direct service links
    equipment.forEach(e => {
      if (e._lat == null || e._lng == null) return
      const m = L.marker([e._lat, e._lng])
      const svcLink = activeVisit ? `<a href="#service:${activeVisit.id}:${e.id}" class="btn-open-service" style="padding:4px 8px">Utfør service</a>` : ''
      const html = `<div><strong>${e.name || ''}</strong><div style=\"font-size:12px;color:#475569\">${e.type || ''}</div><div style=\"margin-top:6px;display:flex;gap:6px;flex-wrap:wrap\">${svcLink}<button type='button' class='btn-move' data-id='${e.id}' data-lat='${e._lat}' data-lng='${e._lng}' style='padding:4px 8px'>Flytt</button><button type='button' class='btn-edit' data-id='${e.id}' style='padding:4px 8px'>Rediger</button><button type='button' class='btn-del' data-id='${e.id}' style='padding:4px 8px'>Slett</button></div></div>`
      m.bindPopup(html)
      m.on('popupopen', (ev) => {
        const root = ev.popup.getElement()
        const d = root.querySelector('.btn-del')
        const ed = root.querySelector('.btn-edit')
        const mv = root.querySelector('.btn-move')
        if (d) d.addEventListener('click', (evt) => { evt.preventDefault(); evt.stopPropagation(); onDelete(Number(d.getAttribute('data-id'))) }, { once: true })
        if (ed) ed.addEventListener('click', (evt) => { evt.preventDefault(); evt.stopPropagation(); onEdit(Number(ed.getAttribute('data-id'))) }, { once: true })
        if (mv) mv.addEventListener('click', (evt) => { evt.preventDefault(); evt.stopPropagation(); onMove(Number(mv.getAttribute('data-id')), Number(mv.getAttribute('data-lat')), Number(mv.getAttribute('data-lng'))) }, { once: true })
      })
      m.addTo(group)
    })

    // adjust view
    try {
      const toFit = []
      if (cLat != null && cLng != null) toFit.push([cLat, cLng])
      equipment.forEach(e => { if (e._lat != null && e._lng != null) toFit.push([e._lat, e._lng]) })
      if (toFit.length === 1) map.setView(toFit[0], 16)
      else if (toFit.length > 1) map.fitBounds(toFit, { padding: [20, 20] })
    } catch (e) { console.debug(e) }

  try { map.invalidateSize(true) } catch (e) { console.debug(e) }
  }, [data, baseReady, load, toast, activeVisit])

  // populate form when data arrives
  useEffect(() => {
    if (!data || !data.customer) return
    const c = data.customer
    setForm({
  name: c.name || '', address: c.address || '', postal_code: c.postal_code || '', city: c.city || '', contact_person: c.contact_person || '', email: c.email || '', phone: c.phone || '', org_number: c.org_number || '', visits_per_year: c.visits_per_year ?? '', start_date: c.start_date || '', latitude: c.latitude ?? '', longitude: c.longitude ?? ''
    })
  }, [data])

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={() => load()} />
  if (!data) return <Empty />

  const customer = data.customer

  const onSaveCustomer = async (e) => {
    e?.preventDefault?.()
    const payload = {
      name: form.name || undefined,
      address: form.address || undefined,
      postal_code: form.postal_code || undefined,
      city: form.city || undefined,
      contact_person: form.contact_person || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
  org_number: form.org_number || undefined,
      visits_per_year: form.visits_per_year === '' ? null : Number(form.visits_per_year),
      start_date: form.start_date || null,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude)
    }
    try {
      await CustomersAPI.update(customerId, payload)
      toast.push({ variant: 'success', title: 'Lagret', description: 'Kunde oppdatert.' })
      await load()
      setShowEditCustomer(false)
    } catch (e) { console.debug(e); toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke lagre kunde.' }) }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title={customer.name || `Kunde #${customer.id}`}
        actions={(
          <>
            {activeVisit ? (
              <Button variant="primary" onClick={() => window.location.hash = `visit:${activeVisit.id}`}>
                Oppdrag pågår — åpne
              </Button>
            ) : (
              isAdmin ? <Button type="button" className="btn-icon" onClick={() => setCreatingVisit(v => !v)}><IconPlus /> Nytt</Button> : null
            )}
            {isAdmin && (
              <Button variant="danger" type="button" onClick={handleDeactivate} style={{ marginLeft: 8 }}>Deaktiver</Button>
            )}
            <Button type="button" className="btn-icon" onClick={() => load({ silent: true })}><IconRefresh /> Oppdater</Button>
          </>
        )}
      />
      <Card>
        <h2 style={{ marginTop: 0 }}>{customer.name}</h2>
        <div>{customer.address}</div>
        <div>{customer.postal_code} {customer.city}</div>
        <div style={{ marginTop: 6 }}>
          <div>Kontakt: {customer.contact_person || '-'}</div>
          <div>E-post: {customer.email || '-'} · Telefon: {customer.phone || '-'}</div>
        </div>
        <div style={{ marginTop: 10 }}>
          {activeVisit ? (
            <span style={{ fontSize:12, color:'#475569' }}>Aktivt oppdrag: {activeVisit.visit_date ? new Date(activeVisit.visit_date).toLocaleString() : '-'}</span>
          ) : null}
          {customer.created_at ? (
            <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>Opprettet: {new Date(customer.created_at).toLocaleDateString()}</div>
          ) : null}
        </div>
        {creatingVisit && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
            <CreateVisitInline customerId={customerId} onCreated={(v) => { setCreatingVisit(false); if (v && v.id) window.location.hash = `visit:${v.id}` }} />
          </div>
        )}
      </Card>

      <Card title="Deaktiver kunde">
        <div style={{ color: '#b91c1c', fontSize: 13 }}>Deaktivere kunden slik at den ikke lenger vises i standard lister; dette er reversibelt via reaktivering.</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          {isAdmin ? (
            <Button variant="danger" onClick={async () => {
              if (!window.confirm(`Deaktivere kunden "${customer.name}" (ID: ${customer.id})? Du kan reaktivere senere.`)) return
              try {
                await CustomersAPI.delete(customer.id)
                toast.push({ variant: 'success', title: 'Deaktivert', description: 'Kunden ble deaktivert.' })
                // If the user opened this customer from the map, return to the map; otherwise go to customers list
                try {
                  const fromMap = sessionStorage.getItem('bsk:fromMap')
                  if (fromMap && String(fromMap) === String(customer.id)) {
                    sessionStorage.removeItem('bsk:fromMap')
                    window.location.hash = 'map'
                  } else {
                    window.location.hash = 'customers'
                  }
                } catch (e) {
                  // fallback
                  window.location.hash = 'customers'
                }
              } catch (e) {
                console.debug(e)
                const msg = e?.response?.data?.error || e?.message || 'Kunne ikke deaktivere kunde.'
                toast.push({ variant: 'error', title: 'Feil', description: String(msg) })
              }
            }}>Deaktiver kunde</Button>
          ) : (
            <div style={{ color: '#475569' }}>Kun administratorer kan deaktivere kunder.</div>
          )}
        </div>
      </Card>

  <Card title="Rediger kunde">
        {!showEditCustomer ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Klikk for å redigere kundedetaljer.</div>
            <div>
      <Button type="button" onClick={() => setShowEditCustomer(true)}><IconEdit /> Rediger</Button>
            </div>
          </div>
        ) : (
          <form className="stack" style={{ gap: 8 }} onSubmit={onSaveCustomer}>
            <label><div>Navn</div><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
            <label><div>Adresse</div><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}><div>Postnr</div><input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} /></label>
              <label style={{ flex: 1 }}><div>Sted</div><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}><div>E-post</div><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
              <label style={{ flex: 1 }}><div>Telefon</div><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}><div>Org.nr</div><input value={form.org_number} onChange={e => setForm(f => ({ ...f, org_number: e.target.value }))} placeholder="999 999 999" /></label>
              <div style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}><div>Besøk pr år</div><input type="number" min="0" value={form.visits_per_year} onChange={e => setForm(f => ({ ...f, visits_per_year: e.target.value }))} /></label>
              <label style={{ flex: 1 }}><div>Startdato</div><input value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" type="submit">Lagre</Button>
              <Button type="button" onClick={() => setShowEditCustomer(false)}>Avbryt</Button>
            </div>

            {/* Posisjonsverktøy: manuell flytting eller forsøk geokoding */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Posisjon</div>
              <div style={{ color: '#475569', fontSize: 13, marginBottom: 8 }}>Flytt markør manuelt på kartet, eller forsøk geokoding basert på adresse.</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Button type="button" onClick={() => {
                  try { if (moveMarkerRef.current) { mapRef.current?.removeLayer(moveMarkerRef.current); moveMarkerRef.current = null } } catch(e) { console.debug(e) }
                  const map = mapRef.current; if (!map) return;
                  const start = (() => {
                    const toNum = v => { if (v == null) return null; const s = String(v).replace(',', '.').trim(); const n = Number(s); return Number.isFinite(n) ? n : null };
                    const cLat = toNum(form.latitude ?? data?.customer?.latitude);
                    const cLng = toNum(form.longitude ?? data?.customer?.longitude);
                    if (cLat != null && cLng != null) return [cLat, cLng];
                    const center = map.getCenter(); return [center.lat, center.lng];
                  })();
                  const m = L.marker(start, { draggable: true });
                  m.addTo(map); moveMarkerRef.current = m;
                  const html = `<div style="min-width:200px"><div style="font-size:12px;color:#475569;margin-bottom:6px">Flytt kundemarkør til korrekt posisjon.</div><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="btn-cancel-move" style="padding:4px 8px;font-size:12px">Avbryt</button><button type="button" class="btn-save-move" style="padding:4px 8px;font-size:12px">Lagre posisjon</button></div></div>`;
                  m.bindPopup(html, { closeButton: false });
                  m.on('popupopen', () => {
                    const root = m.getPopup().getElement();
                    const btnSave = root.querySelector('.btn-save-move');
                    const btnCancel = root.querySelector('.btn-cancel-move');
                    if (btnSave) btnSave.addEventListener('click', async (ev) => {
                      ev.preventDefault(); ev.stopPropagation();
                      try {
                        const ll = m.getLatLng();
                        await CustomersAPI.fixGeo(customerId, ll.lat, ll.lng);
                        toast.push({ variant:'success', title:'Lagret', description:'Kundeposisjon oppdatert.' });
                        try { map.removeLayer(m); moveMarkerRef.current = null } catch{}
                        await load({ silent:true });
                      } catch (e) {
                        console.debug(e);
                        toast.push({ variant:'error', title:'Feil', description:'Kunne ikke lagre posisjon.' });
                      }
                    }, { once:true });
                    if (btnCancel) btnCancel.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); try { map.removeLayer(m); moveMarkerRef.current = null } catch{} }, { once:true });
                  });
                  try { m.openPopup() } catch{}
                }}>Flytt manuelt</Button>

                <Button type="button" onClick={async () => {
                  try {
                    const addr = [form.address || data?.customer?.address || '', form.postal_code || data?.customer?.postal_code || '', form.city || data?.customer?.city || '', 'Norge']
                      .map(s => String(s||'').trim()).filter(Boolean).join(', ');
                    if (!addr) { toast.push({ variant:'error', title:'Mangler adresse', description:'Fyll inn adresse, postnr og sted først.' }); return; }
                    // Nominatim enkel geokoding (rate-limits gjelder)
                    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=no&q=${encodeURIComponent(addr)}`;
                    const resp = await fetch(url, { headers: { 'Accept':'application/json' } });
                    if (!resp.ok) throw new Error('Geokoding feilet');
                    const js = await resp.json();
                    const hit = Array.isArray(js) && js[0];
                    if (!hit || !hit.lat || !hit.lon) { toast.push({ variant:'error', title:'Ingen treff', description:'Fant ikke posisjon for adressen.' }); return; }
                    const lat = Number(hit.lat), lon = Number(hit.lon);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { toast.push({ variant:'error', title:'Ugyldig koordinat', description:'Geokoding ga ugyldige koordinater.' }); return; }
                    await CustomersAPI.fixGeo(customerId, lat, lon);
                    toast.push({ variant:'success', title:'Geokoding', description:'Kundeposisjon oppdatert fra adresse.' });
                    await load({ silent:true });
                    try { const map = mapRef.current; if (map) map.setView([lat, lon], 16) } catch{}
                  } catch (e) {
                    console.debug(e);
                    toast.push({ variant:'error', title:'Geokoding feilet', description:'Prøv manuell plassering.' });
                  }
                }}>Forsøk geokoding</Button>
              </div>
            </div>
          </form>
        )}
      </Card>

  <Card title="Kart og utstyr">
        <div>
          <div style={{ height: 360, borderRadius: 8, overflow: 'hidden' }}>
            <div ref={mapEl} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Button type="button" onClick={() => {
                if (!addingEq) {
                  setAddingEq(true)
                  const map = mapRef.current
                  if (map) {
                    try { if (moveMarkerRef.current) { map.removeLayer(moveMarkerRef.current); moveMarkerRef.current = null } } catch (e) { console.debug(e) }
                    const start = map.getCenter()
                    const m = L.marker(start, { draggable: true })
                    m.addTo(map); moveMarkerRef.current = m
                    const popupHtml = `
                      <div style="min-width:260px">
                        <div style="font-size:12px;color:#475569;margin-bottom:6px">Flytt ny markør til riktig sted, velg type og egenskaper.</div>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Navn
                          <input class="new-eq-name" placeholder="F.eks. Åtestasjon ved inngang" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" />
                        </label>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Type
                          <select class="new-eq-type" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px"><option value="">Velg…</option></select>
                        </label>
                        <a href="#" class="toggle-props" style="font-size:12px;color:#2563eb;display:block;margin-top:6px">Vis detaljer</a>
                        <div class="new-eq-props" style="display:none;margin-bottom:6px"></div>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Plassering (beskrivelse)
                          <input class="new-eq-notes" placeholder="Hvor står utstyret? (f.eks. bak dør, ved søppeldunk)" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" />
                        </label>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Bilde (valgfritt, kun mobil)
                          <input accept="image/*" capture="environment" type="file" class="new-eq-photo" style="width:100%;margin-top:6px" />
                        </label>
                        <div class="new-eq-photo-preview" style="margin-top:6px"></div>
                        <div style="display:flex;gap:6px;justify-content:flex-end">
                          <button type="button" class="btn-cancel-new" style="padding:6px 10px;font-size:13px">Avbryt</button>
                          <button type="button" class="btn-save-new" style="padding:6px 10px;font-size:13px">Lagre</button>
                        </div>
                      </div>`
                    m.bindPopup(popupHtml, { closeButton: false })
                    m.on('popupopen', () => {
                      const root = m.getPopup().getElement()
                      const btnSave = root.querySelector('.btn-save-new')
                      const btnCancel = root.querySelector('.btn-cancel-new')
                      const input = root.querySelector('.new-eq-name')
                      const selType = root.querySelector('.new-eq-type')
                      const propsBox = root.querySelector('.new-eq-props')
                      const notesInput = root.querySelector('.new-eq-notes')
                      const photoInput = root.querySelector('.new-eq-photo')

                      const renderProps = async (typeObj) => {
                        if (!propsBox) return
                        const fields = (typeObj && Array.isArray(typeObj.fields)) ? typeObj.fields : []
                        if (!fields.length) { propsBox.innerHTML = ''; return }
                        const parts = []
                        fields.forEach(f => {
                          const key = (f.key || '').trim()
                          const label = (f.label || key || 'Felt')
                          const t = (f.type || 'text')
                          if (!key) return
                          if (t === 'boolean') {
                            parts.push(`<label style="display:flex;align-items:center;gap:6px;margin:6px 0"><input type="checkbox" class="prop-${key}" /> <span>${label}</span></label>`)
                          } else if (t === 'select') {
                            const opts = (f.options || []).map(o => `<option value="${String(o)}">${String(o)}</option>`).join('')
                            parts.push(`<label style="display:block;margin:6px 0">${label}<select class="prop-${key}" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px">${opts}</select></label>`)
                          } else {
                            const itype = (t === 'number') ? 'number' : 'text'
                            const step = (t === 'number') ? ' step="any"' : ''
                            parts.push(`<label style="display:block;margin:6px 0">${label}<input type="${itype}"${step} class="prop-${key}" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" /></label>`)
                          }
                        })
                        // If Åtekasse, render bait config controls on top
                        let baitHtml = ''
                        try {
                          const isBaitBox = (typeObj?.name || '').toLowerCase().includes('åtekasse')
                          if (isBaitBox) {
                            // Fetch materials lists
                            const [poisons, nonpoisons] = await Promise.all([
                              window.__materialsGift || MaterialsAPI.list('Giftåte').then(r => (window.__materialsGift = r)),
                              window.__materialsGiftfritt || MaterialsAPI.list('Giftfritt Åte').then(r => (window.__materialsGiftfritt = r)),
                            ])
                            const opt = (arr) => (arr||[]).map(m => `<option value="${m.id}">${m.name}</option>`).join('')
                            baitHtml = `
                              <fieldset style="margin:6px 0;padding:8px;border:1px solid #e2e8f0;border-radius:6px">
                                <legend style="font-size:12px;color:#475569">Åte-konfigurasjon</legend>
                                <label style="display:flex;align-items:center;gap:6px;margin:6px 0"><input type="checkbox" class="prop-inneholder_giftaate" /> <span>Inneholder Giftåte</span></label>
                                <div class="bait-poison" style="display:none;margin-left:14px">
                                  <label style="display:block;margin:6px 0">Standard Giftåte<select class="prop-standard_giftaate_id" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px"><option value="">Velg…</option>${opt(poisons)}</select></label>
                                </div>
                                <label style="display:flex;align-items:center;gap:6px;margin:6px 0"><input type="checkbox" class="prop-inneholder_giftfritt_aate" /> <span>Inneholder Giftfritt Åte</span></label>
                                <div class="bait-nonpoison" style="display:none;margin-left:14px">
                                  <label style="display:block;margin:6px 0">Standard Giftfritt Åte<select class="prop-standard_giftfritt_aate_id" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px"><option value="">Velg…</option>${opt(nonpoisons)}</select></label>
                                </div>
                              </fieldset>`
                          }
                        } catch (e) { console.debug(e) }
                        propsBox.innerHTML = baitHtml + parts.join('')
                        // wire bait toggles
                        try {
                          const pChk = propsBox.querySelector('.prop-inneholder_giftaate')
                          const pBox = propsBox.querySelector('.bait-poison')
                          if (pChk && pBox) pChk.addEventListener('change', ()=> { pBox.style.display = pChk.checked ? 'block' : 'none' })
                          const npChk = propsBox.querySelector('.prop-inneholder_giftfritt_aate')
                          const npBox = propsBox.querySelector('.bait-nonpoison')
                          if (npChk && npBox) npChk.addEventListener('change', ()=> { npBox.style.display = npChk.checked ? 'block' : 'none' })
                        } catch(e){ console.debug(e) }
                      }

                      const populateTypes = async () => {
                        try {
                          const cached = typesRef.current
                          const types = cached || await EquipmentTypesAPI.list()
                          if (!cached) typesRef.current = types
                          if (selType) {
                            selType.innerHTML = '<option value="">Velg type</option>' + (types || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('')
                            selType.addEventListener('change', () => {
                              const id = Number(selType.value)
                              const found = (types || []).find(t => t.id === id)
                              // Render props for the newly selected type but keep them hidden until user toggles
                              renderProps(found)
                              try { if (propsBox) propsBox.style.display = 'none' } catch (e) { console.debug(e) }
                              try { const tlink = root.querySelector('.toggle-props'); if (tlink) tlink.textContent = 'Vis detaljer' } catch (e) { console.debug(e) }
                            })
                          }
                        } catch (e) {
                          console.debug(e)
                          if (selType) selType.innerHTML = '<option value="">(Ingen typer)</option>'
                        }
                      }
                      populateTypes()

                      // Toggle link to show/hide advanced property inputs
                      const toggle = root.querySelector('.toggle-props')
                      if (toggle) {
                        toggle.addEventListener('click', (_ev) => {
                          _ev.preventDefault(); _ev.stopPropagation()
                          try {
                            if (!propsBox) return
                            if (propsBox.style.display === 'none' || propsBox.style.display === '') {
                              propsBox.style.display = 'block'
                              toggle.textContent = 'Skjul detaljer'
                            } else {
                              propsBox.style.display = 'none'
                              toggle.textContent = 'Vis detaljer'
                            }
                          } catch (e) { console.debug(e) }
                        }, { once: false })
                      }

                      if (btnSave) btnSave.addEventListener('click', async (_ev) => {
                        _ev.preventDefault(); _ev.stopPropagation()
                        const name = (input?.value || '').trim() || 'Utstyr'
                        const typeId = selType && selType.value ? Number(selType.value) : null
                        const types = typesRef.current || []
                        const typeObj = (types || []).find(t => t.id === typeId)
                        const properties = {}
                          if (typeObj && Array.isArray(typeObj.fields)) {
                          typeObj.fields.forEach(f => {
                            const key = (f.key || '').trim()
                            if (!key) return
                            const el = root.querySelector(`.prop-${key}`)
                            if (!el) return
                            const t = (f.type || 'text')
                            if (t === 'boolean') properties[key] = !!el.checked
                            else if (t === 'number') properties[key] = (el.value === '' ? null : Number(el.value))
                            else properties[key] = el.value
                          })
                        }
                          // Save bait config into properties if present
                          try {
                            const pChk = root.querySelector('.prop-inneholder_giftaate'); if (pChk) properties.inneholder_giftaate = !!pChk.checked
                            const pSel = root.querySelector('.prop-standard_giftaate_id'); if (pSel && pSel.value) properties.standard_giftaate_id = Number(pSel.value)
                            const npChk = root.querySelector('.prop-inneholder_giftfritt_aate'); if (npChk) properties.inneholder_giftfritt_aate = !!npChk.checked
                            const npSel = root.querySelector('.prop-standard_giftfritt_aate_id'); if (npSel && npSel.value) properties.standard_giftfritt_aate_id = Number(npSel.value)
                          } catch (e) { console.debug(e) }
                        const ll = m.getLatLng()
                        try {
                          const payload = { customer_id: customerId, name, latitude: ll.lat, longitude: ll.lng }
                          if (notesInput) payload.notes = (notesInput.value || '').trim() || undefined
                          if (typeId) { payload.equipment_type_id = typeId; payload.type = typeObj?.name }
                          if (typeObj) { payload.properties = properties }
                          // If a photo file is present, attach it as data URL
                          if (photoInput && photoInput.files && photoInput.files[0]) {
                            const f = photoInput.files[0]
                            // read synchronously via FileReader isn't possible here; create a promise to await
                            const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
                              const r = new FileReader()
                              r.onload = () => resolve(r.result)
                              r.onerror = reject
                              r.readAsDataURL(file)
                            })
                            try {
                              const dataUrl = await readFileAsDataURL(f)
                              payload.placement_photo = dataUrl
                            } catch (e) {
                              console.debug(e)
                              // ignore and continue
                            }
                          }
                          await EquipmentAPI.create(payload)
                          toast.push({ variant: 'success', title: 'Lagret', description: 'Nytt utstyr opprettet.' })
                          try { map.removeLayer(m); moveMarkerRef.current = null } catch (e) { console.debug(e) }
                          setAddingEq(false)
                          await load({ silent: true })
                        } catch (e) {
                          console.debug(e)
                          toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke opprette utstyr.' })
                        }
                      }, { once: true })
                      if (btnCancel) btnCancel.addEventListener('click', (_ev) => {
                        _ev.preventDefault(); _ev.stopPropagation()
                          try { map.removeLayer(m); moveMarkerRef.current = null } catch (e) { console.debug(e) }
                        setAddingEq(false)
                      }, { once: true })
                    })
                    m.openPopup()
                  }
                }
              }}>+ Legg til nytt utstyr</Button>
            </div>
            <div>
              <Button type="button" onClick={() => { try { mapRef.current?.invalidateSize(true) } catch (e) { console.debug(e) } }}>Oppdater kart</Button>
            </div>
          </div>
          {isAdmin && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Admin: Tilordne nærliggende utstyr til denne kunden</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <label className="stack" style={{ gap:4 }}>
                  <div>Avstandsterskel (meter)</div>
                  <input className="input" type="number" min="1" value={assignMeters} onChange={e => setAssignMeters(Number(e.target.value || 0))} style={{ width: 160 }} />
                </label>
                <Button type="button" disabled={assignLoading} onClick={async () => {
                  if (!Number.isFinite(assignMeters) || assignMeters <= 0) { toast.push({ variant:'error', title:'Ugyldig terskel', description:'Skriv inn en positiv avstand i meter.' }); return }
                  setAssignLoading(true)
                  try {
                    const probe = await EquipmentAPI.assignToCustomerByCoords(customerId, { max_distance_m: assignMeters, dry_run: true })
                    const n = Array.isArray(probe?.items) ? probe.items.length : 0
                    if (n === 0) {
                      toast.push({ variant:'info', title:'Ingen endringer', description:'Ingen utstyr innenfor valgt terskel.' })
                      return
                    }
                    const preview = (probe.items || []).slice(0, 6).map(x => `#${x.equipment_id} (${x.distance_meters}m)`).join(', ')
                    const msg = `Foreslåtte endringer: ${n} utstyr vil tilordnes denne kunden. ${preview ? `\nEksempler: ${preview}` : ''}\n\nVil du fortsette?`
                    const ok = window.confirm(msg)
                    if (!ok) return
                    const res = await EquipmentAPI.assignToCustomerByCoords(customerId, { max_distance_m: assignMeters })
                    const changed = Number(res?.changed_count || 0)
                    toast.push({ variant:'success', title:'Tilordnet', description:`${changed} utstyr tilordnet denne kunden.` })
                    await load({ silent: true })
                  } catch (e) {
                    console.debug(e)
                    const msg = e?.response?.data?.error || e?.message || 'Kunne ikke tilordne utstyr'
                    toast.push({ variant:'error', title:'Feil', description: String(msg) })
                  } finally {
                    setAssignLoading(false)
                  }
                }}>{assignLoading ? 'Kjører…' : 'Tilordne nærliggende utstyr'}</Button>
              </div>
              <div style={{ color:'#475569', fontSize:12, marginTop:6 }}>Vi gjør først en «dry-run» og ber om bekreftelse før endringer lagres.</div>
            </div>
          )}
          {/* Utstyr vises kun på kartet. Bruk markørene for handlinger (Flytt, Rediger, Slett). */}
          <div style={{ marginTop: 12 }}>
            {!data.equipment?.length ? <Empty>Ingen registrert utstyr.</Empty> : (
              <div style={{ color: '#475569', fontSize: 13 }}>Utstyret vises på kartet. Klikk en markør for handlinger (Flytt / Rediger / Slett).</div>
            )}
          </div>
        </div>
      </Card>

  <Card title="Servicehistorikk">
        {!showVisits ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Klikk for å vise servicehistorikk.</div>
            <div>
      <Button type="button" onClick={() => setShowVisits(true)}><IconChevronDown /> Vis</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Historikk</div>
      <div><Button type="button" onClick={() => setShowVisits(false)}><IconChevronUp /> Skjul</Button></div>
            </div>
            <div style={{ marginTop: 8 }}>
              {!data.visits?.length ? <Empty>Ingen besøk registrert.</Empty> : (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
                      <input
                        type="checkbox"
                        checked={(() => {
                          const planned = (data.visits||[]).filter(v => (v.status||'') === 'Planlagt')
                          return planned.length > 0 && planned.every(v => selectedVisits.includes(v.id))
                        })()}
                        onChange={(e) => {
                          const plannedIds = (data.visits||[]).filter(v => (v.status||'') === 'Planlagt').map(v => v.id)
                          setSelectedVisits(e.target.checked ? plannedIds : [])
                        }}
                      />
                      <span>Velg alle planlagte</span>
                    </label>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!selectedVisits.length}
                      onClick={async () => {
                        if (!selectedVisits.length) return;
                        if (!window.confirm(`Slette ${selectedVisits.length} planlagte oppdrag?`)) return;
                        try {
                          const res = await VisitsAPI.batchDelete(selectedVisits)
                          toast.push({ variant:'success', title:'Slettet', description:`Fjernet ${res.deleted_count} oppdrag${res.skipped_ids?.length ? `, hoppet over ${res.skipped_ids.length}`:''}.` })
                          setSelectedVisits([])
                          await load({ silent:true })
                        } catch (e) {
                          console.debug(e)
                          toast.push({ variant:'error', title:'Feil', description:'Kunne ikke slette valgte oppdrag.' })
                        }
                      }}
                    >Slett valgte</Button>
                  </div>
                  <ul className="list">
                    {data.visits.map(v => (
                      <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {(v.status||'') === 'Planlagt' ? (
                            <input
                              type="checkbox"
                              checked={selectedVisits.includes(v.id)}
                              onChange={(e) => {
                                setSelectedVisits(prev => e.target.checked ? Array.from(new Set([...prev, v.id])) : prev.filter(x => x !== v.id))
                              }}
                              aria-label="Velg besøk"
                            />
                          ) : <div style={{ width: 16 }} />}
                          <div>
                            <div style={{ fontWeight: 600 }}>{v.title || 'Besøk'}</div>
                            <div style={{ fontSize: 13, color: '#475569' }}>{v.visit_date ? new Date(v.visit_date).toLocaleString() : '-'} - {v.status || 'Planlagt'} {v.technician ? `(${v.technician})` : ''}</div>
                          </div>
                        </div>
                        <div style={{ whiteSpace:'nowrap' }}>
                          <Button size="sm" onClick={() => window.location.hash = `visit:${v.id}`}>Åpne</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

  <Card title="Servicerapporter (PDF)">
        {!showReports ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Klikk for å vise genererte rapporter.</div>
            <div>
      <Button type="button" onClick={() => setShowReports(true)}><IconChevronDown /> Vis</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Rapporter</div>
      <div><Button type="button" onClick={() => setShowReports(false)}><IconChevronUp /> Skjul</Button></div>
            </div>
            <div style={{ marginTop: 8 }}>
              {!data.reports?.length ? <Empty>Ingen rapporter generert ennå.</Empty> : (
                <ul className="list">
                  {data.reports.map(r => (
                    <li key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>Rapport #{r.id}</div>
                        <div style={{ fontSize: 13, color:'#475569' }}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
                      </div>
                      <div>
                        <a className="btn" href={r.url || r.file_path} target="_blank" rel="noopener noreferrer">Åpne PDF</a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

  <Card title="Logger">
        {!showLogs ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Klikk for å vise logger.</div>
            <div>
      <Button type="button" onClick={() => setShowLogs(true)}><IconChevronDown /> Vis</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Logger</div>
      <div><Button type="button" onClick={() => setShowLogs(false)}><IconChevronUp /> Skjul</Button></div>
            </div>
            <div style={{ marginTop: 8 }}>
              {!data.logs?.length ? <Empty>Ingen logger.</Empty> : (
                <ul className="list">
                  {data.logs.map(l => (
                    <li key={l.id}>{l.log_date ? new Date(l.log_date).toLocaleString() : '-'} - {l.description?.slice(0, 120)}{l.equipment_name ? ` - ${l.equipment_name}` : ''}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      <div>
        <Button onClick={() => window.history.back()}>Tilbake</Button>
      </div>
    </div>
  )
}

function CreateVisitInline({ customerId, onCreated }){
  const [date, setDate] = useState(() => {
    try {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16)
    } catch { return '' }
  })
  const [notes, setNotes] = useState('')
  const [techs, setTechs] = useState([])
  const [techId, setTechId] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { (async ()=>{ try { setTechs(await EmployeesAPI.list()) } catch {} })() }, [])
  const save = async () => {
    if (!date) return alert('Velg dato/tid')
    setLoading(true)
    try {
      const payload = { customer_id: customerId, visit_date: new Date(date).toISOString(), notes: notes || undefined }
      if (techId) payload.assigned_technician_id = Number(techId)
      const v = await VisitsAPI.office.create(payload)
      onCreated && onCreated(v)
    } catch (e) {
      alert('Kunne ikke opprette oppdrag')
    } finally { setLoading(false) }
  }
  return (
    <div style={{ display:'grid', gap:8, gridTemplateColumns:'1fr 1fr', alignItems:'end' }}>
      <label className="stack" style={{ gap:4 }}>
        <div>Dato og tid</div>
        <input className="input" type="datetime-local" value={date} onChange={e=> setDate(e.target.value)} />
      </label>
      <label className="stack" style={{ gap:4 }}>
        <div>Tekniker</div>
        <select className="input" value={techId} onChange={e=> setTechId(e.target.value)}>
          <option value="">(ingen)</option>
          {(techs||[]).map(t => <option key={t.id} value={t.id}>{t.name || t.email}</option>)}
        </select>
      </label>
      <label className="stack" style={{ gap:4, gridColumn:'1 / -1' }}>
        <div>Notat</div>
        <input className="input" value={notes} onChange={e=> setNotes(e.target.value)} placeholder="Telefonoppdrag, hastejobb…" />
      </label>
      <div style={{ display:'flex', gap:8, gridColumn:'1 / -1', justifyContent:'flex-end' }}>
        <Button type="button" onClick={save} disabled={loading}>{loading ? 'Oppretter…' : 'Opprett oppdrag'}</Button>
      </div>
    </div>
  )
}
