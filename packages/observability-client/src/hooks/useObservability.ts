import { useCallback } from 'react';
import { trackEvent, trackEventTelemetryOnly } from '../tracking/events';
import { trackUIEvent } from '../tracking/ui-events';
import { trackUIError, trackServiceError } from '../tracking/errors';
import { startSpan } from '../utils/otel';

/**
 * Hook to access observability functions in React components
 */
export function useObservability() {
  const handleTrackEvent = useCallback(
    async (eventName: string, metadata?: Record<string, any>) => {
      await trackEvent(eventName, metadata);
    },
    []
  );

  const handleTrackEventTelemetryOnly = useCallback(
    (eventName: string, metadata?: Record<string, any>) => {
      trackEventTelemetryOnly(eventName, metadata);
    },
    []
  );

  const handleTrackUIEvent = useCallback(
    async (
      interactionType: string,
      elementType: string,
      metadata?: Record<string, any>
    ) => {
      await trackUIEvent(interactionType, elementType, metadata);
    },
    []
  );

  const handleTrackUIError = useCallback(
    async (error: Error | string, errorInfo?: Record<string, any>) => {
      await trackUIError(error, errorInfo);
    },
    []
  );

  const handleTrackServiceError = useCallback(
    async (error: any, requestConfig?: Record<string, any>) => {
      await trackServiceError(error, requestConfig);
    },
    []
  );

  return {
    trackEvent: handleTrackEvent,
    trackEventTelemetryOnly: handleTrackEventTelemetryOnly,
    trackUIEvent: handleTrackUIEvent,
    trackUIError: handleTrackUIError,
    trackServiceError: handleTrackServiceError,
    startSpan,
  };
}
