import { useState } from 'react'
import { useObservability } from '../contexts/ObservabilityContext'
import { trackUIEvent, trackUIError, trackServiceError, startSpan } from '../utils/otel'
import { TrackedButton, TrackedInput, TrackedCheckbox, TrackedSelect } from '../components'
import './ObservabilityDemo.css'

export default function ObservabilityDemo() {
  const { trackEvent } = useObservability()
  const [formData, setFormData] = useState({ name: '', email: '' })

  const handleTrackEvent = async () => {
    // Create a span for this operation (will be sent to Tempo via OTEL Collector)
    const span = startSpan('demo.track_event', {
      button_name: 'track_event',
      action: 'user_click',
    })

    try {
      await trackEvent('demo_button_clicked', {
        button_name: 'track_event',
        timestamp: new Date().toISOString(),
      })
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100))
      
      span.end()
      alert('Event tracked! Check the observability service API or Grafana → Tempo for the trace.')
    } catch (error) {
      span.end()
      alert(`Error tracking event: ${error}. Check browser console for details.`)
    }
  }

  const handleTrackUIEvent = async () => {
    // This will create a trace span automatically via OpenTelemetry
    trackUIEvent('click', 'button', {
      elementName: 'demo-button',
      pagePath: '/',
    })
    alert('UI event tracked! View the trace in Grafana → Tempo.')
  }

  const handleTrackError = () => {
    const error = new Error('This is a demo error')
    trackUIError(error, {
      errorType: 'DemoError',
      errorStack: error.stack,
      pageContext: 'observability_demo',
    })
    alert('Error tracked!')
  }

  const handleTrackServiceError = async () => {
    try {
      // Simulate a failed API call
      const response = await fetch('http://localhost:8006/nonexistent')
      
      // Fetch doesn't throw on HTTP errors, so check response.ok
      if (!response.ok) {
        // Extract response headers
        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          headers[key] = value
        })
        
        // Try to get response body
        let responseBody = null
        try {
          responseBody = await response.text()
        } catch (e) {
          // Ignore if we can't read body
        }
        
        // Create an error object with status code for tracking
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`)
        error.response = {
          status: response.status,
          statusText: response.statusText,
          headers: headers,
          data: responseBody,
        }
        error.code = 'HTTPError'
        
        await trackServiceError(error, {
          url: 'http://localhost:8006/nonexistent',
          method: 'GET',
        })
        alert('Service error tracked! Check the observability database.')
      }
    } catch (error: any) {
      // Network errors (CORS, connection refused, etc.)
      await trackServiceError(error, {
        url: 'http://localhost:8006/nonexistent',
        method: 'GET',
      })
      alert('Service error tracked! Check the observability database.')
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await trackEvent('form_submitted', {
        form_type: 'demo_form',
        fields: Object.keys(formData),
      })
      await trackUIEvent('submit', 'form', {
        elementName: 'demo-form',
        pagePath: '/',
      })
      alert('Form submitted and tracked!')
    } catch (error) {
      alert(`Error tracking form: ${error}. Check browser console.`)
    }
  }

  return (
    <div id="observability-demo" className="observability-demo">
      <h1 id="demo-title">Observability Service Demo</h1>
      <p className="description">
        This is a minimal demo application showing how to integrate the Observability Service.
        Use the buttons below to test different types of event tracking.
      </p>

      <div className="demo-section">
        <h2>Event Tracking</h2>
        <TrackedButton 
          id="btn-track-user-event"
          trackContext="observability_demo"
          buttonName="track_user_event"
          onClick={handleTrackEvent}
          className="demo-button"
        >
          Track User Event
        </TrackedButton>
        <p className="demo-description">
          Tracks a general user event to the <code>/events</code> endpoint.
        </p>
      </div>

      <div className="demo-section">
        <h2>UI Event Tracking</h2>
        <TrackedButton 
          id="btn-track-ui-event"
          trackContext="observability_demo"
          buttonName="track_ui_event"
          onClick={handleTrackUIEvent}
          className="demo-button"
        >
          Track UI Event
        </TrackedButton>
        <p className="demo-description">
          Tracks a UI interaction to the <code>/ui-events</code> endpoint.
        </p>
      </div>

      <div className="demo-section">
        <h2>Error Tracking</h2>
        <div className="button-group">
          <TrackedButton 
            id="btn-track-ui-error"
            trackContext="observability_demo"
            buttonName="track_ui_error"
            onClick={handleTrackError}
            className="demo-button"
          >
            Track UI Error
          </TrackedButton>
          <TrackedButton 
            id="btn-track-service-error"
            trackContext="observability_demo"
            buttonName="track_service_error"
            onClick={handleTrackServiceError}
            className="demo-button"
          >
            Track Service Error
          </TrackedButton>
        </div>
        <p className="demo-description">
          Tracks errors to <code>/errors/ui</code> and <code>/errors/services</code> endpoints.
        </p>
      </div>

      <div className="demo-section">
        <h2>Form Tracking</h2>
        <form id="demo-form" onSubmit={handleFormSubmit} className="demo-form">
          <TrackedInput
            id="input-name"
            type="text"
            placeholder="Name"
            name="name"
            trackContext="observability_demo"
            inputName="name-input"
            trackOnFocus={true}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="demo-input"
          />
          <TrackedInput
            id="input-email"
            type="email"
            placeholder="Email"
            name="email"
            trackContext="observability_demo"
            inputName="email-input"
            trackOnFocus={true}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="demo-input"
          />
          <TrackedButton 
            id="btn-submit-form"
            type="submit"
            trackContext="observability_demo"
            buttonName="submit_form"
            className="demo-button"
          >
            Submit Form
          </TrackedButton>
        </form>
        <p className="demo-description">
          Form interactions are automatically tracked as UI events.
        </p>
      </div>

      <div className="demo-section">
        <h2>View Tracked Events</h2>
        <p className="demo-description">
          Check the Observability Service API to see your tracked events:
        </p>
        <ul className="api-links">
          <li>
            <a id="link-api-docs" href="http://localhost:8006/docs" target="_blank" rel="noopener noreferrer">
              API Documentation (Swagger)
            </a>
          </li>
          <li>
            <a id="link-db-stats" href="http://localhost:8006/stats" target="_blank" rel="noopener noreferrer">
              Database Statistics
            </a>
          </li>
          <li>
            <a id="link-recent-events" href="http://localhost:8006/events?limit=10" target="_blank" rel="noopener noreferrer">
              Recent Events
            </a>
          </li>
        </ul>
        <div className="test-connection">
          <TrackedButton 
            id="btn-test-connection"
            trackContext="observability_demo"
            buttonName="test_connection"
            onClick={async () => {
              try {
                const response = await fetch('http://localhost:8006/test-event');
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const data = await response.json();
                alert(`✅ Test successful! Event ID: ${data.event_id}\n\nCheck /events endpoint to see it.`);
              } catch (error: any) {
                alert(`❌ Test failed: ${error.message}\n\nCheck:\n1. Service is running: docker-compose ps\n2. Browser console for details`);
                console.error('Test connection error:', error);
              }
            }}
            className="demo-button"
          >
            Test Connection to Observability Service
          </TrackedButton>
          <p className="demo-description">
            Click to test if the observability service is accessible and can create events.
            This will create a test event in the database.
          </p>
        </div>
      </div>

      <div className="demo-section">
        <h2>OpenTelemetry Observability Stack</h2>
        <p className="demo-description">
          This demo also sends traces and metrics to the OpenTelemetry Collector, which routes them to Tempo, Prometheus, and Loki.
          View them in Grafana:
        </p>
        
        <div className="observability-stack">
          <div className="stack-item">
            <h3>Grafana (Unified Dashboard)</h3>
            <p>View all observability data in one place</p>
            <a id="link-grafana" href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className="stack-link">
              Open Grafana →
            </a>
            <p className="stack-note">Login: admin / admin</p>
          </div>

          <div className="stack-item">
            <h3>Tempo (Distributed Tracing)</h3>
            <p>View request traces across services</p>
            <a id="link-tempo" href="http://localhost:3001/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Tempo%22%5D" target="_blank" rel="noopener noreferrer" className="stack-link">
              View Traces in Grafana →
            </a>
            <p className="stack-note">Search: <code>{`{service.name="observability-demo-frontend"}`}</code></p>
          </div>

          <div className="stack-item">
            <h3>Prometheus (Metrics)</h3>
            <p>View metrics and time-series data</p>
            <a id="link-prometheus" href="http://localhost:9090" target="_blank" rel="noopener noreferrer" className="stack-link">
              Open Prometheus →
            </a>
            <p className="stack-note">Query: <code>up</code> or <code>rate(http_requests_total[5m])</code></p>
          </div>

          <div className="stack-item">
            <h3>Loki (Logs)</h3>
            <p>View aggregated logs from all services</p>
            <a id="link-loki" href="http://localhost:3001/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Loki%22%5D" target="_blank" rel="noopener noreferrer" className="stack-link">
              View Logs in Grafana →
            </a>
            <p className="stack-note">Query: <code>{`{service_name="observability-service"}`}</code></p>
          </div>
        </div>

        <div className="stack-info">
          <h4>How It Works:</h4>
          <ol>
            <li><strong>Frontend</strong> sends traces via OpenTelemetry SDK → OTEL Collector</li>
            <li><strong>Observability Service</strong> sends traces/metrics → OTEL Collector</li>
            <li><strong>OTEL Collector</strong> routes:
              <ul>
                <li>Traces → Tempo</li>
                <li>Metrics → Prometheus</li>
                <li>Logs → Loki</li>
              </ul>
            </li>
            <li><strong>Grafana</strong> visualizes everything from Tempo, Prometheus, Loki, and PostgreSQL</li>
          </ol>
        </div>
      </div>

      <div className="demo-section">
        <h2>Test Full Observability Stack</h2>
        <p className="demo-description">
          Make some events above, then check:
        </p>
        <ol className="test-steps">
          <li>
            <strong>Grafana Traces (Tempo)</strong>: 
            <a id="link-tempo-test" href="http://localhost:3001/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Tempo%22%5D" target="_blank" rel="noopener noreferrer">
              View traces
            </a>
            <br />
            <span className="step-note">Search for: <code>{`{service.name="observability-demo-frontend"}`}</code></span>
          </li>
          <li>
            <strong>Prometheus Metrics</strong>: 
            <a id="link-prometheus-test" href="http://localhost:9090/graph?g0.expr=up&g0.tab=1" target="_blank" rel="noopener noreferrer">
              View metrics
            </a>
            <br />
            <span className="step-note">Try query: <code>up</code> or <code>rate(http_requests_total[5m])</code></span>
          </li>
          <li>
            <strong>Loki Logs</strong>: 
            <a id="link-loki-test" href="http://localhost:3001/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Loki%22%5D" target="_blank" rel="noopener noreferrer">
              View logs
            </a>
            <br />
            <span className="step-note">Query: <code>{`{service_name="observability-service"}`}</code></span>
          </li>
          <li>
            <strong>PostgreSQL Events</strong>: 
            <a id="link-postgres-events" href="http://localhost:8006/events?limit=10" target="_blank" rel="noopener noreferrer">
              View events
            </a>
            <br />
            <span className="step-note">Direct database query via API</span>
          </li>
        </ol>
      </div>

      <div className="demo-section">
        <h2>Integration Guide</h2>
        <p className="demo-description">
          See <code>OBSERVABILITY_INTEGRATION_GUIDE.md</code> for detailed integration instructions
          for your own applications.
        </p>
      </div>
    </div>
  )
}

