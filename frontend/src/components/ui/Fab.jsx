import { useMemo } from 'react'

export default function Fab({ label, icon = '➕', onClick, href, disabled, ariaLabel }){
  const content = (
    <span className="fab-content" aria-hidden="true" style={{display:'inline-flex',alignItems:'center',gap:8}}>
      <span className="fab-icon" style={{fontSize:18,lineHeight:1}}>{icon}</span>
      <span className="fab-label" style={{fontWeight:700}}>{label}</span>
    </span>
  )
  const common = useMemo(() => ({
    className: `fab fab-primary${disabled ? ' is-disabled' : ''}`,
    'aria-label': ariaLabel || label,
    'aria-disabled': disabled || undefined,
    style: {
      position:'fixed', right:'16px', bottom:'16px',
      // Respect safe areas on iOS
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)'
    }
  }), [ariaLabel, label, disabled])

  if (href && !disabled) {
    return <a {...common} role="button" href={href} onClick={onClick}>{content}</a>
  }
  return <button {...common} type="button" onClick={disabled ? undefined : onClick} disabled={disabled}>{content}</button>
}
