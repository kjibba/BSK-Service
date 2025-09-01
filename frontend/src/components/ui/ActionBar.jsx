export default function ActionBar({ children, visible = true }) {
  if (!visible) return null
  return (
    <div className="actionbar">
      <div className="container" style={{ display: 'flex', gap: 8, padding: '8px 12px', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </div>
    </div>
  )
}
