/**
 * Get or create session ID
 * Uses sessionStorage to persist session across page reloads
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  let sessionId = sessionStorage.getItem('observability_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('observability_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Reset session ID (creates new session)
 */
export function resetSession(): string {
  if (typeof window === 'undefined') {
    return getSessionId();
  }

  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('observability_session_id', newSessionId);
  return newSessionId;
}
