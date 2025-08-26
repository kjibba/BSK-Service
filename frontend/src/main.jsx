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
