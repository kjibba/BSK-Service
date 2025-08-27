import { useState, useEffect, useRef } from 'react';
import { CustomersAPI } from '../api';
import { Loading, ErrorState } from './ui/States';
import { RequireAuth } from './auth';

// Colors and status logic reused from MapView
const COLORS = { green: '#16a34a', yellow: '#f59e0b', red: '#dc2626' };
const statusFor = (nextVisitIso) => {
  if (!nextVisitIso) return 'red';
  const now = new Date();
  const next = new Date(nextVisitIso);
  const diffDays = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return 'red';
  if (diffDays <= 30) return 'yellow';
  return 'green';
};

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState('next'); // 'next' | 'alpha'
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef(null)

  useEffect(() => {
  const fetchCustomers = async (q) => {
      try {
        setLoading(true);
    let params = { include: 'next_visit' }
        if (sortMode === 'next') params.sort = 'next_visit'
        if (q) params.q = q
        let data = await CustomersAPI.list(params)
        if (sortMode === 'alpha') {
          // Alfabetisk klient-side sortering (norsk locale)
          data.sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'nb', { sensitivity: 'base' }));
        }
        setCustomers(data);
      } catch (e) {
        console.debug(e)
        setError('Kunne ikke hente kunder. ' + (e?.message || String(e)));
      } finally {
        setLoading(false);
        setSearching(false)
      }
    };

    // Debounce search input
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current)
    setSearching(!!searchTerm)
    searchTimeout.current = window.setTimeout(async () => {
      const q = searchTerm && searchTerm.trim() ? searchTerm.trim() : undefined
      await fetchCustomers(q)

      // If query looks like a numeric id, also attempt a direct detail lookup and merge
      if (q && /^\d+$/.test(q)) {
        try {
          const id = Number(q)
          const detail = await CustomersAPI.detail(id)
          if (detail) {
            setCustomers(prev => {
              const exists = prev.find(p => p.id === detail.id)
              if (exists) return prev
              return [detail, ...prev]
            })
          }
        } catch (e) {
          // ignore not found / errors for id lookup
        }
      }
    }, 300)

    return () => { if (searchTimeout.current) window.clearTimeout(searchTimeout.current) }
  }, [sortMode, searchTerm]);

  if (error) return <ErrorState message={error} />

  return (
    <RequireAuth>
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'8px 0 12px', gap: 12}}>
          <h1 style={{margin:0}}>Kunder</h1>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <input
                type="search"
                aria-label="Søk kunder"
                placeholder="Søk kunde (navn, adresse eller id)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{padding:'8px 10px', borderRadius:6, border:'1px solid #ccc', width:340}}
                aria-controls="customer-list"
              />
              {searchTerm && <button className="btn" onClick={() => setSearchTerm('')}>Tøm</button>}
            </div>

            <label htmlFor="sortmode" style={{fontSize:12, color:'#555'}}>Sorter:</label>
            <select id="sortmode" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="next">Neste besøk</option>
              <option value="alpha">Alfabetisk</option>
            </select>

            <button className="btn" onClick={() => (location.hash = '#customer:new')}>Ny kunde</button>
          </div>
        </div>

        <div className="customer-list" id="customer-list">
          {loading && customers.length === 0 ? (
            <Loading />
          ) : customers.length === 0 ? (
            <div style={{opacity:.7}}>
              {searchTerm ? `Ingen treff for '${searchTerm}'.` : 'Ingen kunder å vise.'}
            </div>
          ) : null}
          <div aria-live="polite" style={{fontSize:12, color:'#666', margin:'6px 0'}}>
            {customers.length > 0 ? `Viser ${customers.length} ${customers.length === 1 ? 'kunde' : 'kunder'}${searchTerm ? ` for '${searchTerm}'` : ''}` : ''}
          </div>
          {customers.map(c => {
            const status = c.status || statusFor(c.next_visit_date || c.planned_next_visit_date || c.expected_service_date);
            const dotColor = COLORS[status] || COLORS.red;
            const nextText = c.next_visit_date ? new Date(c.next_visit_date).toLocaleDateString() : (c.planned_next_visit_date ? new Date(c.planned_next_visit_date).toLocaleDateString() : 'Ikke planlagt');
            return (
              <div key={c.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #eee'}}>
                <div style={{display:'flex', gap:12, alignItems:'center'}}>
                  <span style={{width:14, height:14, borderRadius:7, background:dotColor, display:'inline-block', boxShadow:'0 0 0 2px rgba(255,255,255,0.9)'}} />
                  <div>
                    <div style={{fontWeight:600}}><a href={`#customer:${c.id}`}>{c.name}</a></div>
                    <div style={{fontSize:12, color:'#666'}}>Neste: {nextText}</div>
                  </div>
                </div>
                <div>
                  <button className="btn" onClick={() => location.hash = `#customer:${c.id}`}>Detaljer</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </RequireAuth>
  )
}

export default CustomerList;
