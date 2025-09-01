export function ListSkeleton({ rows = 8 }){
  const items = Array.from({ length: rows })
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ padding: '8px 0' }}>
      {items.map((_, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '70%' }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: '#e5e7eb', display: 'inline-block' }} />
            <div style={{ width: '100%' }}>
              <div style={{ height: 14, background: '#e5e7eb', borderRadius: 6, width: '60%', marginBottom: 6 }} />
              <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, width: '40%' }} />
            </div>
          </div>
          <div style={{ width: 80, height: 28, background: '#e5e7eb', borderRadius: 6 }} />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ lines = 3 }){
  const arr = Array.from({ length: lines })
  return (
    <div role="status" aria-live="polite" aria-busy>
      {arr.map((_, i) => (
        <div key={i} style={{ height: 14, background: '#e5e7eb', borderRadius: 6, width: `${80 - i * 10}%`, margin: '8px 0' }} />
      ))}
    </div>
  )
}
