import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initOpenTelemetry, trackServiceError, trackUIError } from './utils/otel'

// Initialize OpenTelemetry
initOpenTelemetry()

// Set up global error handlers for JavaScript runtime errors
window.addEventListener('error', (event) => {
  trackUIError(event.error || event.message, {
    errorType: event.error?.name || 'Error',
    errorStack: event.error?.stack,
    errorSource: event.filename,
    lineNumber: event.lineno,
    columnNumber: event.colno,
  }).catch(() => {
    // Silently fail - don't break the app
  })
}, true)

// Set up unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  trackUIError(event.reason instanceof Error ? event.reason : String(event.reason), {
    errorType: event.reason instanceof Error ? event.reason.name : 'UnhandledRejection',
    errorStack: event.reason instanceof Error ? event.reason.stack : undefined,
  }).catch(() => {
    // Silently fail - don't break the app
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
