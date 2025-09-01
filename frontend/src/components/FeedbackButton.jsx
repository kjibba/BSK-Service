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
      cookiesEnabled: navigator.cookieEnabled,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData,
      } : undefined,
      hardwareConcurrency: navigator.hardwareConcurrency || undefined,
      deviceMemory: navigator.deviceMemory || undefined,
    } : {}

    const screenInfo = typeof screen !== 'undefined' ? {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : undefined,
    } : {}

    // App/side-kontekst (uten PII)
    const context = typeof window !== 'undefined' ? {
      url: (window.location && (window.location.origin + window.location.pathname)) || undefined,
      route: (window.location && window.location.hash) || undefined,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      visibility: typeof document !== 'undefined' ? document.visibilityState : undefined,
      theme: (() => { try { return localStorage.getItem('bsk:theme') || undefined } catch { return undefined } })(),
      isAuthenticated: (() => { try { return !!localStorage.getItem('auth_token') } catch { return undefined } })(),
      historyLength: (typeof history !== 'undefined' ? history.length : undefined),
      timeLocal: new Date().toString(),
      timeISO: new Date().toISOString(),
    } : {}

    // Performance-oversikt (begrenset, uten detaljer om URLer)
    let perf = {}
    try {
      const resEntries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('resource') : []
      const navEntries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation') : []
      const mem = performance && performance.memory ? {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize,
      } : undefined
      perf = {
        resourcesCount: Array.isArray(resEntries) ? resEntries.length : undefined,
        navigationCount: Array.isArray(navEntries) ? navEntries.length : undefined,
        memory: mem,
      }
    } catch { /* ignore */ }

    // Safe localStorage snapshot: kun ufarlige nøkler (prefiks) og små verdier
    const local = {}
    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (!k) continue
          // Ikke send tokens eller andre følsomme ting
          if (k === 'auth_token') continue
          if (k.startsWith('app_') || k === 'bsk:theme') {
            const v = localStorage.getItem(k) || ''
            if (v.length < 2000) local[k] = v
          }
        }
      }
    } catch { /* ignore */ }

    return { navigator: nav, screen: screenInfo, page: context, performance: perf, localStorage: local }
  } catch (e) {
    return { error: 'diagnostics-failed' }
  }
}

export default function FeedbackButton({ context = {}, open: openProp, onOpenChange, hideTrigger = false }){
  const isControlled = typeof openProp === 'boolean'
  const [openState, setOpenState] = useState(false)
  const open = isControlled ? openProp : openState
  const setOpen = (v) => {
    if (isControlled) { onOpenChange && onOpenChange(v) } else { setOpenState(v) }
  }
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!text || !text.trim()) return
    setSending(true)
    try {
      const payload = { text: String(text), context, diagnostics: collectDiagnostics() }
      await FeedbackAPI.submit(payload)
      setText('')
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
    <div className="feedback-button">
      {!hideTrigger && (
        <Button variant="secondary" aria-label={open ? 'Lukk tilbakemeldingsvindu' : 'Send inn tilbakemelding'} onClick={() => setOpen(!open)}>{open ? 'Lukk' : 'Send tilbakemelding'}</Button>
      )}
      {open && (
        <div className="feedback-panel" style={{background:'#fff',padding:12,borderRadius:8,boxShadow:'0 6px 18px rgba(2,6,23,0.12)',marginTop:8}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Hva kan vi forbedre?</div>
          <p style={{fontSize:12,color:'#444',marginTop:0,marginBottom:8}}>
            Vi ønsker å høre om forslag til nye funksjoner, feil (bugs), og alt annet som kan gjøres bedre i appen.
          </p>
          <textarea className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Beskriv kort hva du ønsker eller hva som ikke fungerte, gjerne med steg for å gjenskape." />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
            <Button type="button" onClick={() => setOpen(false)} disabled={sending}>Avbryt</Button>
            <Button variant="primary" onClick={submit} disabled={sending || !text.trim()}>{sending ? 'Sender…' : 'Send'}</Button>
          </div>
          <div style={{fontSize:11,color:'#666',marginTop:8}}>
            Tekniske detaljer (nettleser, skjerm, ytelse, app-tilstand) legges automatisk ved for å hjelpe oss å feilsøke. Ingen sensitive data sendes.
          </div>
        </div>
      )}
    </div>
  )
}
