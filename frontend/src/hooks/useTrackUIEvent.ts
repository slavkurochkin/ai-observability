import { useCallback } from 'react';
import { useObservability } from '../contexts/ObservabilityContext';

/**
 * Hook for tracking UI events with consistent metadata
 * 
 * @example
 * const trackUI = useTrackUIEvent('evaluations_page');
 * 
 * // Track button click
 * trackUI('button_click', { button_name: 'create_evaluation' });
 * 
 * // Track checkbox change
 * trackUI('checkbox_change', { checkbox_name: 'enable_filter', checked: true });
 */
export function useTrackUIEvent(context?: string) {
  const { trackEvent } = useObservability();

  return useCallback(
    (eventName: string, metadata: Record<string, any> = {}) => {
      const eventMetadata = {
        ...metadata,
        category: metadata.category || 'ui_interaction',
        context: context || metadata.context || 'unknown',
        timestamp: new Date().toISOString(),
      };

      trackEvent(eventName, eventMetadata);
    },
    [trackEvent, context]
  );
}

