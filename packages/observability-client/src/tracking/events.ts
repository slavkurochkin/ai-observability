import { trace } from '@opentelemetry/api';
import { getConfig } from '../core/config';
import { getSessionId } from '../core/session';
import { getObservabilityUserId } from '../utils/user';
import { getUserAgent } from '../utils/device';
import { getHttpClient } from '../core/client';
import type { EventMetadata } from '../types';

/**
 * Track event only via OpenTelemetry (Loki/Grafana stack) without storing in database
 * Use this for events that should only be tracked in distributed tracing/logs
 */
export function trackEventTelemetryOnly(eventName: string, metadata: EventMetadata = {}): void {
  try {
    const tracer = trace.getTracer('observability-client');
    const span = tracer.startSpan(`user.${eventName}`);
    
    Object.entries(metadata).forEach(([key, value]) => {
      span.setAttribute(key, String(value));
    });
    
    span.end();
  } catch (error) {
    // Silently fail if OpenTelemetry is not available
    if (getConfig().devMode) {
      console.warn('[Observability] Failed to create OpenTelemetry span:', error);
    }
  }
}

/**
 * Track user event (sends to database via observability service)
 */
export async function trackEvent(eventName: string, metadata: EventMetadata = {}): Promise<void> {
  const config = getConfig();
  const sessionId = getSessionId();
  const userId = getObservabilityUserId();

  // Create OpenTelemetry span for tracing
  trackEventTelemetryOnly(eventName, metadata);

  // Send event to observability service API
  try {
    const payload = {
      user_id: userId,
      session_id: sessionId,
      event_type: eventName,
      event_category: metadata.category || 'user_interaction',
      event_metadata: metadata,
      user_agent: getUserAgent(),
      service_name: config.serviceName,
    };

    await getHttpClient().send('/events', payload, {
      queueOnFailure: true,
      immediate: false,
    });

    if (config.devMode) {
      console.debug('[Observability] Event tracked:', eventName, metadata);
    }
  } catch (error) {
    // Error is already handled by HTTP client (queued if needed)
    if (config.devMode) {
      console.error('[Observability] Failed to track event:', error);
    }
  }
}
