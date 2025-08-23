import { useState, useEffect } from 'react';
import { CustomersAPI, EquipmentAPI, VisitsAPI, ServiceLogsAPI } from '../api';
import Button from './ui/Button';
import Card from './ui/Card';
import { Loading, ErrorState } from './ui/States';

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await CustomersAPI.list();
        setCustomers(data);
      } catch (e) {
        console.debug(e)
        setError('Kunne ikke hente kunder. ' + (e?.message || String(e)));
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  useEffect(() => {
    if (customers.length && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const [newCustomer, setNewCustomer] = useState({ name: '', address: '' });
  const [creating, setCreating] = useState(false);
  const createCustomer = async () => {
    try {
      setCreating(true);
      const created = await CustomersAPI.create(newCustomer);
      setCustomers(prev => [...prev, created]);
      setNewCustomer({ name: '', address: '' });
      setSelectedCustomerId(created.id);
    } catch (e) {
      console.debug(e)
      setError('Kunne ikke opprette kunde. ' + (e?.message || String(e)));
    } finally {
      setCreating(false);
    }
  };

  const [newEquipment, setNewEquipment] = useState({ name: '', type: '' });
  const [newVisit, setNewVisit] = useState({ visit_date: '', technician: '' });
  const [equipments, setEquipments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [serviceLogs, setServiceLogs] = useState([]);

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const [eq, vi] = await Promise.all([EquipmentAPI.list(), VisitsAPI.list({ customer_id: selectedCustomerId })]);
        setEquipments(eq);
        setVisits(vi);
        const logs = await ServiceLogsAPI.list({ customer_id: selectedCustomerId });
        setServiceLogs(logs);
      } catch (e) {
        console.debug(e)
      }
    };
    if (selectedCustomerId) fetchLists();
  }, [selectedCustomerId]);

  const firstCustomerId = selectedCustomerId;

  const createEquipment = async () => {
    if (!firstCustomerId) return;
    try {
      const created = await EquipmentAPI.create({ customer_id: firstCustomerId, ...newEquipment });
      setEquipments(prev => [...prev, created]);
      setNewEquipment({ name: '', type: '' });
    } catch (e) {
      console.debug(e)
    }
  };
  const createVisit = async () => {
    if (!firstCustomerId) return;
    try {
      const created = await VisitsAPI.create({ customer_id: firstCustomerId, visit_date: newVisit.visit_date, technician: newVisit.technician });
      setVisits(prev => [created, ...prev]);
      setNewVisit({ visit_date: '', technician: '' });
    } catch (e) {
      console.debug(e)
    }
  };

  if (loading) return <Loading />

  if (error) return <ErrorState message={error} />

  return (
    <div>
      <h1 style={{margin:'8px 0 12px'}}>Kundeliste</h1>
    <Card title="Ny kunde" style={{marginBottom: 16}}>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <input placeholder="Navn" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer, name:e.target.value})} />
          <input placeholder="Adresse" value={newCustomer.address} onChange={e=>setNewCustomer({...newCustomer, address:e.target.value})} />
      <Button variant="primary" onClick={createCustomer} disabled={creating || !newCustomer.name}>Opprett</Button>
        </div>
      </Card>

      <div className="layout-columns">
        <div className="col">
          <h2>Kunder</h2>
          <ul className="list">
            {customers.map((customer) => (
              <li key={customer.id} style={{cursor:'pointer'}} onClick={()=>{ setSelectedCustomerId(customer.id); window.location.hash = `customer:${customer.id}` }}>
                <span style={{fontWeight: selectedCustomerId===customer.id?'bold':'normal'}}>{customer.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="col" style={{flex: 2}}>
          <h2>Besøk for valgt kunde</h2>
      <Card style={{marginBottom: 16}}>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <input placeholder="YYYY-MM-DDTHH:mm:ss" value={newVisit.visit_date} onChange={e=>setNewVisit({...newVisit, visit_date:e.target.value})} />
              <input placeholder="Tekniker" value={newVisit.technician} onChange={e=>setNewVisit({...newVisit, technician:e.target.value})} />
        <Button variant="primary" onClick={createVisit} disabled={!firstCustomerId || !newVisit.visit_date}>Opprett</Button>
            </div>
          </Card>
          <ul>
            {visits.map((v) => (
              <li key={v.id}>{v.visit_date} {v.technician ? `— ${v.technician}` : ''}</li>
            ))}
          </ul>

          <h2>Servicelogger for valgt kunde</h2>
          <ul>
            {serviceLogs.map((s) => (
              <li key={s.id}>{s.log_date || '—'} — utstyr #{s.equipment_id}: {s.description?.slice(0,80)}</li>
            ))}
          </ul>
        </div>

        <div className="col">
          <h2>Utstyr (alle)</h2>
      <Card style={{marginBottom: 16}}>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <input placeholder="Navn" value={newEquipment.name} onChange={e=>setNewEquipment({...newEquipment, name:e.target.value})} />
              <input placeholder="Type" value={newEquipment.type} onChange={e=>setNewEquipment({...newEquipment, type:e.target.value})} />
        <Button variant="primary" onClick={createEquipment} disabled={!firstCustomerId || !newEquipment.name}>Opprett</Button>
            </div>
          </Card>
          <ul>
            {equipments.map((e) => (
              <li key={e.id}>{e.name} ({e.type || '–'})</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CustomerList;
