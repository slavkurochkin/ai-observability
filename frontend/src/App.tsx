import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ObservabilityProvider } from './contexts/ObservabilityContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import ObservabilityDemo from './pages/ObservabilityDemo'
import Dashboard from './pages/Dashboard'
import EventsCopy from './pages/EventsCopy'
import Layout from './components/Layout'

function App() {
  return (
    <ErrorBoundary>
      <ObservabilityProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <Layout>
                  <EventsCopy />
                </Layout>
              }
            />
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />
            <Route
              path="/demo"
              element={
                <Layout>
                  <ObservabilityDemo />
                </Layout>
              }
            />
          </Routes>
        </BrowserRouter>
      </ObservabilityProvider>
    </ErrorBoundary>
  )
}

export default App
