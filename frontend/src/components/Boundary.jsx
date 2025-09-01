import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props){
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error){
    return { hasError: true, error }
  }
  componentDidCatch(error, info){
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error, info)
    try {
      const payload = {
        level: 'error',
        message: String(error?.message || error),
        stack: String(error?.stack || ''),
        url: window?.location?.href,
        route: window?.location?.hash?.slice(1) || '',
        meta: { componentStack: info?.componentStack }
      }
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/meta/client-log', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      } else {
        fetch('/api/meta/client-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
      }
    } catch (_) { /* no-op */ }
  }
  render(){
    if (this.state.hasError){
      const Fallback = this.props.fallback
      if (Fallback) return typeof Fallback === 'function' ? <Fallback error={this.state.error} /> : Fallback
      return (
        <div style={{padding:'1rem', color:'#b00020'}}>
          <h3>Det oppstod en feil i grensesnittet.</h3>
          <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
