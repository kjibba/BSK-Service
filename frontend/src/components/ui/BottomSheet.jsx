import { useEffect, useRef } from 'react'

export default function BottomSheet({ open, title, onClose, children }){
  const ref = useRef(null)
  const lastActive = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => {
    if (open) {
      lastActive.current = document.activeElement
      // focus first focusable in sheet or the close button
      setTimeout(() => {
        try {
          const root = ref.current
          if (!root) return
          const focusable = root.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
          if (focusable) focusable.focus({ preventScroll: true })
        } catch {}
      }, 0)
    } else {
      // restore focus
      try { lastActive.current && lastActive.current.focus({ preventScroll: true }) } catch {}
    }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title || 'Detaljer'}>
      <button className="sheet-scrim" aria-label="Lukk" onClick={onClose} />
      <div className="sheet" ref={ref}>
        <div className="sheet-header">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-title">{title}</div>
          <button className="sheet-close btn" onClick={onClose} aria-label="Lukk">Lukk</button>
        </div>
        <div className="sheet-body">
          {children}
        </div>
      </div>
    </div>
  )
}
