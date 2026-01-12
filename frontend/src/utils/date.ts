/**
 * Format a UTC timestamp string to local time
 * @param timestamp - ISO timestamp string (UTC) from the API
 * @returns Formatted local time string
 */
export function formatTimestampToLocal(timestamp: string | Date): string {
  try {
    let date: Date
    let timestampStr: string | undefined
    
    // Handle both string and Date objects
    if (timestamp instanceof Date) {
      date = timestamp
    } else {
      timestampStr = String(timestamp).trim()
      
      // FastAPI/Pydantic serializes datetime to ISO format
      // Naive datetimes (without timezone) are serialized as "2024-12-25T20:45:30.123456"
      // We need to ensure these are treated as UTC
      
      // Check if it already has timezone info
      const hasTimezone = timestampStr.endsWith('Z') || timestampStr.match(/[+-]\d{2}:?\d{2}$/)
      
      if (!hasTimezone) {
        // Handle microseconds - JavaScript Date only supports milliseconds
        // Convert 6-digit microseconds to 3-digit milliseconds
        timestampStr = timestampStr.replace(/\.(\d{6})(\d*)/, (match, microsecs, extra) => {
          const millisecs = microsecs.substring(0, 3)
          return `.${millisecs}`
        })
        
        // Append 'Z' to indicate UTC
        timestampStr = timestampStr + 'Z'
      } else {
        // Has timezone, but might have microseconds - convert those too
        timestampStr = timestampStr.replace(/\.(\d{6})(\d*)/, (match, microsecs, extra) => {
          const millisecs = microsecs.substring(0, 3)
          return `.${millisecs}`
        })
      }
      
      date = new Date(timestampStr)
    }
    
    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', timestamp, 'parsed as:', timestampStr || 'N/A')
      return String(timestamp)
    }
    
    // Format as: "MM/DD/YYYY, HH:MM:SS AM/PM"
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch (error) {
    console.error('Error formatting timestamp:', error, 'timestamp:', timestamp)
    return String(timestamp) // Return original if parsing fails
  }
}

/**
 * Format a UTC timestamp string to local time with timezone info
 * @param timestamp - ISO timestamp string (UTC) from the API
 * @returns Formatted local time string with timezone
 */
export function formatTimestampToLocalWithTimezone(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const localTime = date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })
    return `${localTime} (UTC: ${date.toISOString()})`
  } catch (error) {
    console.error('Error formatting timestamp:', error)
    return timestamp // Return original if parsing fails
  }
}

/**
 * Transform event data to include local timestamp formatting
 * Replaces timestamp with local time display and adds UTC reference
 */
export function addLocalTimestamp(event: any): any {
  if (!event || typeof event !== 'object') {
    return event
  }

  const transformed = { ...event }

  // Handle timestamp field - show local time prominently, keep UTC as reference
  if (event.timestamp) {
    // Preserve original timestamp
    const originalTimestamp = event.timestamp
    transformed.timestamp_utc = originalTimestamp // Keep original UTC for reference
    
    // Format as local time
    const localTime = formatTimestampToLocal(originalTimestamp)
    transformed.timestamp = localTime
    
    // Debug: log first event to help troubleshoot
    if (process.env.NODE_ENV === 'development' && event.id === 1) {
      console.log('Timestamp conversion:', {
        original: originalTimestamp,
        local: localTime,
        type: typeof originalTimestamp,
      })
    }
  }

  // Handle started_at and ended_at for sessions
  if (event.started_at) {
    const originalStartedAt = event.started_at
    transformed.started_at_utc = originalStartedAt
    transformed.started_at = formatTimestampToLocal(originalStartedAt)
  }
  if (event.ended_at) {
    const originalEndedAt = event.ended_at
    transformed.ended_at_utc = originalEndedAt
    transformed.ended_at = formatTimestampToLocal(originalEndedAt)
  }

  return transformed
}
