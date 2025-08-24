import { useEffect, useMemo, useState } from 'react'
import { EquipmentAPI, EquipmentTypesAPI, VisitsAPI } from '../api'
import Card from './ui/Card'
import Button from './ui/Button'
import { useToast } from './ui/Toast.jsx'
import { RequireAuth } from './auth'

export default function EquipmentService({ visitId, equipmentId }){
  return (
    <RequireAuth>
      <Inner visitId={visitId} equipmentId={equipmentId} />
    </RequireAuth>
  )
}

function Inner({ visitId, equipmentId }){
  const toast = useToast()
  const [eq, setEq] = useState(null)
  const [typeDef, setTypeDef] = useState(null)
  const [values, setValues] = useState({})
  const [desc, setDesc] = useState('')
  const [hours, setHours] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    setLoading(true)
    try {
      const item = await EquipmentAPI.list({ id: equipmentId }).then(list => {
        const arr = Array.isArray(list) ? list : []
        return arr.find(x => x.id === Number(equipmentId))
      })
      setEq(item || null)
      if (item && item.equipment_type_id) {
        const types = await EquipmentTypesAPI.list()
        setTypeDef((types || []).find(t => t.id === item.equipment_type_id) || null)
      } else {
        setTypeDef(null)
      }
    } catch (e) {
      console.debug(e)
      setEq(null)
      setTypeDef(null)
    } finally { setLoading(false) }
  })() }, [equipmentId])

  const fields = useMemo(() => Array.isArray(typeDef?.fields) ? typeDef.fields : [], [typeDef])

  const save = async () => {
    const parts = []
    if (eq?.type) parts.push(`[${eq.type}]`)
    fields.forEach(f => {
      const k = (f.key || '').trim(); if (!k) return
      const v = values[k]
      if (v === undefined || v === '') return
      parts.push(`${f.label || k}: ${typeof v === 'boolean' ? (v ? 'ja' : 'nei') : v}`)
    })
    if (desc) parts.push(`Notat: ${desc}`)
    const payload = {
      equipment_id: Number(equipmentId),
      description: parts.join(' | '),
      hours_worked: hours ? Number(hours) : undefined,
    }
    try {
      await VisitsAPI.logs.create(visitId, payload)
      toast.push({ variant: 'success', title: 'Logg lagret' })
      window.location.hash = `visit:${visitId}`
    } catch (e) {
      console.debug(e)
      toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke lagre service.' })
    }
  }

  if (loading) return <div>Laster…</div>
  if (!eq) return <div>Finner ikke utstyr.</div>

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card title="Utfør service">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontWeight: 600 }}>{eq.name}</div>
            <div style={{ fontSize: 13, color: '#475569' }}>{eq.type || 'Utstyr'}</div>
          </div>
          <div>
            <Button onClick={() => window.location.hash = `visit:${visitId}`}>Tilbake</Button>
          </div>
        </div>
      </Card>

      {fields.length > 0 && (
        <Card title="Kontrollpunkter">
          <div className="stack" style={{ gap: 8 }}>
            {fields.map((f, i) => {
              const key = (f.key || '').trim()
              if (!key) return null
              const label = f.label || key
              const t = f.type || 'text'
              if (t === 'boolean') {
                return (
                  <label key={i} style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <input type="checkbox" checked={!!values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.checked }))} />
                    <span>{label}</span>
                  </label>
                )
              }
              if (t === 'select') {
                const opts = Array.isArray(f.options) ? f.options : []
                return (
                  <label key={i} className="stack" style={{ gap: 4 }}>
                    <div>{label}</div>
                    <select className="input" value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}>
                      <option value="">Velg…</option>
                      {opts.map((o, idx) => <option key={idx} value={String(o)}>{String(o)}</option>)}
                    </select>
                  </label>
                )
              }
              const isNum = (t === 'number')
              return (
                <label key={i} className="stack" style={{ gap: 4 }}>
                  <div>{label}</div>
                  <input className="input" type={isNum ? 'number' : 'text'} step={isNum ? 'any' : undefined} value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: isNum ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))} />
                </label>
              )
            })}
          </div>
        </Card>
      )}

      <Card title="Notat og tid">
        <textarea className="input" placeholder="Notat (valgfritt)" value={desc} onChange={e => setDesc(e.target.value)} />
        <input className="input" type="number" min="0" step="0.25" placeholder="Timer (valgfritt)" value={hours} onChange={e => setHours(e.target.value)} />
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Button variant="primary" onClick={save}>Lagre</Button>
        </div>
      </Card>
    </div>
  )
}
