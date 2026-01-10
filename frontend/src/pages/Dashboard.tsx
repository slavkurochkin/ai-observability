import { useState, useEffect } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import './Dashboard.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

const API_BASE_URL = 'http://localhost:8006'

interface TimeFrame {
  label: string
  hours: number
}

const TIME_FRAMES: TimeFrame[] = [
  { label: 'Last Hour', hours: 1 },
  { label: 'Last 6 Hours', hours: 6 },
  { label: 'Last 24 Hours', hours: 24 },
  { label: 'Last 7 Days', hours: 168 },
  { label: 'Last 30 Days', hours: 720 },
]

interface DashboardData {
  uiEvents: any[]
  userEvents: any[]
  uiErrors: any[]
  serviceErrors: any[]
}

export default function Dashboard() {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>(TIME_FRAMES[2]) // Default: Last 24 Hours
  const [data, setData] = useState<DashboardData>({
    uiEvents: [],
    userEvents: [],
    uiErrors: [],
    serviceErrors: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - selectedTimeFrame.hours * 60 * 60 * 1000)

      const startDateISO = startDate.toISOString()
      const endDateISO = endDate.toISOString()

      // Fetch all data in parallel
      const [uiEventsRes, userEventsRes, uiErrorsRes, serviceErrorsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/ui-events?start_date=${startDateISO}&end_date=${endDateISO}&limit=1000`),
        fetch(`${API_BASE_URL}/events?start_date=${startDateISO}&end_date=${endDateISO}&limit=1000`),
        fetch(`${API_BASE_URL}/errors/ui?start_date=${startDateISO}&end_date=${endDateISO}&limit=1000`),
        fetch(`${API_BASE_URL}/errors/services?start_date=${startDateISO}&end_date=${endDateISO}&limit=1000`),
      ])

      if (!uiEventsRes.ok || !userEventsRes.ok || !uiErrorsRes.ok || !serviceErrorsRes.ok) {
        throw new Error('Failed to fetch data from observability service')
      }

      const [uiEvents, userEvents, uiErrors, serviceErrors] = await Promise.all([
        uiEventsRes.json(),
        userEventsRes.json(),
        uiErrorsRes.json(),
        serviceErrorsRes.json(),
      ])

      setData({
        uiEvents,
        userEvents,
        uiErrors,
        serviceErrors,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedTimeFrame])

  // Process data for charts
  const processTimeSeriesData = (events: any[]) => {
    const timeMap = new Map<string, number>()
    const hours = selectedTimeFrame.hours
    const interval = hours <= 24 ? 1 : hours <= 168 ? 6 : 24 // 1 hour for <=24h, 6 hours for <=7d, 24 hours for >7d

    events.forEach((event) => {
      const date = new Date(event.timestamp)
      const hour = Math.floor(date.getHours() / interval) * interval
      const key = `${date.toISOString().split('T')[0]}T${String(hour).padStart(2, '0')}:00:00`
      timeMap.set(key, (timeMap.get(key) || 0) + 1)
    })

    const sortedKeys = Array.from(timeMap.keys()).sort()
    return {
      labels: sortedKeys.map((key) => {
        const date = new Date(key)
        return hours <= 24
          ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })
      }),
      values: sortedKeys.map((key) => timeMap.get(key) || 0),
    }
  }

  const uiEventsTimeSeries = processTimeSeriesData(data.uiEvents)
  const userEventsTimeSeries = processTimeSeriesData(data.userEvents)
  const errorsTimeSeries = processTimeSeriesData([...data.uiErrors, ...data.serviceErrors])

  // Process error types
  const processErrorTypes = (errors: any[]) => {
    const typeMap = new Map<string, number>()
    errors.forEach((error) => {
      const type = error.error_type || 'Unknown'
      typeMap.set(type, (typeMap.get(type) || 0) + 1)
    })
    return {
      labels: Array.from(typeMap.keys()),
      values: Array.from(typeMap.values()),
    }
  }

  const uiErrorTypes = processErrorTypes(data.uiErrors)
  const serviceErrorTypes = processErrorTypes(data.serviceErrors)

  // Process UI event types
  const processUIEventTypes = (events: any[]) => {
    const typeMap = new Map<string, number>()
    events.forEach((event) => {
      const type = event.interaction_type || 'Unknown'
      typeMap.set(type, (typeMap.get(type) || 0) + 1)
    })
    return {
      labels: Array.from(typeMap.keys()),
      values: Array.from(typeMap.values()),
    }
  }

  const uiEventTypes = processUIEventTypes(data.uiEvents)

  // Process user event types
  const processUserEventTypes = (events: any[]) => {
    const typeMap = new Map<string, number>()
    events.forEach((event) => {
      const type = event.event_type || 'Unknown'
      typeMap.set(type, (typeMap.get(type) || 0) + 1)
    })
    return {
      labels: Array.from(typeMap.keys()),
      values: Array.from(typeMap.values()),
    }
  }

  const userEventTypes = processUserEventTypes(data.userEvents)

  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Events Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
    },
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <p>Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-error">
          <p>Error: {error}</p>
          <button onClick={fetchData}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Observability Dashboard</h1>
        <div className="time-frame-selector">
          <label htmlFor="time-frame">Time Frame:</label>
          <select
            id="time-frame"
            value={selectedTimeFrame.hours}
            onChange={(e) => {
              const hours = parseInt(e.target.value)
              const frame = TIME_FRAMES.find((f) => f.hours === hours) || TIME_FRAMES[2]
              setSelectedTimeFrame(frame)
            }}
          >
            {TIME_FRAMES.map((frame) => (
              <option key={frame.hours} value={frame.hours}>
                {frame.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>UI Events</h3>
          <p className="stat-value">{data.uiEvents.length}</p>
        </div>
        <div className="stat-card">
          <h3>User Events</h3>
          <p className="stat-value">{data.userEvents.length}</p>
        </div>
        <div className="stat-card">
          <h3>UI Errors</h3>
          <p className="stat-value">{data.uiErrors.length}</p>
        </div>
        <div className="stat-card">
          <h3>Service Errors</h3>
          <p className="stat-value">{data.serviceErrors.length}</p>
        </div>
      </div>

      <div className="dashboard-charts">
        <div className="chart-container">
          <h2>Events Over Time</h2>
          <div className="chart-wrapper">
            <Line
              data={{
                labels: uiEventsTimeSeries.labels,
                datasets: [
                  {
                    label: 'UI Events',
                    data: uiEventsTimeSeries.values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                  },
                  {
                    label: 'User Events',
                    data: userEventsTimeSeries.values,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                  },
                ],
              }}
              options={lineChartOptions}
            />
          </div>
        </div>

        <div className="chart-container">
          <h2>Errors Over Time</h2>
          <div className="chart-wrapper">
            <Line
              data={{
                labels: errorsTimeSeries.labels,
                datasets: [
                  {
                    label: 'Total Errors',
                    data: errorsTimeSeries.values,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                  },
                ],
              }}
              options={lineChartOptions}
            />
          </div>
        </div>

        <div className="chart-container">
          <h2>UI Event Types</h2>
          <div className="chart-wrapper">
            <Bar
              data={{
                labels: uiEventTypes.labels,
                datasets: [
                  {
                    label: 'Count',
                    data: uiEventTypes.values,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                  },
                ],
              }}
              options={barChartOptions}
            />
          </div>
        </div>

        <div className="chart-container">
          <h2>User Event Types</h2>
          <div className="chart-wrapper">
            <Bar
              data={{
                labels: userEventTypes.labels,
                datasets: [
                  {
                    label: 'Count',
                    data: userEventTypes.values,
                    backgroundColor: 'rgba(255, 206, 86, 0.6)',
                  },
                ],
              }}
              options={barChartOptions}
            />
          </div>
        </div>

        <div className="chart-container">
          <h2>UI Error Types</h2>
          <div className="chart-wrapper">
            <Doughnut
              data={{
                labels: uiErrorTypes.labels,
                datasets: [
                  {
                    data: uiErrorTypes.values,
                    backgroundColor: [
                      'rgba(255, 99, 132, 0.6)',
                      'rgba(54, 162, 235, 0.6)',
                      'rgba(255, 206, 86, 0.6)',
                      'rgba(75, 192, 192, 0.6)',
                      'rgba(153, 102, 255, 0.6)',
                      'rgba(255, 159, 64, 0.6)',
                    ],
                  },
                ],
              }}
              options={doughnutChartOptions}
            />
          </div>
        </div>

        <div className="chart-container">
          <h2>Service Error Types</h2>
          <div className="chart-wrapper">
            <Doughnut
              data={{
                labels: serviceErrorTypes.labels,
                datasets: [
                  {
                    data: serviceErrorTypes.values,
                    backgroundColor: [
                      'rgba(255, 99, 132, 0.6)',
                      'rgba(54, 162, 235, 0.6)',
                      'rgba(255, 206, 86, 0.6)',
                      'rgba(75, 192, 192, 0.6)',
                      'rgba(153, 102, 255, 0.6)',
                      'rgba(255, 159, 64, 0.6)',
                    ],
                  },
                ],
              }}
              options={doughnutChartOptions}
            />
          </div>
        </div>
      </div>

      <div className="dashboard-details">
        <div className="details-section">
          <h2>Recent UI Events</h2>
          <div className="details-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Element</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {data.uiEvents.slice(0, 10).map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.timestamp).toLocaleString()}</td>
                    <td>{event.interaction_type}</td>
                    <td>{event.element_name || event.element_type || 'N/A'}</td>
                    <td>{event.page_path || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="details-section">
          <h2>Recent Errors</h2>
          <div className="details-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...data.uiErrors, ...data.serviceErrors]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 10)
                  .map((error) => (
                    <tr key={error.id}>
                      <td>{new Date(error.timestamp).toLocaleString()}</td>
                      <td>{error.error_type || 'Unknown'}</td>
                      <td className="error-message">{error.error_message?.substring(0, 50) || 'N/A'}...</td>
                      <td>{error.error_source || error.request_url || 'N/A'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
