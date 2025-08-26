import { useEffect, useMemo, useRef, useState } from 'react';
import { MapAPI, VisitsAPI, EmployeesAPI } from '../api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';

// Simple colored marker icons using Leaflet DivIcon
const makeIcon = (color) => {
  try {
    return L.divIcon({
      className: 'leaflet-div-icon status-marker',
      // thin white ring around colored dot; keep it minimal to avoid layout issues
      html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 0 2px rgba(255,255,255,0.9);"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
  } catch (e) {
    // Fallback without ring if something about style/html crashes in this environment
    // eslint-disable-next-line no-console
    console.error('makeIcon failed, falling back without ring:', e)
    return L.divIcon({ className: 'leaflet-div-icon status-marker', html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};"></span>`, iconSize: [18,18], iconAnchor:[9,9] })
  }
}

const greenIcon = makeIcon('#16a34a');
const yellowIcon = makeIcon('#f59e0b');
const redIcon = makeIcon('#dc2626');

const statusFor = (nextVisitIso) => {
  if (!nextVisitIso) return 'red'; // no planned visit -> overdue/unknown
  const now = new Date();
  const next = new Date(nextVisitIso);
  const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return 'red';
  if (diffDays <= 30) return 'yellow';
  return 'green';
};

export default function MapView() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const didFitRef = useRef(false);
  const layerCtrlRef = useRef(null);
  const userInteractedRef = useRef(false);
  const activeBaseRef = useRef('google_sat');
  const [baseReady, setBaseReady] = useState(false);

  useEffect(() => {
  const load = async () => {
      try {
    const data = await MapAPI.customers();
        setCustomers(data);
      } catch (e) {
        setError('Kunne ikke hente kunder til kart. ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const center = useMemo(() => {
    if (!customers.length) return [60.39299, 5.32415]; // Bergen approx
    const lat = customers.reduce((sum, c) => sum + (c.latitude || 0), 0) / customers.length;
    const lng = customers.reduce((sum, c) => sum + (c.longitude || 0), 0) / customers.length;
    return [lat, lng];
  }, [customers]);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
  const map = L.map(mapEl.current, { center, zoom: 8, minZoom: 2, maxZoom: 24 });

    // Optionally add Google base layers if API key is present
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const ensureGoogle = () => new Promise((resolve) => {
      if (window.google && window.google.maps) return resolve();
      if (!key) return resolve();
      // Reuse existing script if present to avoid duplicate loads
      const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existing) {
        if (window.google && window.google.maps) return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve(); // fail-soft: just skip Google layers
      document.head.appendChild(s);
    });
    ensureGoogle().then(() => {
      if (window.google && L.gridLayer && L.gridLayer.googleMutant) {
        const gRoad = L.gridLayer.googleMutant({ type: 'roadmap', maxZoom: 24 });
        const gSat = L.gridLayer.googleMutant({ type: 'satellite', maxZoom: 24 });
        // Default to Google Satellite
        gSat.addTo(map);
        activeBaseRef.current = 'google_sat';
        // Keep references to toggle later
        layerCtrlRef.current = { gRoad, gSat };
        setBaseReady(true);
      } else {
        // Fallback: ensure a usable base map even without Google
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        });
        osm.addTo(map);
        layerCtrlRef.current = { osm };
        setBaseReady(true);
      }
    });
  markersRef.current = L.layerGroup().addTo(map);
  map.on('zoomstart movestart', () => { userInteractedRef.current = true; });
    mapRef.current = map;
  }, [center]);

  // Keep center updated without changing user's zoom level
  useEffect(() => {
    if (mapRef.current && center && !userInteractedRef.current) {
      mapRef.current.panTo(center);
    }
  }, [center]);

  // Update markers when data changes
  useEffect(() => {
    const group = markersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();
    customers.forEach(c => {
      // Prefer backend-provided status; fallback to client-side calc from next_visit_date
      const status = (c && c.status) ? c.status : statusFor(c.next_visit_date);
      const icon = status === 'green' ? greenIcon : status === 'yellow' ? yellowIcon : redIcon;
      let m
      try {
        m = L.marker([c.latitude, c.longitude], { icon })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Marker creation failed for customer', c?.id, err)
        return
      }
      const nextText = c.next_visit_date ? new Date(c.next_visit_date).toLocaleString() : 'Ikke planlagt';
    const expectedText = c.expected_service_date ? new Date(c.expected_service_date).toLocaleString() : 'Ukjent';
    const plannedText = c.planned_next_visit_date ? new Date(c.planned_next_visit_date).toLocaleString() : 'Ikke planlagt';
    const html = `<div style="min-width:260px"><strong>${c.name ?? ''}</strong><div>${c.address ?? ''}</div><div style="margin-top:8px"><div><strong>Forventet service:</strong> ${expectedText}</div><div style="margin-top:4px"><span style="color:#475569">Planlagt besøk:</span> ${plannedText}</div></div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><a class="btn-open" href="#customer:${c.id}">Åpne kundekort</a><button type="button" class="btn-new-visit" data-id="${c.id}" style="padding:4px 8px;font-size:12px">+ Nytt oppdrag</button></div><div class="new-visit-form" style="display:none;margin-top:8px;border-top:1px solid #e2e8f0;padding-top:8px"><label style="display:block;margin-bottom:6px;font-size:12px">Dato og tid<input type="datetime-local" class="nv-date" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" /></label><label style="display:block;margin-bottom:6px;font-size:12px">Tekniker<select class="nv-tech" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px"><option value="">(ingen)</option></select></label><label style="display:block;margin-bottom:6px;font-size:12px">Notat<input class="nv-notes" style="width:100%;box-sizing:border-box;margin-top:4px;padding:6px" /></label><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" class="nv-cancel" style="padding:4px 8px;font-size:12px">Avbryt</button><button type="button" class="nv-save" style="padding:4px 8px;font-size:12px">Opprett</button></div></div></div>`;
  try { m.bindPopup(html) } catch (err) { console.error('bindPopup failed', err) }
        m.on('popupopen', async (ev) => {
          const root = ev.popup.getElement();
          const btn = root.querySelector('.btn-new-visit');
          const formBox = root.querySelector('.new-visit-form');
          const techSel = root.querySelector('.nv-tech');
          const cancelBtn = root.querySelector('.nv-cancel');
          const saveBtn = root.querySelector('.nv-save');
          const dateInput = root.querySelector('.nv-date');
          const notesInput = root.querySelector('.nv-notes');
          if (btn && formBox) {
            btn.addEventListener('click', async (e) => {
              e.preventDefault(); e.stopPropagation();
              try { formBox.style.display = 'block'; } catch {}
              // load employees once
              if (techSel && techSel.options && techSel.options.length <= 1) {
                try {
                  const emps = await EmployeesAPI.list();
                  techSel.innerHTML = '<option value="">(ingen)</option>' + (emps || []).map(emp => `<option value="${emp.id}">${emp.name || emp.email}</option>`).join('');
                } catch {}
              }
              try {
                const now = new Date();
                const iso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
                dateInput.value = iso;
              } catch {}
            }, { once: true });
          }
          if (cancelBtn && formBox) {
            cancelBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); try { formBox.style.display = 'none'; } catch {} }, { once: true });
          }
          if (saveBtn) {
            saveBtn.addEventListener('click', async (e2) => {
              e2.preventDefault(); e2.stopPropagation();
              try {
                const visit_date = dateInput && dateInput.value ? new Date(dateInput.value).toISOString() : null;
                if (!visit_date) { alert('Velg dato og tid.'); return; }
                const payload = { customer_id: c.id, visit_date, notes: (notesInput?.value || '').trim() || undefined };
                if (techSel && techSel.value) payload.assigned_technician_id = Number(techSel.value);
                const created = await VisitsAPI.office.create(payload);
                // navigate directly to the visit or just inform
                if (created && created.id) {
                  window.location.hash = `visit:${created.id}`;
                }
              } catch (err) {
                alert('Kunne ikke opprette oppdrag.');
              }
            }, { once: true });
          }
        });
      m.addTo(group);
    });

    // On first load with data, fit bounds exactly around customers
    if (!didFitRef.current && customers.length > 0) {
      if (customers.length === 1) {
        const only = customers[0];
        map.setView([only.latitude, only.longitude], 18, { animate: false });
      } else {
        const bounds = L.latLngBounds(customers.map(c => [c.latitude, c.longitude]));
        // Minimal padding so markers are not clipped, no maxZoom cap so it can zoom in tightly
        map.fitBounds(bounds, { padding: [12, 12] });
      }
      didFitRef.current = true;
    }
  }, [customers]);

  if (loading) return <div>Laster kart…</div>;
  if (error) return <div>Feil: {error}</div>;

  return (
    <div className="map-wrapper">
  {baseReady && layerCtrlRef.current && layerCtrlRef.current.gRoad && layerCtrlRef.current.gSat && (
        <div className="map-toggle">
          <button
            className={activeBaseRef.current === 'google_sat' ? 'active' : ''}
            onClick={() => {
              const map = mapRef.current;
              if (!map || !layerCtrlRef.current) return;
              const { gRoad, gSat } = layerCtrlRef.current;
              if (activeBaseRef.current !== 'google_sat') {
                map.removeLayer(gRoad);
                gSat.addTo(map);
                activeBaseRef.current = 'google_sat';
              }
            }}
          >Google Satellitt</button>
          <button
            className={activeBaseRef.current === 'google_road' ? 'active' : ''}
            onClick={() => {
              const map = mapRef.current;
              if (!map || !layerCtrlRef.current) return;
              const { gRoad, gSat } = layerCtrlRef.current;
              if (activeBaseRef.current !== 'google_road') {
                map.removeLayer(gSat);
                gRoad.addTo(map);
                activeBaseRef.current = 'google_road';
              }
            }}
          >Google Kart</button>
        </div>
      )}
  <div className="map-legend">
        <div><span className="dot" style={{background:'#16a34a'}}></span>OK</div>
        <div><span className="dot" style={{background:'#f59e0b'}}></span>Neste service ≤ 30 dager</div>
        <div><span className="dot" style={{background:'#dc2626'}}></span>Forbi frist / mangler plan</div>
      </div>
      <div ref={mapEl} className="map-container" />
    </div>
  );
}
