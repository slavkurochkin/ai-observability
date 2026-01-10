import React, { Component, ErrorInfo, ReactNode } from 'react'
import { trackUIError } from '../utils/otel'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component to catch React component errors
 * and track them as UI errors in the observability service
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Track the error as a UI error
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    trackUIError(error, {
      errorType: error.name || 'ReactError',
      errorStack: error.stack,
      errorSource: errorInfo.componentStack,
      lineNumber: undefined, // React errors don't have line numbers in the same way
      columnNumber: undefined,
    }).catch((trackingError) => {
      console.warn('Failed to track React error:', trackingError)
    })
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI or default
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>An error occurred. Please refresh the page or contact support if the problem persists.</p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '20px', textAlign: 'left' }}>
              <summary>Error Details (Development Only)</summary>
              <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
                {this.state.error.toString()}
                {this.state.error.stack && (
                  <>
                    {'\n\n'}
                    {this.state.error.stack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

