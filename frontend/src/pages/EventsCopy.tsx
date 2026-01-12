import { useState, useEffect } from 'react'
import './EventsCopy.css'
import { addLocalTimestamp } from '../utils/date'

const API_BASE_URL = 'http://localhost:8006'

interface TimeFrame {
  label: string
  minutes: number | null // null for custom range
}

const TIME_FRAMES: TimeFrame[] = [
  { label: 'Last 5 Minutes', minutes: 5 },
  { label: 'Last 15 Minutes', minutes: 15 },
  { label: 'Last 30 Minutes', minutes: 30 },
  { label: 'Last Hour', minutes: 60 },
  { label: 'Last 6 Hours', minutes: 360 },
  { label: 'Last 24 Hours', minutes: 1440 },
  { label: 'Custom Range', minutes: null },
]

interface EventSection {
  id: 'uiEvents' | 'userEvents' | 'uiErrors' | 'serviceErrors'
  label: string
  enabled: boolean
  data: any[]
  loading: boolean
}

export default function EventsCopy() {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>(TIME_FRAMES[0]) // Default: Last 5 Minutes
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [sections, setSections] = useState<EventSection[]>([
    { id: 'uiEvents', label: 'UI Events', enabled: true, data: [], loading: false },
    { id: 'userEvents', label: 'User Events', enabled: true, data: [], loading: false },
    { id: 'uiErrors', label: 'UI Errors', enabled: true, data: [], loading: false },
    { id: 'serviceErrors', label: 'Service Errors', enabled: true, data: [], loading: false },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      let startDateISO: string
      let endDateISO: string

      const isCustomRange = selectedTimeFrame.minutes === null

      if (isCustomRange) {
        if (!customStartDate || !customEndDate) {
          setError('Please select both start and end dates for custom range')
          setLoading(false)
          return
        }
        const startDate = new Date(customStartDate)
        const endDate = new Date(customEndDate)
        if (endDate <= startDate) {
          setError('End date must be after start date')
          setLoading(false)
          return
        }
        startDateISO = startDate.toISOString()
        endDateISO = endDate.toISOString()
      } else {
        const endDate = new Date()
        const startDate = new Date(endDate.getTime() - (selectedTimeFrame.minutes || 0) * 60 * 1000)
        startDateISO = startDate.toISOString()
        endDateISO = endDate.toISOString()
      }

      // Fetch all data in parallel
      const [uiEventsRes, userEventsRes, uiErrorsRes, serviceErrorsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/ui-events?start_date=${startDateISO}&end_date=${endDateISO}&limit=10000`),
        fetch(`${API_BASE_URL}/events?start_date=${startDateISO}&end_date=${endDateISO}&limit=10000`),
        fetch(`${API_BASE_URL}/errors/ui?start_date=${startDateISO}&end_date=${endDateISO}&limit=10000`),
        fetch(`${API_BASE_URL}/errors/services?start_date=${startDateISO}&end_date=${endDateISO}&limit=10000`),
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

      setSections((prevSections) => [
        { id: 'uiEvents', label: 'UI Events', enabled: prevSections[0].enabled, data: uiEvents, loading: false },
        { id: 'userEvents', label: 'User Events', enabled: prevSections[1].enabled, data: userEvents, loading: false },
        { id: 'uiErrors', label: 'UI Errors', enabled: prevSections[2].enabled, data: uiErrors, loading: false },
        { id: 'serviceErrors', label: 'Service Errors', enabled: prevSections[3].enabled, data: serviceErrors, loading: false },
      ])
    } catch (err: any) {
      setError(err.message || 'Failed to load events')
      console.error('Events fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedTimeFrame, customStartDate, customEndDate])

  const toggleSection = (sectionId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, enabled: !section.enabled } : section
      )
    )
  }

  const copySection = async (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)
    if (!section || section.data.length === 0) {
      alert(`No data available for ${section?.label || sectionId}`)
      return
    }

    let startTime: string
    let endTime: string

    const isCustomRange = selectedTimeFrame.minutes === null

    if (isCustomRange) {
      startTime = new Date(customStartDate).toISOString()
      endTime = new Date(customEndDate).toISOString()
    } else {
      startTime = new Date(Date.now() - (selectedTimeFrame.minutes || 0) * 60 * 1000).toISOString()
      endTime = new Date().toISOString()
    }

    const output: any = {
      time_frame: {
        label: selectedTimeFrame.label,
        minutes: selectedTimeFrame.minutes,
        start_time: startTime,
        end_time: endTime,
      },
    }

    // Add the specific section's data
    switch (sectionId) {
      case 'uiEvents':
        output.ui_events = section.data
        break
      case 'userEvents':
        output.user_events = section.data
        break
      case 'uiErrors':
        output.ui_errors = section.data
        break
      case 'serviceErrors':
        output.service_errors = section.data
        break
    }

    const formattedOutput = JSON.stringify(output, null, 2)

    try {
      await navigator.clipboard.writeText(formattedOutput)
      setCopiedSection(sectionId)
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = formattedOutput
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedSection(sectionId)
        setTimeout(() => setCopiedSection(null), 2000)
      } catch (fallbackErr) {
        alert('Failed to copy to clipboard. Please copy manually.')
        console.error('Copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const copyEvents = async () => {
    const enabledSections = sections.filter((section) => section.enabled)

    if (enabledSections.length === 0) {
      alert('Please select at least one section to copy')
      return
    }

    let startTime: string
    let endTime: string

    const isCustomRange = selectedTimeFrame.minutes === null

    if (isCustomRange) {
      startTime = new Date(customStartDate).toISOString()
      endTime = new Date(customEndDate).toISOString()
    } else {
      startTime = new Date(Date.now() - (selectedTimeFrame.minutes || 0) * 60 * 1000).toISOString()
      endTime = new Date().toISOString()
    }

    const output: any = {
      time_frame: {
        label: selectedTimeFrame.label,
        minutes: selectedTimeFrame.minutes,
        start_time: startTime,
        end_time: endTime,
      },
      events: {},
    }

    sections.forEach((section) => {
      if (section.enabled) {
        switch (section.id) {
          case 'uiEvents':
            output.events.ui_events = section.data
            break
          case 'userEvents':
            output.events.user_events = section.data
            break
          case 'uiErrors':
            output.events.ui_errors = section.data
            break
          case 'serviceErrors':
            output.events.service_errors = section.data
            break
        }
      }
    })

    const formattedOutput = JSON.stringify(output, null, 2)

    try {
      await navigator.clipboard.writeText(formattedOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = formattedOutput
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackErr) {
        alert('Failed to copy to clipboard. Please copy manually.')
        console.error('Copy failed:', fallbackErr)
      }
      document.body.removeChild(textArea)
    }
  }

  const getSectionCount = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)
    return section?.data.length || 0
  }

  return (
    <div className="events-copy">
      <div className="events-copy-header">
        <h1>Copy Events for LLM</h1>
        <div className="header-controls">
          <div className="time-frame-selector">
            <label htmlFor="time-frame">Time Frame:</label>
            <select
              id="time-frame"
              value={selectedTimeFrame.minutes === null ? 'custom' : selectedTimeFrame.minutes}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setSelectedTimeFrame(TIME_FRAMES.find((f) => f.minutes === null) || TIME_FRAMES[0])
                  // Set default to past 5 minutes
                  const now = new Date()
                  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
                  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
                  const formatDateTimeLocal = (date: Date) => {
                    const year = date.getFullYear()
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const day = String(date.getDate()).padStart(2, '0')
                    const hours = String(date.getHours()).padStart(2, '0')
                    const minutes = String(date.getMinutes()).padStart(2, '0')
                    return `${year}-${month}-${day}T${hours}:${minutes}`
                  }
                  setCustomEndDate(formatDateTimeLocal(now))
                  setCustomStartDate(formatDateTimeLocal(fiveMinutesAgo))
                } else {
                  const minutes = parseInt(e.target.value)
                  const frame = TIME_FRAMES.find((f) => f.minutes === minutes) || TIME_FRAMES[0]
                  setSelectedTimeFrame(frame)
                }
              }}
            >
              {TIME_FRAMES.map((frame) => (
                <option key={frame.minutes === null ? 'custom' : frame.minutes} value={frame.minutes === null ? 'custom' : frame.minutes}>
                  {frame.label}
                </option>
              ))}
            </select>
            {selectedTimeFrame.minutes === null && (
              <div className="custom-date-range">
                <div className="date-input-group">
                  <label htmlFor="start-date">Start:</label>
                  <input
                    id="start-date"
                    type="datetime-local"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="date-input-group">
                  <label htmlFor="end-date">End:</label>
                  <input
                    id="end-date"
                    type="datetime-local"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <button
            className="copy-button"
            onClick={copyEvents}
            disabled={loading || sections.filter((s) => s.enabled).length === 0}
          >
            {copied ? '✓ Copied!' : 'Copy Events'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={fetchData}>Retry</button>
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <p>Loading events...</p>
        </div>
      )}

      <div className="events-sections">
        {sections.map((section) => (
          <div key={section.id} className="event-section">
            <div className="section-header">
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => toggleSection(section.id)}
                />
                <span className="section-title">
                  {section.label} ({getSectionCount(section.id)})
                </span>
              </label>
              <button
                className="section-copy-button"
                onClick={() => copySection(section.id)}
                disabled={loading || section.data.length === 0}
                title={`Copy ${section.label}`}
              >
                {copiedSection === section.id ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            {section.enabled && (
              <div className="section-content">
                {section.data.length === 0 ? (
                  <p className="no-events">No events found in this time frame</p>
                ) : (
                  <div className="events-list">
                    {section.data.map((event) => {
                      // Transform event to include local timestamps
                      const eventWithLocalTime = addLocalTimestamp(event)
                      return (
                        <div key={event.id} className="event-item">
                          <pre className="event-json">{JSON.stringify(eventWithLocalTime, null, 2)}</pre>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
