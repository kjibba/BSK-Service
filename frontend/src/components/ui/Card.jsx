export default function Card({ as = 'div', className = '', title, children, ...props }){
  const Cmp = as
  return (
    <Cmp className={["card", className].filter(Boolean).join(' ')} {...props}>
      {title ? <h3 style={{marginTop:0}}>{title}</h3> : null}
      {children}
    </Cmp>
  )
}
