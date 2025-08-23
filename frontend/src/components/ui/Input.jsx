import { forwardRef } from 'react'

/**
 * Input component with consistent styling and accessibility
 * @param {Object} props
 * @param {'text'|'email'|'password'|'number'|'tel'|'url'} props.type - Input type
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Change handler
 * @param {boolean} props.required - Required field
 * @param {boolean} props.disabled - Disable input
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.ariaLabel - Accessible label
 * @param {string} props.ariaDescribedBy - ID of element describing the input
 * @param {string} props.id - Input ID
 */
const Input = forwardRef(({ 
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  ariaLabel,
  ariaDescribedBy,
  id,
  ...props 
}, ref) => {
  const classes = [
    'ui-input',
    disabled && 'ui-input--disabled',
    className
  ].filter(Boolean).join(' ')

  return (
    <input
      ref={ref}
      type={type}
      className={classes}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      id={id}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export default Input