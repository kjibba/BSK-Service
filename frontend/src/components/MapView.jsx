import { useEffect, useMemo, useRef, useState } from 'react';
import { MapAPI } from '../api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';

// Simple colored marker icons using Leaflet DivIcon
const makeIcon = (color) => L.divIcon({
  className: 'status-marker',
  html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #0f172a;box-shadow:0 0 0 2px rgba(255,255,255,0.7);"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

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
      const status = statusFor(c.next_visit_date);
      const icon = status === 'green' ? greenIcon : status === 'yellow' ? yellowIcon : redIcon;
      const m = L.marker([c.latitude, c.longitude], { icon });
      const nextText = c.next_visit_date ? new Date(c.next_visit_date).toLocaleString() : 'Ikke planlagt';
  const html = `<div style="min-width:200px"><strong>${c.name ?? ''}</strong><div>${c.address ?? ''}</div><div style="margin-top:8px">Neste service: ${nextText}</div><div style="margin-top:6px"><a href="#customer:${c.id}">Åpne kundekort</a></div></div>`;
      m.bindPopup(html);
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
        <strong>Fargekoder:</strong>
        <div><span className="dot" style={{background:'#16a34a'}}></span>OK</div>
        <div><span className="dot" style={{background:'#f59e0b'}}></span>Neste service ≤ 30 dager</div>
        <div><span className="dot" style={{background:'#dc2626'}}></span>Forbi frist / mangler plan</div>
      </div>
      <div ref={mapEl} className="map-container" />
    </div>
  );
}
