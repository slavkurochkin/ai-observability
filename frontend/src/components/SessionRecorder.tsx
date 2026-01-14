import { useState, useEffect, useRef } from 'react'
import './SessionRecorder.css'
import { formatTimestampToLocal } from '../utils/date'

const API_BASE_URL = 'http://localhost:8006'

interface RecordedSession {
  id: number
  name: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  notes: string | null
  session_metadata: any
}

interface SessionRecorderProps {
  onSessionEnded?: (session: RecordedSession) => void
}

export default function SessionRecorder({ onSessionEnded }: SessionRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionName, setSessionName] = useState('')
  const [sessions, setSessions] = useState<RecordedSession[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording])

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/record?limit=50`)
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      } else {
        // Silently fail - sessions are optional
        setSessions([])
      }
    } catch (error: any) {
      // Silently fail for sessions - connection errors are expected if backend is down
      setSessions([])
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Sessions endpoint unavailable:', error.message)
      }
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName || null,
          notes: null,
          session_metadata: null,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const session = await response.json()
      setCurrentSessionId(session.id)
      setIsRecording(true)
      setElapsedSeconds(0)
      setSessionName('')
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || ''
      const isConnectionError = 
        errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed') ||
        error instanceof TypeError
      
      const userMessage = isConnectionError
        ? 'Cannot connect to observability service. Please ensure the backend service is running.'
        : 'Failed to start recording session'
      alert(userMessage)
      // Only log detailed errors in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Failed to start recording:', error)
      }
    }
  }

  const stopRecording = async () => {
    if (!currentSessionId) return

    try {
      const response = await fetch(`${API_BASE_URL}/sessions/record/${currentSessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const session = await response.json()
      setIsRecording(false)
      setCurrentSessionId(null)
      setElapsedSeconds(0)
      await fetchSessions()
      
      if (onSessionEnded) {
        onSessionEnded(session)
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || ''
      const isConnectionError = 
        errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed') ||
        error instanceof TypeError
      
      const userMessage = isConnectionError
        ? 'Cannot connect to observability service. Please ensure the backend service is running.'
        : 'Failed to stop recording session'
      alert(userMessage)
      // Only log detailed errors in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Failed to stop recording:', error)
      }
    }
  }

  return (
    <div className="session-recorder">
      <div className="session-recorder-controls">
        {!isRecording ? (
          <div className="session-recorder-start">
            <input
              type="text"
              placeholder="Session name (optional)"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="session-name-input"
            />
            <button onClick={startRecording} className="record-button start">
              ▶ Start Recording
            </button>
          </div>
        ) : (
          <div className="session-recorder-active">
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span className="recording-text">Recording</span>
            </div>
            <div className="timer">{formatTime(elapsedSeconds)}</div>
            <button onClick={stopRecording} className="record-button stop">
              ⏹ Stop Recording
            </button>
          </div>
        )}
        <button
          onClick={() => {
            setShowSessions(!showSessions)
            if (!showSessions) {
              fetchSessions()
            }
          }}
          className="sessions-toggle-button"
        >
          {showSessions ? '▼' : '▶'} Sessions
        </button>
      </div>

      {showSessions && (
        <div className="sessions-list">
          <h3>Recorded Sessions</h3>
          {sessions.length === 0 ? (
            <p className="no-sessions">No recorded sessions yet</p>
          ) : (
            <div className="sessions-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.id}</td>
                      <td>{session.name || 'Unnamed'}</td>
                      <td>{formatTimestampToLocal(session.started_at)}</td>
                      <td>
                        {session.ended_at
                          ? formatTimestampToLocal(session.ended_at)
                          : 'Active'}
                      </td>
                      <td>
                        {session.duration_seconds
                          ? formatTime(session.duration_seconds)
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
