/**
 * Configuration for auto-tracking features
 */
export interface AutoTrackConfig {
  pageViews?: boolean;
  errors?: boolean;
  apiErrors?: boolean;
  clicks?: boolean;
  formChanges?: boolean;
  apiCalls?: boolean;
}

/**
 * Selectors for auto-tracking specific elements
 */
export interface AutoTrackSelectors {
  clicks?: string[];
}

/**
 * Exclusion configuration
 */
export interface ExcludeConfig {
  paths?: string[];
  selectors?: string[];
}

/**
 * Observability client configuration
 */
export interface ObservabilityConfig {
  serviceUrl?: string;
  serviceName?: string;
  autoTrack?: AutoTrackConfig;
  autoTrackSelectors?: AutoTrackSelectors;
  exclude?: ExcludeConfig;
  batchSize?: number;
  batchInterval?: number;
  retryAttempts?: number;
  devMode?: boolean;
  testMode?: boolean;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  [key: string]: any;
}

/**
 * UI Event metadata
 */
export interface UIEventMetadata {
  elementName?: string;
  elementId?: string;
  pagePath?: string;
  pageContext?: string;
  routeName?: string;
  eventValue?: string;
  [key: string]: any;
}

/**
 * Error info for UI errors
 */
export interface UIErrorInfo {
  errorType?: string;
  errorStack?: string;
  errorSource?: string;
  lineNumber?: number;
  columnNumber?: number;
  pageContext?: string;
}

/**
 * Request config for service errors
 */
export interface ServiceErrorRequestConfig {
  url?: string;
  method?: string;
  headers?: any;
  data?: any;
}

/**
 * Queued event for offline support
 */
export interface QueuedEvent {
  id: string;
  type: 'event' | 'ui_event' | 'ui_error' | 'service_error';
  payload: any;
  timestamp: number;
  retries: number;
}
