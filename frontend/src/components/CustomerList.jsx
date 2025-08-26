import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        let data = [];
        if (sortMode === 'next') {
          data = await CustomersAPI.list({ include: 'next_visit', sort: 'next_visit' });
        } else {
          data = await CustomersAPI.list({ include: 'next_visit' });
          // Alfabetisk klient-side sortering (norsk locale)
          data.sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'nb', { sensitivity: 'base' }));
        }
        setCustomers(data);
      } catch (e) {
        console.debug(e)
        setError('Kunne ikke hente kunder. ' + (e?.message || String(e)));
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [sortMode]);

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} />

  return (
    <RequireAuth>
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'8px 0 12px', gap: 12}}>
          <h1 style={{margin:0}}>Kunder</h1>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <label htmlFor="sortmode" style={{fontSize:12, color:'#555'}}>Sorter:</label>
            <select id="sortmode" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="next">Neste besøk</option>
              <option value="alpha">Alfabetisk</option>
            </select>
            <button className="btn" onClick={() => (location.hash = '#customer:new')}>Ny kunde</button>
          </div>
        </div>

        <div className="customer-list">
          {customers.length === 0 && <div style={{opacity:.7}}>Ingen kunder å vise.</div>}
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
