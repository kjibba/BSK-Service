import { forwardRef } from 'react'

/**
 * Button component with consistent styling, loading states, and accessibility
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {'primary'|'success'|'default'} props.variant - Button style variant
 * @param {boolean} props.loading - Show loading state
 * @param {boolean} props.disabled - Disable button
 * @param {Function} props.onClick - Click handler
 * @param {'button'|'submit'|'reset'} props.type - Button type
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.ariaLabel - Accessible label
 * @param {string} props.ariaDescribedBy - ID of element describing the button
 */
const Button = forwardRef(({ 
  children, 
  variant = 'default', 
  loading = false, 
  disabled = false, 
  onClick, 
  type = 'button',
  className = '',
  ariaLabel,
  ariaDescribedBy,
  ...props 
}, ref) => {
  const baseClasses = 'ui-button'
  
  const variantClasses = {
    primary: 'ui-button--primary',
    success: 'ui-button--success', 
    default: 'ui-button--default'
  }
  
  const classes = [
    baseClasses,
    variantClasses[variant],
    loading && 'ui-button--loading',
    disabled && 'ui-button--disabled',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="ui-button__spinner" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="24"
              strokeDashoffset="24"
              className="ui-spinner"
            />
          </svg>
        </span>
      )}
      <span className={loading ? 'ui-button__content--loading' : 'ui-button__content'}>
        {children}
      </span>
    </button>
  )
})

Button.displayName = 'Button'

export default Button