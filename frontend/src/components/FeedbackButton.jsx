import { useState } from 'react'
import Button from './ui/Button'
import { FeedbackAPI } from '../api'

function collectDiagnostics() {
  try {
    const nav = typeof navigator !== 'undefined' ? {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
      online: navigator.onLine,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
      } : undefined,
      hardwareConcurrency: navigator.hardwareConcurrency || undefined,
    } : {}
    const screenInfo = typeof screen !== 'undefined' ? {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
    } : {}

    // Safe localStorage snapshot: only keys starting with 'app_' and small values
    const local = {}
    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith('app_')) {
            const v = localStorage.getItem(k) || ''
            if (v.length < 2000) local[k] = v
          }
        }
      }
    } catch (e) {
      // ignore access errors
    }

    return { navigator: nav, screen: screenInfo, localStorage: local }
  } catch (e) {
    return { error: 'diagnostics-failed' }
  }
}

export default function FeedbackButton({ context = {} }){
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)

  const submit = async () => {
    if (!text || !text.trim()) return
    setSending(true)
    try {
      const payload = { text: String(text), context }
      if (includeDiagnostics) payload.diagnostics = collectDiagnostics()
      await FeedbackAPI.submit(payload)
      setText('')
      setIncludeDiagnostics(false)
      setOpen(false)
      // eslint-disable-next-line no-alert
      alert('Takk for tilbakemeldingen!')
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Kunne ikke sende tilbakemelding. Prøv igjen senere.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{position:'fixed',right:12,bottom:12,zIndex:4000}}>
      <Button variant="secondary" onClick={() => setOpen(o => !o)}>{open ? 'Lukk' : 'Send tilbakemelding'}</Button>
      {open && (
        <div style={{width:360,background:'#fff',padding:12,borderRadius:8,boxShadow:'0 6px 18px rgba(2,6,23,0.12)',marginTop:8}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Rapporter feil eller ønsket forbedring</div>
          <textarea className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Hva skjedde? Hvordan bør det være?" />
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
            <input id="diag" type="checkbox" checked={includeDiagnostics} onChange={e => setIncludeDiagnostics(e.target.checked)} />
            <label htmlFor="diag" style={{fontSize:12,color:'#444'}}>Legg ved anonymiserte diagnoser (nettleser, skjerm, app-state)</label>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
            <Button type="button" onClick={() => setOpen(false)} disabled={sending}>Avbryt</Button>
            <Button variant="primary" onClick={submit} disabled={sending || !text.trim()}>{sending ? 'Sender…' : 'Send'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
