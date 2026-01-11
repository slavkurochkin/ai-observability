import type { ObservabilityConfig } from '../types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ObservabilityConfig> = {
  serviceUrl: 'http://localhost:8006',
  serviceName: '@ai-observability/client',
  autoTrack: {
    pageViews: true,
    errors: true,
    apiErrors: true,
    clicks: false,
    formChanges: false,
    apiCalls: false,
  },
  autoTrackSelectors: {
    clicks: [],
  },
  exclude: {
    paths: [],
    selectors: [],
  },
  batchSize: 10,
  batchInterval: 5000,
  retryAttempts: 3,
  devMode: typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'),
  testMode: false,
};

/**
 * Global configuration instance
 */
let globalConfig: Required<ObservabilityConfig> = { ...DEFAULT_CONFIG };

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: ObservabilityConfig = {}): Required<ObservabilityConfig> {
  const merged: Required<ObservabilityConfig> = {
    serviceUrl: userConfig.serviceUrl ?? DEFAULT_CONFIG.serviceUrl,
    serviceName: userConfig.serviceName ?? DEFAULT_CONFIG.serviceName,
    autoTrack: {
      ...DEFAULT_CONFIG.autoTrack,
      ...userConfig.autoTrack,
    },
    autoTrackSelectors: {
      ...DEFAULT_CONFIG.autoTrackSelectors,
      ...userConfig.autoTrackSelectors,
    },
    exclude: {
      ...DEFAULT_CONFIG.exclude,
      ...userConfig.exclude,
    },
    batchSize: userConfig.batchSize ?? DEFAULT_CONFIG.batchSize,
    batchInterval: userConfig.batchInterval ?? DEFAULT_CONFIG.batchInterval,
    retryAttempts: userConfig.retryAttempts ?? DEFAULT_CONFIG.retryAttempts,
    devMode: userConfig.devMode ?? DEFAULT_CONFIG.devMode,
    testMode: userConfig.testMode ?? DEFAULT_CONFIG.testMode,
  };

  globalConfig = merged;
  return merged;
}

/**
 * Get current configuration
 */
export function getConfig(): Required<ObservabilityConfig> {
  return { ...globalConfig };
}

/**
 * Update configuration
 */
export function updateConfig(updates: Partial<ObservabilityConfig>): void {
  globalConfig = mergeConfig({ ...globalConfig, ...updates });
}
