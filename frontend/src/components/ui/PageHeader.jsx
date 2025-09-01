export default function PageHeader({ title, actions, children, className = '' }) {
  return (
    <div className={`page-header ${className}`.trim()}>
      <div className="actions-row">
        {typeof title === 'string' ? <h1 style={{ margin: 0 }}>{title}</h1> : title}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      </div>
      {children ? (
        <div className="search-group">
          {children}
        </div>
      ) : null}
    </div>
  )
}
