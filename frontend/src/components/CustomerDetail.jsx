import { useEffect, useRef, useState, useCallback } from 'react'
import { CustomersAPI, EquipmentAPI, EquipmentTypesAPI } from '../api'
import Card from './ui/Card'
import Button from './ui/Button'
import { Loading, Empty, ErrorState } from './ui/States'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.gridlayer.googlemutant'
import { useToast } from './ui/Toast.jsx'

export default function CustomerDetail({ customerId }) {
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

  useEffect(() => { load() }, [load])

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

    equipment.forEach(e => {
      if (e._lat == null || e._lng == null) return
      const m = L.marker([e._lat, e._lng])
      const html = `<div><strong>${e.name || ''}</strong><div style="margin-top:6px;display:flex;gap:6px"><button type='button' class='btn-move' data-id='${e.id}' data-lat='${e._lat}' data-lng='${e._lng}' style='padding:4px 8px'>Flytt</button><button type='button' class='btn-edit' data-id='${e.id}' style='padding:4px 8px'>Rediger</button><button type='button' class='btn-del' data-id='${e.id}' style='padding:4px 8px'>Slett</button></div></div>`
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
  }, [data, baseReady, load, toast])

  // populate form when data arrives
  useEffect(() => {
    if (!data || !data.customer) return
    const c = data.customer
    setForm({
      name: c.name || '', address: c.address || '', postal_code: c.postal_code || '', city: c.city || '', contact_person: c.contact_person || '', email: c.email || '', phone: c.phone || '', visits_per_year: c.visits_per_year ?? '', start_date: c.start_date || '', latitude: c.latitude ?? '', longitude: c.longitude ?? ''
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
      <Card>
        <h2 style={{ marginTop: 0 }}>{customer.name}</h2>
        <div>{customer.address}</div>
        <div>{customer.postal_code} {customer.city}</div>
        <div style={{ marginTop: 6 }}>
          <div>Kontakt: {customer.contact_person || '-'}</div>
          <div>E-post: {customer.email || '-'} · Telefon: {customer.phone || '-'}</div>
        </div>
      </Card>

      <Card title="Rediger kunde">
        {!showEditCustomer ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#475569', fontSize: 13 }}>Klikk for å redigere kundedetaljer.</div>
            <div>
              <Button type="button" onClick={() => setShowEditCustomer(true)}>Rediger kunde</Button>
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
              <label style={{ flex: 1 }}><div>Besøk pr år</div><input type="number" min="0" value={form.visits_per_year} onChange={e => setForm(f => ({ ...f, visits_per_year: e.target.value }))} /></label>
              <label style={{ flex: 1 }}><div>Startdato</div><input value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" type="submit">Lagre</Button>
              <Button type="button" onClick={() => setShowEditCustomer(false)}>Avbryt</Button>
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
                        <label style="display:block;margin-bottom:6px;font-size:13px">Navn<input class="new-eq-name" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" /></label>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Type<select class="new-eq-type" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px"><option value="">Laster…</option></select></label>
                        <a href="#" class="toggle-props" style="font-size:12px;color:#2563eb;display:block;margin-top:6px">Vis detaljer</a>
                        <div class="new-eq-props" style="display:none;margin-bottom:6px"></div>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Plassering (beskrivelse)<input class="new-eq-notes" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" /></label>
                        <label style="display:block;margin-bottom:6px;font-size:13px">Bilde (kun mobil)<input accept="image/*" capture="environment" type="file" class="new-eq-photo" style="width:100%;margin-top:6px" /></label>
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

                      const renderProps = (typeObj) => {
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
                        propsBox.innerHTML = parts.join('')
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
              <Button type="button" onClick={() => setShowVisits(true)}>Vis servicehistorikk</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Historikk</div>
              <div><Button type="button" onClick={() => setShowVisits(false)}>Skjul</Button></div>
            </div>
            <div style={{ marginTop: 8 }}>
              {!data.visits?.length ? <Empty>Ingen besøk registrert.</Empty> : (
                <ul className="list">
                  {data.visits.map(v => (
                    <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{v.title || 'Besøk'}</div>
                        <div style={{ fontSize: 13, color: '#475569' }}>{v.visit_date ? new Date(v.visit_date).toLocaleString() : '-'} - {v.status || 'Planlagt'} {v.technician ? `(${v.technician})` : ''}</div>
                      </div>
                      <div><Button size="sm" onClick={() => window.location.hash = `visit:${v.id}`}>Åpne</Button></div>
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
              <Button type="button" onClick={() => setShowLogs(true)}>Vis logger</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Logger</div>
              <div><Button type="button" onClick={() => setShowLogs(false)}>Skjul</Button></div>
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
