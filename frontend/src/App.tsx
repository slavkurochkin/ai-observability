import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ObservabilityProvider } from './contexts/ObservabilityContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import ObservabilityDemo from './pages/ObservabilityDemo'
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
