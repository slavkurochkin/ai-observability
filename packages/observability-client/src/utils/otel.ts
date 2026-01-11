import { trace } from '@opentelemetry/api';

/**
 * Start a new OpenTelemetry span
 */
export function startSpan(name: string, metadata?: Record<string, any>) {
  try {
    const tracer = trace.getTracer('observability-client');
    const span = tracer.startSpan(name);
    
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        span.setAttribute(key, String(value));
      });
    }
    
    return span;
  } catch (error) {
    // Return a mock span if OpenTelemetry is not available
    return {
      setAttribute: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {},
    };
  }
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
