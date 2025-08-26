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
