import { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocation, NavLink } from 'react-router-dom'
import { trackEventTelemetryOnly } from '../utils/otel'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  useEffect(() => {
    // Track page views via OpenTelemetry only (Loki/Grafana stack)
    // Not stored in database, only in distributed tracing/logs
    trackEventTelemetryOnly('page_view', {
      page: location.pathname,
      timestamp: new Date().toISOString(),
    })
  }, [location.pathname])

  return (
    <div id="layout" className="layout">
      <header id="layout-header" className="layout-header">
        <h1 id="layout-title">Observability Service</h1>
        <nav id="layout-nav">
          <NavLink id="nav-events" to="/">Events</NavLink>
          <NavLink id="nav-dashboard" to="/dashboard">Dashboard</NavLink>
          <NavLink id="nav-demo" to="/demo">Demo</NavLink>
        </nav>
      </header>
      <main id="layout-main" className="layout-main">
        {children}
      </main>
      <footer id="layout-footer" className="layout-footer">
        <p>Observability Service Integration Demo</p>
      </footer>
    </div>
  )
}
