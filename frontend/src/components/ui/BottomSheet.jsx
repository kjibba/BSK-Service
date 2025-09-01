import { useEffect, useRef } from 'react'

export default function BottomSheet({ open, title, onClose, children }){
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title || 'Detaljer'}>
      <button className="sheet-scrim" aria-label="Lukk" onClick={onClose} />
      <div className="sheet" ref={ref}>
        <div className="sheet-header">
          <div className="sheet-handle" aria-hidden />
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
