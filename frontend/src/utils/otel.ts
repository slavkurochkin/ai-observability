import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { trace } from '@opentelemetry/api';

let provider: WebTracerProvider | null = null;

export function initOpenTelemetry() {
  if (provider) {
    return; // Already initialized
  }

  const otelCollectorUrl = import.meta.env.VITE_OTEL_COLLECTOR_URL || 'http://localhost:4318';

  // Create resource
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'observability-demo-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: import.meta.env.MODE || 'development',
  });

  // Create tracer provider
  provider = new WebTracerProvider({
    resource: resource,
  });

  // Add OTLP exporter
  const exporter = new OTLPTraceExporter({
    url: `${otelCollectorUrl}/v1/traces`,
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  // Register the provider
  provider.register();

  // Register auto-instrumentations
  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
        // Configure fetch instrumentation to propagate trace headers
        '@opentelemetry/instrumentation-fetch': {
          propagateTraceHeaderCorsUrls: [
            /http:\/\/localhost:8006/, // Observability Service
          ],
        },
        '@opentelemetry/instrumentation-xml-http-request': {
          propagateTraceHeaderCorsUrls: [
            /http:\/\/localhost:8006/, // Observability Service
          ],
        },
      }),
    ],
  });

  console.log('OpenTelemetry initialized');
}

// Get or create session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

// Get user ID from localStorage (stored by auth context)
function getUserId(): number | null {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.id || null;
    }
  } catch (e) {
    // Ignore parse errors
  }
  return null;
}

export async function trackEvent(eventName: string, metadata: Record<string, any> = {}): Promise<void> {
  // Create OpenTelemetry span for tracing
  const tracer = trace.getTracer('observability-demo-frontend');
  const span = tracer.startSpan(`user.${eventName}`);
  
  Object.entries(metadata).forEach(([key, value]) => {
    span.setAttribute(key, String(value));
  });
  
  span.end();

  // Send event to observability service API
  try {
    const observabilityUrl = import.meta.env.VITE_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006';
    const userId = getUserId();
    const sessionId = getSessionId();
    
    const response = await fetch(`${observabilityUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        event_type: eventName,
        event_category: metadata.category || 'user_interaction',
        event_metadata: metadata,
        user_agent: navigator.userAgent,
        service_name: 'observability-demo-frontend',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send event to observability service: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.debug('Event tracked successfully:', result);
  } catch (error) {
    // Log error but don't break the app
    console.error('Failed to send event to observability service:', error);
    // Re-throw in development to help debugging
    if (import.meta.env.DEV) {
      console.error('Event payload:', {
        event_type: eventName,
        metadata,
        userId,
        sessionId: getSessionId(),
      });
    }
  }
}

export function startSpan(name: string, metadata?: Record<string, any>) {
  const tracer = trace.getTracer('observability-demo-frontend');
  const span = tracer.startSpan(name);
  
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      span.setAttribute(key, String(value));
    });
  }
  
  return span;
}

/**
 * Create a span that automatically ends after async operation completes
 */
export async function withSpan<T>(
  name: string,
  operation: (span: any) => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const span = startSpan(name, metadata);
  try {
    const result = await operation(span);
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error: any) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error?.message }); // ERROR
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Track UI event to dedicated UI events table (optimized for UI analytics)
 * This sends to /ui-events endpoint which stores in ui_events table
 */
export async function trackUIEvent(
  interactionType: string,
  elementType: string,
  metadata: {
    elementName?: string;
    elementId?: string;
    pagePath?: string;
    pageContext?: string;
    routeName?: string;
    eventValue?: string;
    [key: string]: any;
  } = {}
) {
  // Create OpenTelemetry span for tracing
  const tracer = trace.getTracer('observability-demo-frontend');
  const span = tracer.startSpan(`ui.${interactionType}`);
  
  span.setAttribute('element_type', elementType);
  span.setAttribute('interaction_type', interactionType);
  if (metadata.elementName) span.setAttribute('element_name', metadata.elementName);
  if (metadata.pagePath) span.setAttribute('page_path', metadata.pagePath);
  
  span.end();

  // Send event to observability service API
  try {
    const observabilityUrl = import.meta.env.VITE_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006';
    const userId = getUserId();
    const sessionId = getSessionId();
    
    // Get current page path
    const currentPath = window.location.pathname;
    
    // Extract viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Determine device type
    const deviceType = viewportWidth < 768 ? 'mobile' : viewportWidth < 1024 ? 'tablet' : 'desktop';
    
    const response = await fetch(`${observabilityUrl}/ui-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        user_agent: navigator.userAgent,
        viewport_width: viewportWidth,
        viewport_height: viewportHeight,
        device_type: deviceType,
        time_to_interaction_ms: metadata.timeToInteractionMs,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send UI event to observability service: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.debug('UI event tracked successfully:', result);
  } catch (error) {
    // Log error but don't break the app
    console.error('Failed to send UI event to observability service:', error);
    // Re-throw in development to help debugging
    if (import.meta.env.DEV) {
      console.error('UI event payload:', {
        interactionType,
        elementType,
        metadata,
      });
    }
  }
}

/**
 * Track service/network error to dedicated service errors table
 * This sends to /errors/services endpoint which stores in service_errors table
 */
export async function trackServiceError(
  error: any,
  requestConfig?: {
    url?: string;
    method?: string;
    headers?: any;
    data?: any;
  }
) {
  // Create OpenTelemetry span for tracing
  const tracer = trace.getTracer('observability-demo-frontend');
  const span = tracer.startSpan('service.error');
  
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const statusCode = error?.response?.status;
    const errorType = error?.code || (statusCode ? 'HTTPError' : 'NetworkError');
    
    // Determine severity based on status code
    let severity: 'INFO' | 'WARNING' | 'ERROR' = 'ERROR';
    if (statusCode) {
      if (statusCode >= 500) {
        severity = 'ERROR';  // Server errors
      } else if (statusCode >= 400) {
        if (statusCode === 404) {
          severity = 'INFO';  // 404s are often expected (missing endpoints, etc.)
        } else {
          severity = 'WARNING';  // Client errors (4xx)
        }
      } else {
        severity = 'INFO';  // Other status codes
      }
    } else {
      severity = 'ERROR';  // Network errors, timeouts, etc.
    }
  
    span.setAttribute('error.type', errorType);
    span.setAttribute('error.message', errorMessage);
    span.setAttribute('error.severity', severity);
    if (statusCode) span.setAttribute('http.status_code', statusCode);
    if (requestConfig?.url) span.setAttribute('http.url', requestConfig.url);
    if (requestConfig?.method) span.setAttribute('http.method', requestConfig.method);
  
    span.recordException(error);
    span.setStatus({ code: 2, message: errorMessage }); // ERROR status
    span.end();

  // Send error to observability service API
  try {
    const observabilityUrl = import.meta.env.VITE_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006';
    const userId = getUserId();
    const sessionId = getSessionId();
    
    // Extract service name from URL
    const url = requestConfig?.url || error?.config?.url || error?.request?.responseURL || '';
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    
    // Determine service name from URL
    let serviceName = 'frontend';
    if (url.includes('/api/observability') || url.includes('localhost:8006')) {
      serviceName = 'observability-service';
    } else if (url) {
      // Try to extract service name from URL
      const match = url.match(/\/api\/(\w+)/);
      if (match) {
        serviceName = `${match[1]}-service`;
      }
    }
    
    // Extract endpoint path
    const endpoint = url.split('?')[0]; // Remove query params
    
    // Get response body if available
    let responseBody = null;
    try {
      if (error?.response?.data) {
        responseBody = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    // Get request body if available
    let requestBody = null;
    try {
      if (requestConfig?.data) {
        requestBody = typeof requestConfig.data === 'string'
          ? requestConfig.data
          : JSON.stringify(requestConfig.data);
      } else if (error?.config?.data) {
        requestBody = typeof error.config.data === 'string'
          ? error.config.data
          : JSON.stringify(error.config.data);
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    await fetch(`${observabilityUrl}/errors/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        error_message: errorMessage,
        error_type: errorType,
        status_code: statusCode,
        severity: severity,
        request_url: fullUrl,
        request_method: requestConfig?.method || error?.config?.method || 'GET',
        request_headers: requestConfig?.headers || error?.config?.headers || {},
        request_body: requestBody,
        response_body: responseBody,
        response_headers: error?.response?.headers || {},
        service_name: serviceName,
        endpoint: endpoint,
        request_id: error?.response?.headers?.['x-request-id'] || error?.config?.headers?.['x-request-id'],
        error_code: error?.code,
        timeout_ms: error?.config?.timeout,
        error_metadata: {
          stack: error?.stack,
          name: error?.name,
          config: error?.config ? {
            url: error.config.url,
            method: error.config.method,
            timeout: error.config.timeout,
          } : undefined,
        },
        user_agent: navigator.userAgent,
      }),
    });
  } catch (trackingError) {
    // Silently fail - don't break the app if observability service is down
    console.debug('Failed to send service error to observability service:', trackingError);
  }
}

/**
 * Track UI console error to dedicated UI errors table
 * This sends to /errors/ui endpoint which stores in ui_errors table
 */
export async function trackUIError(
  error: Error | string,
  errorInfo?: {
    errorType?: string;
    errorStack?: string;
    errorSource?: string;
    lineNumber?: number;
    columnNumber?: number;
    pageContext?: string;
  }
) {
  // Create OpenTelemetry span for tracing
  const tracer = trace.getTracer('observability-demo-frontend');
  const span = tracer.startSpan('ui.error');
  
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
  const errorType = errorInfo?.errorType || (error instanceof Error ? error.name : 'Error');
  const errorStack = errorInfo?.errorStack || (error instanceof Error ? error.stack : undefined);
  
  span.setAttribute('error.type', errorType);
  span.setAttribute('error.message', errorMessage);
  if (errorStack) span.setAttribute('error.stack', errorStack);
  
  if (error instanceof Error) {
    span.recordException(error);
  }
  span.setStatus({ code: 2, message: errorMessage }); // ERROR status
  span.end();

  // Send error to observability service API
  try {
    const observabilityUrl = import.meta.env.VITE_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006';
    const userId = getUserId();
    const sessionId = getSessionId();
    
    // Get current page path
    const currentPath = window.location.pathname;
    
    // Extract viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Determine device type
    const deviceType = viewportWidth < 768 ? 'mobile' : viewportWidth < 1024 ? 'tablet' : 'desktop';
    
    console.debug('Tracking UI error:', { errorMessage, errorType, currentPath });
    
    const response = await fetch(`${observabilityUrl}/errors/ui`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        error_message: errorMessage,
        error_type: errorType,
        error_stack: errorStack,
        error_source: errorInfo?.errorSource,
        line_number: errorInfo?.lineNumber,
        column_number: errorInfo?.columnNumber,
        page_path: currentPath,
        page_context: errorInfo?.pageContext || document.title,
        route_name: currentPath,
        error_metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
        user_agent: navigator.userAgent,
        viewport_width: viewportWidth,
        viewport_height: viewportHeight,
        device_type: deviceType,
      }),
    });
    
    if (!response.ok) {
      console.warn('Failed to send UI error to observability service:', response.status, response.statusText);
    } else {
      console.debug('UI error tracked successfully');
    }
  } catch (trackingError) {
    // Log but don't break the app if observability service is down
    console.warn('Failed to send UI error to observability service:', trackingError);
  }
}

