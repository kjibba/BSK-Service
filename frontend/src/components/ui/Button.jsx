export default function Button({ variant = 'default', size = 'md', className = '', as = 'button', children, ...props }) {
  const Cmp = as
  const base = 'btn'
  const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'ghost' ? 'btn-ghost' : variant === 'outline' ? 'btn-outline' : variant === 'success' ? 'btn-success' : ''
  const sizeClass = size === 'sm' ? 'btn-sm' : ''
  const cls = [base, variantClass, sizeClass, className].filter(Boolean).join(' ')
  return <Cmp className={cls} {...props}>{children}</Cmp>
}
