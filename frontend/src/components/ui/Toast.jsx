/* eslint-disable react-refresh/only-export-components -- this file exports provider and hooks used by components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])
  const remove = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), [])
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2)
    const toast = { id, variant: 'default', timeout: 3000, ...t }
    setToasts(ts => [...ts, toast])
    if (toast.timeout) {
      setTimeout(() => remove(id), toast.timeout)
    }
    return id
  }, [remove])
  const api = useMemo(() => ({ push, remove }), [push, remove])
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onClose={remove} />
    </ToastCtx.Provider>
  )
}

export function useToast(){
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export function Toaster({ toasts, onClose }){
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={["toast", t.variant ? `toast-${t.variant}` : ''].join(' ')}>
          <div className="toast-body">
            {t.title ? <div className="toast-title">{t.title}</div> : null}
            {t.description ? <div className="toast-desc">{t.description}</div> : null}
          </div>
          <button className="toast-close" onClick={()=> onClose(t.id)} aria-label="Lukk">×</button>
        </div>
      ))}
    </div>
  )
}
