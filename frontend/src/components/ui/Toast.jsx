import { useState, useEffect } from 'react'

/**
 * Toast notification component
 * @param {Object} props
 * @param {'success'|'error'|'warning'|'info'} props.variant - Toast style variant
 * @param {string} props.message - Toast message
 * @param {boolean} props.visible - Show/hide toast
 * @param {Function} props.onClose - Close handler
 * @param {number} props.duration - Auto-close duration in ms (0 = manual close)
 * @param {string} props.className - Additional CSS classes
 */
const Toast = ({ 
  variant = 'info',
  message,
  visible = false,
  onClose,
  duration = 5000,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(visible)

  useEffect(() => {
    setIsVisible(visible)
  }, [visible])

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  if (!isVisible) return null

  const baseClasses = 'ui-toast'
  
  const variantClasses = {
    success: 'ui-toast--success',
    error: 'ui-toast--error',
    warning: 'ui-toast--warning',
    info: 'ui-toast--info'
  }
  
  const classes = [
    baseClasses,
    variantClasses[variant],
    className
  ].filter(Boolean).join(' ')

  return (
    <div 
      className={classes}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="ui-toast__message">{message}</span>
      <button
        className="ui-toast__close"
        onClick={handleClose}
        aria-label="Lukk melding"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  )
}

export default Toast