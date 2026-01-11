import { trace } from '@opentelemetry/api';
import { getConfig } from '../core/config';
import { getSessionId } from '../core/session';
import { getObservabilityUserId } from '../utils/user';
import { getDeviceType, getViewportDimensions, getUserAgent } from '../utils/device';
import { getHttpClient } from '../core/client';
import type { UIErrorInfo, ServiceErrorRequestConfig } from '../types';

/**
 * Track UI console error to dedicated UI errors table
 * This sends to /errors/ui endpoint which stores in ui_errors table
 */
export async function trackUIError(
  error: Error | string,
  errorInfo?: UIErrorInfo
): Promise<void> {
  const config = getConfig();
  const sessionId = getSessionId();
  const userId = getObservabilityUserId();

  const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
  const errorType = errorInfo?.errorType || (error instanceof Error ? error.name : 'Error');
  const errorStack = errorInfo?.errorStack || (error instanceof Error ? error.stack : undefined);

  // Create OpenTelemetry span for tracing
  try {
    const tracer = trace.getTracer('observability-client');
    const span = tracer.startSpan('ui.error');
    
    span.setAttribute('error.type', errorType);
    span.setAttribute('error.message', errorMessage);
    if (errorStack) span.setAttribute('error.stack', errorStack);
    
    if (error instanceof Error) {
      span.recordException(error);
    }
    span.setStatus({ code: 2, message: errorMessage }); // ERROR status
    span.end();
  } catch (otelError) {
    // Silently fail if OpenTelemetry is not available
  }

  // Get current page path
  const currentPath = typeof window !== 'undefined' 
    ? window.location.pathname 
    : '';

  // Get viewport dimensions
  const viewport = getViewportDimensions();
  const deviceType = getDeviceType();

  // Send error to observability service API
  try {
    const payload = {
      user_id: userId,
      session_id: sessionId,
      error_message: errorMessage,
      error_type: errorType,
      error_stack: errorStack,
      error_source: errorInfo?.errorSource,
      line_number: errorInfo?.lineNumber,
      column_number: errorInfo?.columnNumber,
      page_path: currentPath,
      page_context: errorInfo?.pageContext || (typeof document !== 'undefined' ? document.title : ''),
      route_name: currentPath,
      error_metadata: {
        userAgent: getUserAgent(),
        url: typeof window !== 'undefined' ? window.location.href : '',
      },
      user_agent: getUserAgent(),
      viewport_width: viewport.width,
      viewport_height: viewport.height,
      device_type: deviceType,
    };

    await getHttpClient().send('/errors/ui', payload, {
      queueOnFailure: true,
      immediate: false,
    });

    if (config.devMode) {
      console.debug('[Observability] UI error tracked:', errorMessage);
    }
  } catch (error) {
    // Error is already handled by HTTP client (queued if needed)
    if (config.devMode) {
      console.warn('[Observability] Failed to track UI error:', error);
    }
  }
}

/**
 * Track service/network error to dedicated service errors table
 * This sends to /errors/services endpoint which stores in service_errors table
 */
export async function trackServiceError(
  error: any,
  requestConfig?: ServiceErrorRequestConfig
): Promise<void> {
  const config = getConfig();
  const sessionId = getSessionId();
  const userId = getObservabilityUserId();

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

  // Create OpenTelemetry span for tracing
  try {
    const tracer = trace.getTracer('observability-client');
    const span = tracer.startSpan('service.error');
    
    span.setAttribute('error.type', errorType);
    span.setAttribute('error.message', errorMessage);
    span.setAttribute('error.severity', severity);
    if (statusCode) span.setAttribute('http.status_code', statusCode);
    if (requestConfig?.url) span.setAttribute('http.url', requestConfig.url);
    if (requestConfig?.method) span.setAttribute('http.method', requestConfig.method);
  
    span.recordException(error);
    span.setStatus({ code: 2, message: errorMessage }); // ERROR status
    span.end();
  } catch (otelError) {
    // Silently fail if OpenTelemetry is not available
  }

  // Extract service name from URL
  const url = requestConfig?.url || error?.config?.url || error?.request?.responseURL || '';
  const fullUrl = typeof window !== 'undefined' && url.startsWith('http') 
    ? url 
    : (typeof window !== 'undefined' ? `${window.location.origin}${url}` : url);
  
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

  // Send error to observability service API
  try {
    const payload = {
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
      user_agent: getUserAgent(),
    };

    await getHttpClient().send('/errors/services', payload, {
      queueOnFailure: true,
      immediate: false,
    });

    if (config.devMode) {
      console.debug('[Observability] Service error tracked:', errorMessage);
    }
  } catch (trackingError) {
    // Silently fail - don't break the app if observability service is down
    if (config.devMode) {
      console.debug('[Observability] Failed to send service error:', trackingError);
    }
  }
}
