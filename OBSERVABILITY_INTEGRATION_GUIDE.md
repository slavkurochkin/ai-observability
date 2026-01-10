# Observability Service Integration Guide

This guide explains how to integrate the Observability Service into any application, making it agnostic to your specific application architecture.

## Overview

The Observability Service is a standalone service that collects and stores:
- **User Events**: General user behavior events (page views, actions, etc.) - *Note: page_view events are tracked via OpenTelemetry/Loki only (not stored in database)*
- **UI Events**: Detailed UI interactions (clicks, form changes, etc.)
- **UI Errors**: Frontend JavaScript errors
- **Service Errors**: Backend/API errors

All data is stored in PostgreSQL and can be queried via REST API or directly from the database.

## Architecture

```
┌─────────────────┐
│  Your App      │
│  (Frontend)    │ ──HTTP POST──┐
└─────────────────┘              │
                                 ▼
┌─────────────────┐      ┌──────────────────┐
│  Your App       │      │  Observability   │
│  (Backend)      │ ────▶│  Service         │
└─────────────────┘      │  (Port 8006)     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  PostgreSQL      │
                         │  (observability_db)│
                         └──────────────────┘
```

## Quick Start

### 1. Start the Observability Service

```bash
# Using docker-compose (recommended)
docker-compose up -d observability-service observability-db

# Or run directly
cd services/observability-service
docker build -t observability-service .
docker run -p 8006:8006 \
  -e DATABASE_URL=postgresql://eval_user:eval_pass@host.docker.internal:5437/observability_db \
  observability-service
```

### 2. Test the Service

```bash
# Health check
curl http://localhost:8006/health

# Create a test event
curl -X POST http://localhost:8006/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "test_event",
    "event_category": "test",
    "event_metadata": {"test": true}
  }'
```

## Frontend Integration

### Step 1: Install Dependencies (Optional - for OpenTelemetry tracing)

If you want distributed tracing, install OpenTelemetry:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-web
```

### Step 2: Create Observability Utility

Create a file `src/utils/observability.ts`:

```typescript
// Get or create session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

// Get user ID from your auth system
function getUserId(): number | null {
  // Replace with your auth system
  const user = localStorage.getItem('user');
  if (user) {
    try {
      return JSON.parse(user).id || null;
    } catch {
      return null;
    }
  }
  return null;
}

// Base URL for observability service
const OBSERVABILITY_URL = import.meta.env.VITE_OBSERVABILITY_URL || 'http://localhost:8006';

/**
 * Track a general user event
 * Stores event in database AND sends to OpenTelemetry/Loki
 */
export async function trackEvent(
  eventType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await fetch(`${OBSERVABILITY_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getUserId(),
        session_id: getSessionId(),
        event_type: eventType,
        event_category: metadata.category || 'user_interaction',
        event_metadata: metadata,
        user_agent: navigator.userAgent,
        service_name: 'your-app-name',
      }),
    });
  } catch (error) {
    // Silently fail - don't break the app
    console.debug('Failed to track event:', error);
  }
}

/**
 * Track event via OpenTelemetry only (Loki/Grafana stack)
 * Does NOT store in database - only sends to distributed tracing/logs
 * Use this for high-volume events like page_view that you want in logs but not in database
 */
export function trackEventTelemetryOnly(
  eventType: string,
  metadata: Record<string, any> = {}
): void {
  // Creates OpenTelemetry span that goes to Loki/Grafana stack
  // No database API call
  const tracer = trace.getTracer('your-app-name');
  const span = tracer.startSpan(`user.${eventType}`);
  
  Object.entries(metadata).forEach(([key, value]) => {
    span.setAttribute(key, String(value));
  });
  
  span.end();
}

/**
 * Track a UI interaction (click, change, etc.)
 */
export async function trackUIEvent(
  interactionType: 'click' | 'change' | 'focus' | 'blur' | 'submit',
  elementType: string,
  metadata: {
    elementName?: string;
    elementId?: string;
    pagePath?: string;
    pageContext?: string;
    eventValue?: string;
    [key: string]: any;
  } = {}
): Promise<void> {
  try {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const deviceType = viewportWidth < 768 ? 'mobile' : viewportWidth < 1024 ? 'tablet' : 'desktop';

    await fetch(`${OBSERVABILITY_URL}/ui-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getUserId(),
        session_id: getSessionId(),
        interaction_type: interactionType,
        element_type: elementType,
        element_name: metadata.elementName,
        element_id: metadata.elementId,
        page_path: metadata.pagePath || window.location.pathname,
        page_context: metadata.pageContext,
        event_value: metadata.eventValue,
        event_metadata: metadata,
        user_agent: navigator.userAgent,
        viewport_width: viewportWidth,
        viewport_height: viewportHeight,
        device_type: deviceType,
      }),
    });
  } catch (error) {
    console.debug('Failed to track UI event:', error);
  }
}

/**
 * Track a UI error (JavaScript error)
 */
export async function trackUIError(
  error: Error | string,
  errorInfo?: {
    errorType?: string;
    errorStack?: string;
    errorSource?: string;
    lineNumber?: number;
    columnNumber?: number;
  }
): Promise<void> {
  try {
    const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
    const errorType = errorInfo?.errorType || (error instanceof Error ? error.name : 'Error');
    const errorStack = errorInfo?.errorStack || (error instanceof Error ? error.stack : undefined);

    await fetch(`${OBSERVABILITY_URL}/errors/ui`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getUserId(),
        session_id: getSessionId(),
        error_message: errorMessage,
        error_type: errorType,
        error_stack: errorStack,
        error_source: errorInfo?.errorSource,
        line_number: errorInfo?.lineNumber,
        column_number: errorInfo?.columnNumber,
        page_path: window.location.pathname,
        page_context: document.title,
        route_name: window.location.pathname,
        error_metadata: {
          url: window.location.href,
        },
        user_agent: navigator.userAgent,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        device_type: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
      }),
    });
  } catch (error) {
    console.warn('Failed to track UI error:', error);
  }
}

/**
 * Track a service/API error
 * 
 * ⚠️ IMPORTANT: When using fetch(), HTTP errors (404, 500, etc.) do NOT throw exceptions.
 * You must check response.ok and manually create error objects. See example below.
 */
export async function trackServiceError(
  error: any,
  requestConfig?: {
    url?: string;
    method?: string;
    headers?: any;
    data?: any;
  }
): Promise<void> {
  try {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const statusCode = error?.response?.status;
    const errorType = error?.code || (statusCode ? 'HTTPError' : 'NetworkError');

    // Determine severity
    let severity: 'INFO' | 'WARNING' | 'ERROR' = 'ERROR';
    if (statusCode) {
      if (statusCode >= 500) {
        severity = 'ERROR';
      } else if (statusCode >= 400) {
        severity = statusCode === 404 ? 'INFO' : 'WARNING';
      } else {
        severity = 'INFO';
      }
    }

    const url = requestConfig?.url || error?.config?.url || '';
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

    await fetch(`${OBSERVABILITY_URL}/errors/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: getUserId(),
        session_id: getSessionId(),
        error_message: errorMessage,
        error_type: errorType,
        status_code: statusCode,
        severity: severity,
        request_url: fullUrl,
        request_method: requestConfig?.method || error?.config?.method || 'GET',
        request_headers: requestConfig?.headers || error?.config?.headers || {},
        request_body: requestConfig?.data ? JSON.stringify(requestConfig.data) : null,
        response_body: error?.response?.data ? JSON.stringify(error.response.data) : null,
        service_name: 'your-app-name',
        endpoint: url.split('?')[0],
        error_code: error?.code,
        user_agent: navigator.userAgent,
      }),
    });
  } catch (error) {
    console.debug('Failed to track service error:', error);
  }
}

/**
 * Example: Properly handling fetch() errors
 * 
 * fetch() only throws on network errors (CORS, connection refused, etc.)
 * HTTP errors (404, 500, etc.) return a Response with response.ok = false
 */
async function exampleFetchWithErrorTracking() {
  try {
    const response = await fetch('/api/endpoint');
    
    // ⚠️ CRITICAL: Check response.ok - fetch() doesn't throw on HTTP errors!
    if (!response.ok) {
      // Extract response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Get response body
      let responseBody = null;
      try {
        responseBody = await response.text();
      } catch (e) {
        // Ignore if we can't read body
      }
      
      // Create error object with all necessary fields for tracking
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
        data: responseBody,
      };
      error.code = 'HTTPError';
      
      // Track the error
      await trackServiceError(error, {
        url: '/api/endpoint',
        method: 'GET',
      });
      
      throw error; // Re-throw to handle in your app
    }
    
    // Success - process response
    return await response.json();
  } catch (error: any) {
    // Network errors are thrown automatically by fetch()
    // Track them if they don't have a response (network error)
    if (!error.response) {
      await trackServiceError(error, {
        url: '/api/endpoint',
        method: 'GET',
      });
    }
    throw error;
  }
}
```

### Step 3: Use Tracked Components (Recommended)

The easiest way to track UI events is using the tracked components. These automatically track interactions without manual calls.

**⚠️ IMPORTANT: Element IDs Required**

All tracked components **MUST** have an `id` prop. This ID is stored in the `element_id` field in the observability database, allowing you to query and analyze specific UI components. Without element IDs, you won't be able to identify which specific components users are interacting with in your database queries.

#### Install Tracked Components

Copy the tracked components from this repository:
- `frontend/src/components/TrackedButton.tsx`
- `frontend/src/components/TrackedInput.tsx`
- `frontend/src/components/TrackedCheckbox.tsx`
- `frontend/src/components/TrackedSelect.tsx`

Or create them based on the examples below.

#### TrackedButton

Automatically tracks button clicks:

```typescript
import { TrackedButton } from './components/TrackedButton';

function MyComponent() {
  return (
    <TrackedButton
      id="btn-submit-form"
      trackContext="my_page"
      buttonName="submit_form"
      onClick={handleSubmit}
      className="btn-primary"
    >
      Submit
    </TrackedButton>
  );
}
```

**Props:**
- `id` (required): Element ID for observability tracking - must be unique and descriptive
- `trackContext` (optional): Page/component context
- `buttonName` (optional): Button identifier (auto-extracted from children if not provided)
- `track` (optional, default: `true`): Enable/disable tracking
- `trackMetadata` (optional): Additional metadata
- All standard `button` props are supported

**Important:** Always provide an `id` prop to all tracked components. This ID is stored in the `element_id` field in the observability database, allowing you to query and analyze specific UI components.

#### TrackedInput

Automatically tracks input changes, focus, and blur:

```typescript
import { TrackedInput } from './components/TrackedInput';

function MyForm() {
  return (
    <TrackedInput
      id="input-email"
      name="email"
      trackContext="signup_page"
      inputName="email-input"
      trackOnFocus={true}
      trackOnChange={true}
      onChange={handleChange}
    />
  );
}
```

**Props:**
- `id` (required): Element ID for observability tracking - must be unique and descriptive
- `trackContext` (optional): Page/component context
- `inputName` (optional): Input identifier
- `trackOnChange` (optional, default: `true`): Track change events
- `trackOnFocus` (optional, default: `false`): Track focus events
- `trackOnBlur` (optional, default: `false`): Track blur events
- `track` (optional, default: `true`): Enable/disable tracking
- All standard `input` props are supported

**Important:** Always provide an `id` prop to all tracked components. This ID is stored in the `element_id` field in the observability database, allowing you to query and analyze specific UI components.

#### TrackedCheckbox

Automatically tracks checkbox state changes:

```typescript
import { TrackedCheckbox } from './components/TrackedCheckbox';

function MyForm() {
  return (
    <TrackedCheckbox
      id="checkbox-terms"
      name="agree_to_terms"
      trackContext="signup_page"
      checkboxName="terms-checkbox"
      checked={agreed}
      onChange={handleChange}
    />
  );
}
```

**Important:** Always provide an `id` prop to all tracked components. This ID is stored in the `element_id` field in the observability database.

#### TrackedSelect

Automatically tracks select dropdown changes:

```typescript
import { TrackedSelect } from './components/TrackedSelect';

function MyForm() {
  return (
    <TrackedSelect
      id="select-country"
      name="country"
      trackContext="signup_page"
      selectName="country-select"
      value={country}
      onChange={handleChange}
    >
      <option value="us">United States</option>
      <option value="uk">United Kingdom</option>
    </TrackedSelect>
  );
}
```

**Important:** Always provide an `id` prop to all tracked components. This ID is stored in the `element_id` field in the observability database.

### Step 4: Manual Tracking (Alternative)

If you prefer manual tracking or need more control:

```typescript
import { trackEvent, trackEventTelemetryOnly, trackUIEvent, trackUIError, trackServiceError } from './utils/observability';

// Track page view via OpenTelemetry only (Loki/Grafana stack, not in database)
useEffect(() => {
  trackEventTelemetryOnly('page_view', {
    page: location.pathname,
    timestamp: new Date().toISOString(),
  });
}, [location.pathname]);

// Or track to database as well:
// trackEvent('page_view', { page: location.pathname });

// Track button click manually
const handleClick = () => {
  trackUIEvent('click', 'button', {
    elementName: 'submit-button',
    elementId: 'btn-submit-form', // REQUIRED: Always include elementId
    pagePath: location.pathname,
  });
  // ... your logic
};

// Track form submission
const handleSubmit = async (data: any) => {
  trackEvent('form_submitted', {
    form_type: 'contact',
    fields_count: Object.keys(data).length,
  });
  
  try {
    await submitForm(data);
  } catch (error) {
    trackServiceError(error, {
      url: '/api/contact',
      method: 'POST',
      data: data,
    });
  }
};

// ⚠️ IMPORTANT: Handling fetch() errors
// fetch() does NOT throw on HTTP errors (404, 500, etc.)
// You must check response.ok and manually create error objects
const handleApiCall = async () => {
  try {
    const response = await fetch('/api/endpoint');
    
    // Check if response is ok (status 200-299)
    if (!response.ok) {
      // Extract response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Get response body
      let responseBody = null;
      try {
        responseBody = await response.text();
      } catch (e) {
        // Ignore if we can't read body
      }
      
      // Create error object for tracking
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
        data: responseBody,
      };
      error.code = 'HTTPError';
      
      // Track the error
      await trackServiceError(error, {
        url: '/api/endpoint',
        method: 'GET',
      });
      
      // Handle the error in your app
      throw error;
    }
    
    // Success - process response
    const data = await response.json();
    return data;
  } catch (error: any) {
    // Network errors (CORS, connection refused, etc.) are thrown automatically
    // Track network errors
    if (!error.response) {
      await trackServiceError(error, {
        url: '/api/endpoint',
        method: 'GET',
      });
    }
    throw error;
  }
};

// Global error handler
window.addEventListener('error', (event) => {
  trackUIError(event.error || event.message, {
    errorType: event.error?.name,
    errorStack: event.error?.stack,
    errorSource: event.filename,
    lineNumber: event.lineno,
    columnNumber: event.colno,
  });
});
```

### Step 5: Complete Example with Tracked Components

```typescript
import { TrackedButton, TrackedInput, TrackedCheckbox } from './components';
import { trackEvent, trackUIError } from './utils/observability';
import { useEffect } from 'react';

function SignupPage() {
  useEffect(() => {
    // Track page view via OpenTelemetry only (Loki/Grafana stack, not in database)
    trackEventTelemetryOnly('page_view', {
      page: '/signup',
      category: 'navigation',
    });
  }, []);

  const handleSubmit = async (formData: any) => {
    try {
      // Track form submission
      await trackEvent('form_submitted', {
        form_type: 'signup',
        fields: Object.keys(formData),
      });
      
      await submitForm(formData);
    } catch (error) {
      trackUIError(error as Error, {
        errorType: 'FormSubmissionError',
      });
    }
  };

  return (
    <form id="signup-form" onSubmit={handleSubmit}>
      <TrackedInput
        id="input-email"
        name="email"
        trackContext="signup_page"
        inputName="email-input"
        trackOnFocus={true}
      />
      
      <TrackedCheckbox
        id="checkbox-terms"
        name="agree_terms"
        trackContext="signup_page"
        checkboxName="terms-checkbox"
      />
      
      <TrackedButton
        id="btn-submit-signup"
        trackContext="signup_page"
        buttonName="submit_signup"
        type="submit"
      >
        Sign Up
      </TrackedButton>
    </form>
  );
}
```

**Important:** Notice that all tracked components have `id` props. This is **required** for proper observability tracking. The `element_id` field in the database allows you to query and analyze specific UI components.

## Backend Integration

### Python/FastAPI Example

```python
import httpx
import os
from typing import Optional, Dict, Any

OBSERVABILITY_URL = os.getenv("OBSERVABILITY_SERVICE_URL", "http://localhost:8006")

async def track_event(
    event_type: str,
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    service_name: str = "your-service"
):
    """Track a user event"""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{OBSERVABILITY_URL}/events",
                json={
                    "user_id": user_id,
                    "session_id": session_id,
                    "event_type": event_type,
                    "event_category": metadata.get("category") if metadata else None,
                    "event_metadata": metadata,
                    "service_name": service_name,
                },
                timeout=2.0  # Don't block on observability
            )
    except Exception as e:
        # Silently fail - don't break your app
        print(f"Failed to track event: {e}")

async def track_service_error(
    error: Exception,
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    request_url: Optional[str] = None,
    request_method: Optional[str] = None,
    status_code: Optional[int] = None,
    service_name: str = "your-service"
):
    """Track a service error"""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{OBSERVABILITY_URL}/errors/services",
                json={
                    "user_id": user_id,
                    "session_id": session_id,
                    "error_message": str(error),
                    "error_type": type(error).__name__,
                    "status_code": status_code,
                    "severity": "ERROR" if status_code and status_code >= 500 else "WARNING",
                    "request_url": request_url,
                    "request_method": request_method,
                    "service_name": service_name,
                    "endpoint": request_url.split("?")[0] if request_url else None,
                },
                timeout=2.0
            )
    except Exception as e:
        print(f"Failed to track service error: {e}")

# Usage in FastAPI endpoint
@app.post("/api/items")
async def create_item(item: Item, current_user: User = Depends(get_current_user)):
    try:
        result = await create_item_logic(item)
        
        # Track success event
        await track_event(
            event_type="item_created",
            user_id=current_user.id,
            metadata={"item_id": result.id, "item_type": item.type}
        )
        
        return result
    except Exception as e:
        # Track error
        await track_service_error(
            error=e,
            user_id=current_user.id,
            request_url="/api/items",
            request_method="POST",
            status_code=500
        )
        raise
```

### Node.js/Express Example

```javascript
const axios = require('axios');

const OBSERVABILITY_URL = process.env.OBSERVABILITY_SERVICE_URL || 'http://localhost:8006';

async function trackEvent(eventType, userId, sessionId, metadata = {}, serviceName = 'your-service') {
  try {
    await axios.post(`${OBSERVABILITY_URL}/events`, {
      user_id: userId,
      session_id: sessionId,
      event_type: eventType,
      event_category: metadata.category || 'user_interaction',
      event_metadata: metadata,
      service_name: serviceName,
    }, { timeout: 2000 });
  } catch (error) {
    console.debug('Failed to track event:', error.message);
  }
}

async function trackServiceError(error, userId, sessionId, requestConfig = {}, serviceName = 'your-service') {
  try {
    await axios.post(`${OBSERVABILITY_URL}/errors/services`, {
      user_id: userId,
      session_id: sessionId,
      error_message: error.message || String(error),
      error_type: error.name || 'Error',
      status_code: error.statusCode || error.response?.status,
      severity: error.statusCode >= 500 ? 'ERROR' : 'WARNING',
      request_url: requestConfig.url,
      request_method: requestConfig.method,
      service_name: serviceName,
      endpoint: requestConfig.url?.split('?')[0],
    }, { timeout: 2000 });
  } catch (error) {
    console.debug('Failed to track service error:', error.message);
  }
}

// Usage in Express middleware
app.use(async (err, req, res, next) => {
  await trackServiceError(
    err,
    req.user?.id,
    req.session?.id,
    { url: req.url, method: req.method },
    'your-service'
  );
  next(err);
});
```

## API Reference

### Endpoints

#### POST `/events`
Create a user event.

**Request Body:**
```json
{
  "user_id": 123,
  "session_id": "session_abc123",
  "event_type": "page_view",
  "event_category": "navigation",
  "event_metadata": {"page": "/dashboard"},
  "user_agent": "Mozilla/5.0...",
  "service_name": "your-app"
}
```

**Note:** `page_view` events are tracked via OpenTelemetry only (Loki/Grafana stack) and are not stored in the database. They appear in distributed tracing and logs but not in the `user_events` table. To store page views in the database, use `trackEvent('page_view', {...})` instead of `trackEventTelemetryOnly('page_view', {...})`.

#### POST `/ui-events`
Create a UI interaction event.

**Request Body:**
```json
{
  "user_id": 123,
  "session_id": "session_abc123",
  "interaction_type": "click",
  "element_type": "button",
  "element_name": "submit-button",
  "element_id": "btn-submit-form",
  "page_path": "/dashboard",
  "event_metadata": {}
}
```

**Note:** The `element_id` field is required and should match the `id` attribute of the UI component. This allows you to query specific components in the database.

#### POST `/errors/ui`
Create a UI error.

**Request Body:**
```json
{
  "user_id": 123,
  "session_id": "session_abc123",
  "error_message": "Cannot read property 'x' of undefined",
  "error_type": "TypeError",
  "error_stack": "at ...",
  "page_path": "/dashboard"
}
```

#### POST `/errors/services`
Create a service error.

**Request Body:**
```json
{
  "user_id": 123,
  "session_id": "session_abc123",
  "error_message": "Internal server error",
  "error_type": "HTTPError",
  "status_code": 500,
  "severity": "ERROR",
  "request_url": "http://api.example.com/items",
  "request_method": "POST",
  "service_name": "your-service"
}
```

#### GET `/events`
Query user events.

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `event_type` (optional): Filter by event type
- `start_date` (optional): Start date (ISO format)
- `end_date` (optional): End date (ISO format)
- `limit` (optional, default: 100): Max results

#### GET `/stats`
Get database statistics.

**Response:**
```json
{
  "total_events": 1000,
  "total_ui_events": 500,
  "total_errors": 10,
  "retention_days": 90,
  "estimated_size_mb": 2.5
}
```

## Configuration

### Environment Variables

**Observability Service:**
- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://eval_user:eval_pass@observability-db:5432/observability_db`)
- `EVENT_RETENTION_DAYS`: Days to keep events (default: 90)
- `CLEANUP_INTERVAL_HOURS`: Cleanup frequency (default: 24)
- `ENABLE_AUTO_CLEANUP`: Enable automatic cleanup (default: true)

**Your Application:**
- `OBSERVABILITY_SERVICE_URL`: URL of observability service (default: `http://localhost:8006`)

### Database Schema

The service uses PostgreSQL with the following tables:

#### `user_events`
General user behavior events:
- `id`, `user_id`, `session_id`
- `event_type`, `event_category`
- `event_metadata` (JSONB)
- `timestamp`, `user_agent`, `service_name`

#### `ui_events`
UI interaction events (optimized for analytics):
- `id`, `user_id`, `session_id`
- `interaction_type` (click, change, focus, blur, submit)
- `element_type` (button, input, checkbox, select, form)
- `element_name`, `element_id`
- `page_path`, `page_context`, `route_name`
- `event_value`, `event_metadata` (JSONB)
- `viewport_width`, `viewport_height`, `device_type`
- `timestamp`, `user_agent`

#### `ui_errors`
Frontend JavaScript errors:
- `id`, `user_id`, `session_id`
- `error_message`, `error_type`, `error_stack`
- `error_source`, `line_number`, `column_number`
- `page_path`, `page_context`, `route_name`
- `error_metadata` (JSONB)
- `viewport_width`, `viewport_height`, `device_type`
- `timestamp`, `user_agent`

#### `service_errors`
Backend/API errors:
- `id`, `user_id`, `session_id`
- `error_message`, `error_type`, `error_code`
- `status_code`, `severity` (INFO, WARNING, ERROR)
- `request_url`, `request_method`, `request_headers`, `request_body`
- `response_body`, `service_name`, `endpoint`
- `timestamp`, `user_agent`

#### `user_sessions`
Session tracking:
- `id`, `user_id`, `session_id`
- `start_time`, `end_time`, `duration_seconds`
- `page_views`, `events_count`
- `user_agent`, `ip_address`, `device_type`, `os`

See `services/observability-service/models.py` for full schema with all fields and indexes.

## Best Practices

1. **Always Add Element IDs**: **REQUIRED** - All UI components (buttons, inputs, selects, checkboxes, forms, links) must have unique `id` attributes. This allows you to query and analyze specific components in the observability database. Use descriptive IDs like `btn-submit-form`, `input-email`, `select-country`, etc.

2. **Handle fetch() Errors Correctly**: **CRITICAL** - `fetch()` does NOT throw exceptions on HTTP errors (404, 500, etc.). You must check `response.ok` and manually create error objects for tracking. See the example in Step 4 above.

3. **Don't Block on Observability**: Always use timeouts and catch errors. Observability should never break your app.

4. **Batch Events** (optional): For high-volume apps, consider batching events client-side before sending.

5. **Sanitize Data**: Don't send sensitive data (passwords, tokens, etc.) in event metadata.

6. **Use Appropriate Event Types**: 
   - Use `user_events` for business events (purchases, signups, etc.)
   - Use `ui_events` for UI interactions (clicks, form changes)
   - Use `errors/ui` for frontend errors
   - Use `errors/services` for backend/API errors

7. **Include Context**: Always include `user_id`, `session_id`, and relevant metadata for better analytics.

## Querying Data

### Direct Database Access

```sql
-- Get all events for a user
SELECT * FROM user_events WHERE user_id = 123 ORDER BY timestamp DESC;

-- Get error rate by service
SELECT service_name, COUNT(*) as error_count
FROM service_errors
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY service_name;

-- Get most clicked buttons
SELECT element_name, COUNT(*) as click_count
FROM ui_events
WHERE interaction_type = 'click' AND element_type = 'button'
GROUP BY element_name
ORDER BY click_count DESC
LIMIT 10;

-- Get clicks for a specific button by element_id (requires element IDs!)
SELECT COUNT(*) as click_count, 
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(DISTINCT session_id) as unique_sessions
FROM ui_events
WHERE element_id = 'btn-submit-form' 
  AND interaction_type = 'click'
  AND timestamp > NOW() - INTERVAL '7 days';

-- Get UI events by page
SELECT page_path, COUNT(*) as event_count, 
       COUNT(DISTINCT user_id) as unique_users
FROM ui_events
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY page_path
ORDER BY event_count DESC;

-- Get form abandonment rate
SELECT 
  COUNT(DISTINCT CASE WHEN interaction_type = 'focus' THEN session_id END) as started,
  COUNT(DISTINCT CASE WHEN interaction_type = 'submit' THEN session_id END) as completed,
  (1.0 - COUNT(DISTINCT CASE WHEN interaction_type = 'submit' THEN session_id END)::float / 
   NULLIF(COUNT(DISTINCT CASE WHEN interaction_type = 'focus' THEN session_id END), 0)) * 100 as abandonment_rate
FROM ui_events
WHERE element_type = 'form' AND timestamp > NOW() - INTERVAL '7 days';

-- Get error trends
SELECT 
  DATE(timestamp) as date,
  error_type,
  COUNT(*) as error_count
FROM ui_errors
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), error_type
ORDER BY date DESC, error_count DESC;
```

### Via API

```bash
# Get events for user
curl "http://localhost:8006/events?user_id=123&limit=100"

# Get events by type (note: page_view events are tracked via OpenTelemetry/Loki only, not in database)
curl "http://localhost:8006/events?event_type=page_view&limit=50"

# Get UI events
curl "http://localhost:8006/ui-events?interaction_type=click&element_type=button&limit=20"

# Get UI analytics
curl "http://localhost:8006/ui-events/analytics?page_path=/dashboard&start_date=2024-01-01"

# Get analytics summary
curl "http://localhost:8006/analytics/summary?start_date=2024-01-01&end_date=2024-01-31"

# Get error statistics
curl "http://localhost:8006/errors/total"

# Get service errors
curl "http://localhost:8006/errors/services?service_name=my-service&severity=ERROR"
```

### Using SQL Views (Optional)

You can create views for common queries:

```sql
-- Most active users
CREATE VIEW active_users AS
SELECT 
  user_id,
  COUNT(*) as event_count,
  COUNT(DISTINCT DATE(timestamp)) as active_days,
  MIN(timestamp) as first_seen,
  MAX(timestamp) as last_seen
FROM user_events
GROUP BY user_id;

-- Page performance
CREATE VIEW page_performance AS
SELECT 
  page_path,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  AVG(viewport_width) as avg_viewport_width,
  COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_events
FROM ui_events
GROUP BY page_path;
```

## Tracked Components Reference

### Creating Your Own Tracked Components

If you want to create custom tracked components, here's the pattern:

```typescript
import { trackUIEvent } from './utils/observability';

interface TrackedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  trackContext?: string;
  buttonName?: string;
  track?: boolean;
}

export function TrackedButton({
  trackContext,
  buttonName,
  track = true,
  onClick,
  children,
  ...props
}: TrackedButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (track) {
      trackUIEvent('click', 'button', {
        elementName: buttonName || String(children) || 'button',
        elementId: props.id, // IMPORTANT: Pass the id prop
        pagePath: window.location.pathname,
        pageContext: trackContext,
      });
    }
    if (onClick) onClick(e);
  };

  return <button {...props} onClick={handleClick}>{children}</button>;
}
```

**Critical:** Always pass `props.id` to `trackUIEvent` as `elementId`. This ensures the element ID is stored in the database for querying. **Require users to provide an `id` prop** when using your tracked components.

### Component Props Summary

| Component | Key Props | Auto-Tracks |
|-----------|-----------|-------------|
| `TrackedButton` | **`id` (required)**, `trackContext`, `buttonName`, `track` | Clicks |
| `TrackedInput` | **`id` (required)**, `trackContext`, `inputName`, `trackOnChange`, `trackOnFocus`, `trackOnBlur` | Changes, Focus, Blur |
| `TrackedCheckbox` | **`id` (required)**, `trackContext`, `checkboxName`, `track` | State changes |
| `TrackedSelect` | **`id` (required)**, `trackContext`, `selectName`, `track` | Value changes |

**Note:** The `id` prop is required for all tracked components. It is stored in the `element_id` field in the `ui_events` table, enabling you to query specific components in the observability database.

## Troubleshooting

### Service Not Responding

```bash
# Check health
curl http://localhost:8006/health

# Check logs
docker-compose logs observability-service

# Check database connection
docker-compose exec observability-db psql -U eval_user -d observability_db -c "SELECT 1;"
```

### Events Not Appearing

1. **Check Network Connectivity**
   ```bash
   # Test from your app's environment
   curl http://localhost:8006/health
   ```

2. **Verify CORS Settings**
   - Service allows `http://localhost:3000` and `http://localhost:5173` by default
   - For other origins, update `services/observability-service/main.py`:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3000", "http://your-app:port"],
       ...
   )
   ```

3. **Check Browser Console**
   - Open DevTools (F12) → Console
   - Look for errors when clicking buttons or submitting forms
   - Check Network tab for failed requests

4. **Check Service Logs**
   ```bash
   docker-compose logs observability-service --tail=50
   ```

5. **Verify Database is Accessible**
   ```bash
   docker-compose exec observability-db psql -U eval_user -d observability_db -c "SELECT COUNT(*) FROM user_events;"
   ```

6. **Test Direct API Call**
   ```bash
   curl -X POST http://localhost:8006/events \
     -H "Content-Type: application/json" \
     -d '{"event_type": "test", "event_category": "test"}'
   ```

### Tracked Components Not Working

1. **Check Component Imports**
   - Verify components are imported correctly
   - Check file paths match your project structure

2. **Verify trackUIEvent Function**
   - Ensure `trackUIEvent` is properly exported from your utils
   - Check that it's calling the correct endpoint (`/ui-events`)

3. **Check Browser Console**
   - Look for errors when using tracked components
   - Verify events are being sent (check Network tab)

4. **Test Manual Tracking**
   ```typescript
   // Try manual tracking to verify the function works
   trackUIEvent('click', 'button', {
     elementName: 'test-button',
     elementId: 'btn-test', // Don't forget elementId!
     pagePath: window.location.pathname,
   });
   ```

### Service Errors Not Being Tracked

**Common Issue**: Service errors from `fetch()` calls are not being stored in the database.

**Root Cause**: `fetch()` does NOT throw exceptions on HTTP errors (404, 500, etc.). It only throws on network errors (CORS, connection refused, etc.).

**Solution**: Always check `response.ok` and manually create error objects:

```typescript
// ❌ WRONG - This won't track HTTP errors
try {
  const response = await fetch('/api/endpoint');
  // If response is 404, this won't throw, so error won't be tracked!
} catch (error) {
  trackServiceError(error); // Only catches network errors
}

// ✅ CORRECT - Check response.ok
try {
  const response = await fetch('/api/endpoint');
  
  if (!response.ok) {
    // Extract headers and body
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    let responseBody = null;
    try {
      responseBody = await response.text();
    } catch (e) {
      // Ignore
    }
    
    // Create error object
    const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.response = {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
      data: responseBody,
    };
    error.code = 'HTTPError';
    
    // Track the error
    await trackServiceError(error, {
      url: '/api/endpoint',
      method: 'GET',
    });
    
    throw error;
  }
  
  return await response.json();
} catch (error: any) {
  // Network errors are thrown automatically
  if (!error.response) {
    await trackServiceError(error, {
      url: '/api/endpoint',
      method: 'GET',
    });
  }
  throw error;
}
```

**Verification**: After implementing the fix, check the database:
```sql
SELECT * FROM service_errors ORDER BY timestamp DESC LIMIT 10;
```

Or via API:
```bash
curl "http://localhost:8006/errors/services?limit=10"
```

### High Latency

- Observability calls should be non-blocking (use async/background tasks)
- Consider batching events for high-volume applications
- Use connection pooling for database
- Set appropriate timeouts (2-5 seconds) to avoid blocking

## Migration from Other Observability Solutions

If you're migrating from another solution:

1. **Keep existing instrumentation** - Add observability service calls alongside existing code
2. **Gradual migration** - Start with new features, then migrate existing code
3. **Data export** - Export existing data and import into observability database if needed

## Advanced Usage

### OpenTelemetry Integration (Optional)

If you want distributed tracing alongside event tracking:

```typescript
// Initialize OpenTelemetry
import { initOpenTelemetry } from './utils/otel';

initOpenTelemetry({
  serviceName: 'your-app',
  otelCollectorUrl: 'http://localhost:4318',
});

// Events will automatically create spans in Tempo
trackEvent('user_action', { action: 'click' });
```

### Error Boundary Integration

Track React component errors:

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { trackUIError } from './utils/observability';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackUIError(error, {
      errorType: 'ReactErrorBoundary',
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong</div>;
    }
    return this.props.children;
  }
}
```

### Session Management

The service automatically handles sessions, but you can customize:

```typescript
// Custom session ID
const customSessionId = `custom_${Date.now()}`;
sessionStorage.setItem('session_id', customSessionId);

// Track with custom session
trackEvent('custom_event', {}, customSessionId);
```

### Batching Events (High-Volume Apps)

For high-volume applications, consider batching:

```typescript
class EventBatcher {
  private events: any[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds

  constructor() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  add(event: any) {
    this.events.push(event);
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.events.length === 0) return;
    
    const batch = this.events.splice(0);
    // Send batch to observability service
    await fetch('http://localhost:8006/events/batch', {
      method: 'POST',
      body: JSON.stringify({ events: batch }),
    });
  }
}
```

## Support

For issues or questions:
- Check service logs: `docker-compose logs observability-service`
- Check database: `docker-compose exec observability-db psql -U eval_user -d observability_db`
- Review API documentation: `http://localhost:8006/docs` (Swagger UI)
- Check browser console for frontend errors
- Verify CORS settings if events aren't being sent

## Additional Resources

- **API Documentation**: http://localhost:8006/docs (Swagger UI)
- **Database Schema**: See `services/observability-service/models.py`
- **UI Events Table**: See `services/observability-service/docs/UI_EVENTS_TABLE.md`
- **Example Implementation**: See `frontend/src/pages/ObservabilityDemo.tsx`

