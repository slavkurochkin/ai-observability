import { ReactNode } from 'react'
import { useObservability } from '../contexts/ObservabilityContext'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { trackEvent } = useObservability()
  const location = useLocation()

  useEffect(() => {
    // Track page views
    trackEvent('page_view', {
      page: location.pathname,
      timestamp: new Date().toISOString(),
    })
  }, [location.pathname, trackEvent])

  return (
    <div id="layout" className="layout">
      <header id="layout-header" className="layout-header">
        <h1 id="layout-title">Observability Service Demo</h1>
        <nav id="layout-nav">
          <a id="nav-home" href="/">Home</a>
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
