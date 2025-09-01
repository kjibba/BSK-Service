import { useEffect, useState } from 'react'
import { EmployeesAPI } from '../api'
import Button from './ui/Button'
import Card from './ui/Card'
import PageHeader from './ui/PageHeader'
import { Loading, ErrorState } from './ui/States'
import { useToast } from './ui/Toast.jsx'

export default function EmployeeDetail({ id }){
  const isNew = id === null || id === undefined || id === 'new'
  const [data, setData] = useState({ name:'', email:'', phone:'', title:'', role:'', active:true })
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(()=>{
    if (isNew) return
    let active = true
    setLoading(true)
    EmployeesAPI.detail(id).then(d => { if (active) setData(d) }).catch(e => { if (active) setError(e) }).finally(()=> active && setLoading(false))
    return () => { active = false }
  }, [id])

  const save = async () => {
    try{
      setSaving(true)
      if (isNew) {
        await EmployeesAPI.create(data)
        toast.push({ variant: 'success', title: 'Opprettet' })
        location.hash = '#employees'
      } else {
        await EmployeesAPI.update(id, data)
        toast.push({ variant: 'success', title: 'Oppdatert' })
        // After saving an existing employee, return to the list
        location.hash = '#employees'
      }
    } catch (e){
      toast.push({ variant: 'error', title: 'Feil', description: e?.response?.data?.error || 'Kunne ikke lagre' })
    } finally { setSaving(false) }
  }

  const setInactive = async () => {
    if (!confirm('Sett ansatt som inaktiv (har sluttet)?')) return
    try{
      setSaving(true)
      if (isNew) {
        toast.push({ variant:'error', title: 'Feil', description: 'Kan ikke inaktivere før opprettet' })
        return
      }
      await EmployeesAPI.update(id, { active: false })
      toast.push({ variant:'success', title:'Oppdatert' })
      const d = await EmployeesAPI.detail(id)
      setData(d)
    } catch (e) {
      toast.push({ variant:'error', title:'Feil', description:'Kunne ikke sette inaktiv' })
    } finally { setSaving(false) }
  }

  const removeEmployee = async () => {
    if (isNew) return
    if (!confirm(`Slette ansatt ${data.name ? `“${data.name}” ` : ''}? Dette kan ikke angres.`)) return
    try{
      setSaving(true)
      await EmployeesAPI.delete(id)
      toast.push({ variant: 'success', title: 'Slettet' })
      location.hash = '#employees'
    } catch (e) {
      toast.push({ variant:'error', title:'Feil', description:'Kunne ikke slette ansatt' })
    } finally { setSaving(false) }
  }

  if (loading) return <Loading>Henter ansatt…</Loading>
  if (error) return <ErrorState message={'Kunne ikke hente ansatt'} onRetry={() => { setError(null); setLoading(true); EmployeesAPI.detail(id).then(setData).finally(()=>setLoading(false)) }} />

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title={isNew ? 'Ny ansatt' : (data.name ? `Ansatt — ${data.name}` : `Ansatt — ${data.email || ''}`)}
        actions={(<Button onClick={()=> location.hash = '#employees'}>Til liste</Button>)}
      />
      <Card>
        <div style={{display:'grid', gap:12}}>
          <input className="input" placeholder="Navn" value={data.name || ''} onChange={e=> setData(d=> ({...d, name:e.target.value}))} />
          <input className="input" placeholder="E-post" value={data.email || ''} onChange={e=> setData(d=> ({...d, email:e.target.value}))} />
          <input className="input" placeholder="Telefon" value={data.phone || ''} onChange={e=> setData(d=> ({...d, phone:e.target.value}))} />
          <input className="input" placeholder="Tittel" value={data.title || ''} onChange={e=> setData(d=> ({...d, title:e.target.value}))} />
          <select className="input" value={data.role || ''} onChange={e=> setData(d=> ({...d, role:e.target.value}))}>
            <option value="">(ingen rolle)</option>
            <option value="technician">Tekniker</option>
            <option value="manager">Leder</option>
          </select>
        </div>
        <div style={{marginTop:12, display:'flex', gap:8}}>
          <Button variant="primary" onClick={()=> location.hash = '#employees'}>Tilbake</Button>
          <Button variant="secondary" onClick={save} disabled={saving || (!data.name && isNew)}>{isNew ? 'Opprett' : 'Lagre'}</Button>
          {!isNew && <Button variant="ghost" onClick={setInactive} disabled={saving}>Sett inaktiv</Button>}
          {!isNew && <button className="btn btn-danger" onClick={removeEmployee} disabled={saving}>Slett</button>}
        </div>
      </Card>
    </div>
  )
}
