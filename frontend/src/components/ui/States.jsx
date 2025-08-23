export function Loading({ children = 'Laster…' }){
  return <div aria-busy="true">{children}</div>
}

export function Empty({ children = 'Ingen data å vise.' }){
  return <div role="status" aria-live="polite" style={{opacity:.8}}>{children}</div>
}

export function ErrorState({ message = 'En feil oppstod', onRetry }){
  return (
    <div className="card" style={{maxWidth:600, borderColor:'#fecaca'}}>
      <h3 style={{marginTop:0}}>Noe gikk galt</h3>
      <p style={{color:'#b91c1c'}}>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Prøv igjen</button>}
    </div>
  )
}
