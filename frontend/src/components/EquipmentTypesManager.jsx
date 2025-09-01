import { useEffect, useState, useCallback } from 'react'
import Card from './ui/Card'
import PageHeader from './ui/PageHeader'
import { IconRefresh, IconPlus } from './ui/icons'
import Button from './ui/Button'
import { EquipmentTypesAPI } from '../api'
import { Loading, Empty } from './ui/States'
import { useToast } from './ui/Toast'

export default function EquipmentTypesManager() {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await EquipmentTypesAPI.list()
      setItems(data)
    } catch {
      toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke laste utstyrstyper' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading />
  if (!items) return <Empty />

  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader
        title="Utstyrstyper"
        actions={(
          <>
            <Button className="btn-icon" onClick={() => setEditing({ name: '', fields: [] })}><IconPlus /> Ny</Button>
            <Button className="btn-icon" onClick={() => load()}><IconRefresh /> Oppdater</Button>
          </>
        )}
      />
      <Card>
        <p style={{marginTop:0, color:'#475569', fontSize:13}}>
          Felter beskriver hvilke data som registreres ved service. Eksempler:
          «Åtekasse» kan ha feltene Forbruk giftåte (%), Benyttet giftåte (valg), Giftåte etterfylt (gram), Benyttet giftfritt åte (valg), Giftfritt etterfylt (gram).
        </p>

  {!items.length ? <Empty>Ingen registrerte utstyrstyper.</Empty> : (
          <ul className="list">
            {items.map(it => (
              <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  <div style={{ color: '#475569', fontSize: 13 }}>{(it.fields || []).map(f => f.key).join(', ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={() => setEditing(it)}>Endre</Button>
                  <Button size="sm" variant="danger" onClick={async ()=>{
                    if (!window.confirm(`Slette utstyrstype '${it.name}'?`)) return
                    try { await EquipmentTypesAPI.delete(it.id); await load() } catch {}
                  }}>Slett</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}><div>Navn</div><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>Felter</div>
              {(editing.fields || []).map((f, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input style={{ width: 140 }} value={f.key} onChange={e => { const nf = [...editing.fields]; nf[idx] = { ...nf[idx], key: e.target.value }; setEditing({ ...editing, fields: nf }) }} placeholder="key" />
                  <input style={{ width: 240 }} value={f.label || ''} onChange={e => { const nf = [...editing.fields]; nf[idx] = { ...nf[idx], label: e.target.value }; setEditing({ ...editing, fields: nf }) }} placeholder="label" />
                  <select value={f.type || 'text'} onChange={e => { const nf = [...editing.fields]; nf[idx] = { ...nf[idx], type: e.target.value }; setEditing({ ...editing, fields: nf }) }}>
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="select">select</option>
                    <option value="boolean">boolean</option>
                  </select>
                  <input style={{ width: 220 }} value={f.options ? (f.options.join(',') ) : ''} onChange={e => { const nf = [...editing.fields]; nf[idx] = { ...nf[idx], options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }; setEditing({ ...editing, fields: nf }) }} placeholder="options (comma-separated)" />
                  <Button size="sm" onClick={() => { const nf = (editing.fields || []).filter((_, i) => i !== idx); setEditing({ ...editing, fields: nf }) }}>Fjern</Button>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <Button onClick={() => setEditing({ ...editing, fields: [ ...(editing.fields || []), { key: '', label: '', type: 'text', options: [] } ] })}>Legg til felt</Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button variant="primary" onClick={async () => {
                try {
                  if (editing.id) await EquipmentTypesAPI.update(editing.id, editing)
                  else await EquipmentTypesAPI.create(editing)
                  toast.push({ variant: 'success', title: 'Lagret' })
                  setEditing(null)
                  await load()
                } catch { toast.push({ variant: 'error', title: 'Feil', description: 'Kunne ikke lagre type' }) }
              }}>Lagre</Button>
              <Button onClick={() => setEditing(null)}>Avbryt</Button>
            </div>
          </div>
        )}

      </Card>
    </div>
  )
}
