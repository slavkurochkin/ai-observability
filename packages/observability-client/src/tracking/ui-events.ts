import { trace } from '@opentelemetry/api';
import { getConfig } from '../core/config';
import { getSessionId } from '../core/session';
import { getObservabilityUserId } from '../utils/user';
import { getDeviceType, getViewportDimensions, getUserAgent } from '../utils/device';
import { getHttpClient } from '../core/client';
import type { UIEventMetadata } from '../types';

/**
 * Track UI event to dedicated UI events table (optimized for UI analytics)
 * This sends to /ui-events endpoint which stores in ui_events table
 */
export async function trackUIEvent(
  interactionType: string,
  elementType: string,
  metadata: UIEventMetadata = {}
): Promise<void> {
  const config = getConfig();
  const sessionId = getSessionId();
  const userId = getObservabilityUserId();

  // Create OpenTelemetry span for tracing
  try {
    const tracer = trace.getTracer('observability-client');
    const span = tracer.startSpan(`ui.${interactionType}`);
    
    span.setAttribute('element_type', elementType);
    span.setAttribute('interaction_type', interactionType);
    if (metadata.elementName) span.setAttribute('element_name', metadata.elementName);
    if (metadata.pagePath) span.setAttribute('page_path', metadata.pagePath);
    
    span.end();
  } catch (error) {
    // Silently fail if OpenTelemetry is not available
  }

  // Get current page path if not provided
  const currentPath = typeof window !== 'undefined' 
    ? window.location.pathname 
    : metadata.pagePath || '';

  // Get viewport dimensions
  const viewport = getViewportDimensions();
  const deviceType = getDeviceType();

  // Send event to observability service API
  try {
    const payload = {
      user_id: userId,
      session_id: sessionId,
      interaction_type: interactionType,
      element_type: elementType,
      element_name: metadata.elementName,
      element_id: metadata.elementId,
      page_path: metadata.pagePath || currentPath,
      page_context: metadata.pageContext,
      route_name: metadata.routeName,
      event_value: metadata.eventValue,
      event_metadata: {
        ...metadata,
        // Remove fields that are already top-level
        elementName: undefined,
        elementId: undefined,
        pagePath: undefined,
        pageContext: undefined,
        routeName: undefined,
        eventValue: undefined,
      },
      user_agent: getUserAgent(),
      viewport_width: viewport.width,
      viewport_height: viewport.height,
      device_type: deviceType,
      time_to_interaction_ms: metadata.timeToInteractionMs,
    };

    await getHttpClient().send('/ui-events', payload, {
      queueOnFailure: true,
      immediate: false,
    });

    if (config.devMode) {
      console.debug('[Observability] UI event tracked:', interactionType, elementType, metadata);
    }
  } catch (error) {
    // Error is already handled by HTTP client (queued if needed)
    if (config.devMode) {
      console.error('[Observability] Failed to track UI event:', error);
    }
  }
}
