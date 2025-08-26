export default function Card({ as = 'div', className = '', title, children, elevated = false, ...props }){
  const Cmp = as
  const cls = ['card', elevated ? 'card-elevated' : '', className].filter(Boolean).join(' ')
  return (
    <Cmp className={cls} {...props}>
      {title ? <h3 style={{marginTop:0}}>{title}</h3> : null}
      {children}
    </Cmp>
  )
}
