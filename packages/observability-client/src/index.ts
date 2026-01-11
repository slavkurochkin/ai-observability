import { mergeConfig, getConfig } from './core/config';
import { initHttpClient, getHttpClient } from './core/client';
import { initAutoInstrumentation } from './tracking/auto-instrumentation';
import type { ObservabilityConfig } from './types';

/**
 * Initialize observability client
 */
export async function initObservability(config: ObservabilityConfig = {}): Promise<void> {
  // Merge configuration
  const mergedConfig = mergeConfig(config);

  // Initialize HTTP client
  initHttpClient();

  // Check Docker service health
  const httpClient = getHttpClient();
  const isHealthy = await httpClient.checkHealth();

  if (!isHealthy) {
    const serviceUrl = mergedConfig.serviceUrl;
    if (mergedConfig.devMode) {
      console.warn(
        `[Observability] Service at ${serviceUrl} is not available. ` +
        `Events will be queued locally. Make sure Docker services are running: ` +
        `docker-compose up -d observability-service observability-db`
      );
    }
  } else if (mergedConfig.devMode) {
    console.log(`[Observability] Service is healthy at ${mergedConfig.serviceUrl}`);
  }

  // Initialize auto-instrumentation
  initAutoInstrumentation();

  if (mergedConfig.devMode) {
    console.log('[Observability] Initialized successfully');
  }
}

// Export tracking functions
export { trackEvent, trackEventTelemetryOnly } from './tracking/events';
export { trackUIEvent } from './tracking/ui-events';
export { trackUIError, trackServiceError } from './tracking/errors';

// Export components
export {
  TrackedButton,
  TrackedInput,
  TrackedCheckbox,
  TrackedSelect,
} from './components';

export type {
  TrackedButtonProps,
  TrackedInputProps,
  TrackedCheckboxProps,
  TrackedSelectProps,
} from './components';

// Export hooks
export { useObservability, useAutoTracking } from './hooks';

// Export utilities
export { startSpan, withSpan } from './utils/otel';
export { getSessionId, resetSession } from './core/session';
export { getUserId, setUserId, getObservabilityUserId } from './utils/user';
export { getDeviceType, getViewportDimensions, getUserAgent } from './utils/device';

// Export types
export type {
  ObservabilityConfig,
  AutoTrackConfig,
  AutoTrackSelectors,
  ExcludeConfig,
  EventMetadata,
  UIEventMetadata,
  UIErrorInfo,
  ServiceErrorRequestConfig,
} from './types';

// Export config utilities
export { getConfig, updateConfig } from './core/config';
