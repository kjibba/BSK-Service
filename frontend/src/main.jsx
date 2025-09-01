import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const rootEl = document.getElementById('root')
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Optional: tiny safety message if something strips content entirely
setTimeout(() => {
  if (rootEl && rootEl.childElementCount === 0) {
    rootEl.textContent = 'En feil oppstod under lasting av appen.'
  }
}, 0)

// Global klientfeil-logging
try {
  window.addEventListener('error', (e) => {
    try {
      const payload = {
        level: 'error',
        message: e?.error?.message || e?.message || 'Ukjent feil',
        stack: e?.error?.stack || '',
        url: window.location.href,
        route: window.location.hash?.slice(1) || '',
        meta: { lineno: e?.lineno, colno: e?.colno, filename: e?.filename }
      }
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/meta/client-log', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      } else {
        fetch('/api/meta/client-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
      }
    } catch {}
  })
  window.addEventListener('unhandledrejection', (e) => {
    try {
      const reason = e?.reason
      const payload = {
        level: 'error',
        message: (reason && (reason.message || String(reason))) || 'Ukjent promise-feil',
        stack: reason && reason.stack ? String(reason.stack) : '',
        url: window.location.href,
        route: window.location.hash?.slice(1) || '',
        meta: { type: 'unhandledrejection' }
      }
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/meta/client-log', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      } else {
        fetch('/api/meta/client-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
      }
    } catch {}
  })
} catch {}
