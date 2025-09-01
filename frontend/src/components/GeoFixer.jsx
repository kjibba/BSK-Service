import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CustomersAPI, MapAPI } from '../api';
import PageHeader from './ui/PageHeader';
import { IconRefresh } from './ui/icons';
import Card from './ui/Card';

// Simple compact marker for dragging
const dragIcon = L.divIcon({ className: 'drag-marker', html: '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #0f172a"></div>', iconSize: [18,18], iconAnchor: [9,9] });

export default function GeoFixer(){
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState(''); // search query for filtering customers
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState('');

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapEl = useRef(null);

  // Load customers with coordinates (for easier spotting) and also those without
  const load = useCallback(async (opts) => {
    try {
      const all = await CustomersAPI.list();
      // Prefer those missing coords first
      const missing = all.filter(c => c.latitude == null || c.longitude == null);
      const withCoords = all.filter(c => c.latitude != null && c.longitude != null);
      setCustomers([...missing, ...withCoords]);
      if (missing.length) setSelectedId(missing[0].id);
    } catch (e) {
      setError('Kunne ikke hente kunder: ' + e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => customers.find(c => c.id === selectedId) || null, [customers, selectedId]);

  // Build a filtered and prioritized list based on the search query.
  // We search across name, address, city, postal code. Missing-coord customers are shown first.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = customers.slice();
    const matches = q
      ? pool.filter(c => {
          const fields = [c.name, c.address, c.city, c.postal_code].filter(Boolean).join(' ').toLowerCase();
          return fields.includes(q);
        })
      : pool;
    // Sort: missing coords first, then by name
    matches.sort((a, b) => {
      const am = (a.latitude == null || a.longitude == null) ? 0 : 1;
      const bm = (b.latitude == null || b.longitude == null) ? 0 : 1;
      if (am !== bm) return am - bm;
      return (a.name || '').localeCompare(b.name || '');
    });
    return matches;
  }, [customers, query]);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    const map = L.map(mapEl.current, { center: [60.39299, 5.32415], zoom: 9, minZoom: 2, maxZoom: 22 });
    // Use OSM tiles here to avoid requiring Google key in the admin tool
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    mapRef.current = map;
  }, []);

  // When a customer is selected, set form and marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = selected;
    if (!c) return;
    const currLat = c.latitude ?? 60.39299;
    const currLng = c.longitude ?? 5.32415;
    setLat(String(currLat));
    setLng(String(currLng));

    // Clear previous marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    const m = L.marker([currLat, currLng], { draggable: true, icon: dragIcon }).addTo(map);
    m.on('dragend', () => {
      const p = m.getLatLng();
      setLat(p.lat.toFixed(6));
      setLng(p.lng.toFixed(6));
    });
    markerRef.current = m;
    map.setView([currLat, currLng], c.latitude && c.longitude ? Math.max(map.getZoom(), 15) : 12);
  }, [selectedId, selected]);

  const save = async () => {
    setError(null); setOk(''); setSaving(true);
    try {
      const latF = parseFloat(lat); const lngF = parseFloat(lng);
      if (Number.isNaN(latF) || Number.isNaN(lngF)) throw new Error('Ugyldige tall for lat/lng');
      await CustomersAPI.fixGeo(selectedId, latF, lngF);
      setOk('Lagret nye koordinater');
      // Update local list
      setCustomers(prev => prev.map(c => c.id === selectedId ? { ...c, latitude: latF, longitude: lngF } : c));
    } catch (e) {
      setError(e.message || 'Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
  <PageHeader title="Fiks geokoding" actions={(<button className="btn btn-icon" type="button" onClick={() => load({ silent: true })}><IconRefresh /> Oppdater</button>)} />
      <Card>
        <p>Velg kunde med feil plassering og dra markøren til riktig posisjon. Lagre for å oppdatere koordinater.</p>
      <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'center'}}>
        {/* Search input to quickly narrow down customers */}
        <input
          placeholder="Søk etter navn, adresse eller poststed…"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          style={{minWidth:280, flex:'1 1 260px'}}
        />
        {/* Filtered dropdown fed by the search above */}
        <select value={selectedId || ''} onChange={e=>setSelectedId(Number(e.target.value))} style={{minWidth:260}}>
          <option value="" disabled>Velg kunde…</option>
          {filtered.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} {c.address ? `— ${c.address}` : ''} { (c.latitude==null||c.longitude==null) ? '(mangler koordinater)' : '' }
            </option>
          ))}
        </select>
        <span style={{fontSize:12, color:'#475569'}}>Viser {filtered.length} av {customers.length}</span>
        <input style={{maxWidth:140}} placeholder="Lat" value={lat} onChange={e=>setLat(e.target.value)} />
        <input style={{maxWidth:160}} placeholder="Lng" value={lng} onChange={e=>setLng(e.target.value)} />
        <button onClick={save} disabled={!selectedId || saving}>Lagre</button>
      </div>
      {error && <div style={{color:'#b91c1c', marginTop:8}}>Feil: {error}</div>}
      {ok && <div style={{color:'#166534', marginTop:8}}>{ok}</div>}

      <div style={{marginTop:12}}>
        <div ref={mapEl} className="map-container" />
      </div>
      </Card>
    </div>
  );
}
