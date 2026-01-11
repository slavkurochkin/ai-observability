# @ai-observability/client

Frontend observability client for tracking user events, UI interactions, and errors. This package provides a simple, powerful way to add observability to your React applications.

## Features

- ✅ **Event Tracking** - Track user events and UI interactions
- ✅ **Error Tracking** - Automatic and manual error tracking
- ✅ **Auto-Instrumentation** - Automatic page view and error tracking
- ✅ **React Components** - Pre-built tracked components
- ✅ **React Hooks** - Easy integration with React
- ✅ **Event Queuing** - Offline support with local event queuing
- ✅ **Batching** - Automatic event batching for performance
- ✅ **Retry Logic** - Automatic retry with exponential backoff
- ✅ **Graceful Degradation** - Works even when service is unavailable
- ✅ **TypeScript** - Full TypeScript support
- ✅ **OpenTelemetry** - Distributed tracing support

## Installation

### From npm (when published)

```bash
npm install @ai-observability/client
```

### Local Development (npm link)

If developing locally or the package isn't published yet:

```bash
# In the observability-client package directory
cd packages/observability-client
npm run link   # Builds, cleans React, and links

# In your application
npm link @ai-observability/client
```

> **Note**: The `npm run link` script automatically removes the package's local React installation to prevent duplicate React instance errors. After linking, restart your dev server.

## Quick Start

### 1. Initialize Observability

```typescript
import { initObservability } from '@ai-observability/client';

// Initialize in your app entry point (e.g., main.tsx)
initObservability({
  serviceUrl: process.env.OBSERVABILITY_SERVICE_URL || 'http://localhost:8006', // Default to local Docker
  serviceName: 'my-app',
  autoTrack: {
    pageViews: true,      // Auto-track page views
    errors: true,         // Auto-track JavaScript errors
    apiErrors: true,      // Auto-track API errors
    clicks: false,        // Manual click tracking (too noisy if auto)
    formChanges: false,   // Manual form tracking (privacy/performance)
    apiCalls: false,      // Manual API tracking (can be very noisy)
  },
});
```

### 2. Track Events

```typescript
import { trackEvent, trackUIEvent } from '@ai-observability/client';

// Track a user event
await trackEvent('button_click', {
  button_name: 'submit',
  page: 'checkout',
});

// Track a UI interaction
await trackUIEvent('click', 'button', {
  elementName: 'submit-button',
  elementId: 'submit-btn',
  pagePath: '/checkout',
});
```

### 3. Use Tracked Components

```typescript
import { TrackedButton, TrackedInput } from '@ai-observability/client';

function MyComponent() {
  return (
    <>
      <TrackedButton
        buttonName="submit"
        trackContext="checkout_page"
        onClick={handleSubmit}
      >
        Submit Order
      </TrackedButton>

      <TrackedInput
        name="email"
        trackContext="signup_page"
        trackOnFocus={true}
        onChange={handleChange}
      />
    </>
  );
}
```

### 4. Use Hooks

```typescript
import { useObservability } from '@ai-observability/client';

function MyComponent() {
  const { trackEvent, trackUIEvent } = useObservability();

  const handleClick = async () => {
    await trackEvent('custom_action', { action: 'click' });
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

## Configuration

### Service URL

The package defaults to `http://localhost:8006` (local Docker deployment). You can override this:

```typescript
initObservability({
  serviceUrl: process.env.OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
});
```

### Auto-Tracking Configuration

```typescript
initObservability({
  autoTrack: {
    pageViews: true,      // Auto-track page views (default: true)
    errors: true,         // Auto-track JavaScript errors (default: true)
    apiErrors: true,      // Auto-track API errors (default: true)
    clicks: false,        // Auto-track all clicks (default: false)
    formChanges: false,   // Auto-track form changes (default: false)
    apiCalls: false,      // Auto-track all API calls (default: false)
  },
  // Auto-track clicks on specific selectors
  autoTrackSelectors: {
    clicks: ['.track-this-button', '[data-track]'],
  },
  // Exclude paths/elements from tracking
  exclude: {
    paths: ['/admin', '/internal'],
    selectors: ['.no-track', '[data-no-track]'],
  },
});
```

### Batching Configuration

```typescript
initObservability({
  batchSize: 10,          // Batch size (default: 10)
  batchInterval: 5000,    // Batch interval in ms (default: 5000)
  retryAttempts: 3,       // Retry attempts (default: 3)
});
```

### Development Mode

Development mode is automatically detected (localhost or 127.0.0.1), but you can override:

```typescript
initObservability({
  devMode: true,  // Enable console logging
});
```

### Test Mode

```typescript
initObservability({
  testMode: true,  // Don't actually send events (for testing)
});
```

## API Reference

### Initialization

#### `initObservability(config?: ObservabilityConfig)`

Initialize the observability client.

**Parameters:**
- `config.serviceUrl` - Observability service URL (default: `http://localhost:8006`)
- `config.serviceName` - Service name (default: `@ai-observability/client`)
- `config.autoTrack` - Auto-tracking configuration
- `config.autoTrackSelectors` - Selectors for auto-tracking
- `config.exclude` - Exclusion configuration
- `config.batchSize` - Event batch size
- `config.batchInterval` - Batch interval in milliseconds
- `config.retryAttempts` - Number of retry attempts
- `config.devMode` - Enable development mode
- `config.testMode` - Enable test mode

### Tracking Functions

#### `trackEvent(eventName: string, metadata?: EventMetadata)`

Track a user event.

```typescript
await trackEvent('user_action', {
  action: 'click',
  page: 'dashboard',
});
```

#### `trackEventTelemetryOnly(eventName: string, metadata?: EventMetadata)`

Track an event via OpenTelemetry only (no database storage).

```typescript
trackEventTelemetryOnly('internal_metric', {
  value: 123,
});
```

#### `trackUIEvent(interactionType: string, elementType: string, metadata?: UIEventMetadata)`

Track a UI interaction.

```typescript
await trackUIEvent('click', 'button', {
  elementName: 'submit-button',
  elementId: 'submit-btn',
  pagePath: '/checkout',
});
```

#### `trackUIError(error: Error | string, errorInfo?: UIErrorInfo)`

Track a UI error.

```typescript
await trackUIError(new Error('Something went wrong'), {
  errorType: 'ValidationError',
  pageContext: 'checkout',
});
```

#### `trackServiceError(error: any, requestConfig?: ServiceErrorRequestConfig)`

Track a service/API error.

```typescript
try {
  await fetch('/api/data');
} catch (error) {
  await trackServiceError(error, {
    url: '/api/data',
    method: 'GET',
  });
}
```

### Components

#### `<TrackedButton>`

Button component with automatic click tracking.

**Props:**
- `track` - Enable/disable tracking (default: `true`)
- `buttonName` - Button name for tracking
- `trackContext` - Context for tracking
- `trackMetadata` - Additional metadata

#### `<TrackedInput>`

Input component with automatic change/focus/blur tracking.

**Props:**
- `track` - Enable/disable tracking (default: `true`)
- `inputName` - Input name for tracking
- `trackOnChange` - Track change events (default: `true`)
- `trackOnFocus` - Track focus events (default: `false`)
- `trackOnBlur` - Track blur events (default: `false`)

#### `<TrackedCheckbox>`

Checkbox component with automatic change tracking.

**Props:**
- `track` - Enable/disable tracking (default: `true`)
- `checkboxName` - Checkbox name for tracking

#### `<TrackedSelect>`

Select component with automatic change tracking.

**Props:**
- `track` - Enable/disable tracking (default: `true`)
- `selectName` - Select name for tracking

### Hooks

#### `useObservability()`

Hook to access observability functions.

```typescript
const { trackEvent, trackUIEvent, trackUIError } = useObservability();
```

#### `useAutoTracking(enabled: boolean)`

Hook to enable/disable auto-tracking per component.

```typescript
const { isEnabled, setEnabled } = useAutoTracking(true);
```

### Utilities

#### `getSessionId()`

Get current session ID.

```typescript
const sessionId = getSessionId();
```

#### `resetSession()`

Reset session (create new session).

```typescript
const newSessionId = resetSession();
```

#### `getUserId()`

Get user ID from common auth patterns.

```typescript
const userId = getUserId();
```

#### `setUserId(userId: number | null)`

Set user ID manually.

```typescript
setUserId(123);
```

#### `getDeviceType()`

Get device type.

```typescript
const deviceType = getDeviceType(); // 'mobile' | 'tablet' | 'desktop'
```

#### `startSpan(name: string, metadata?: Record<string, any>)`

Start an OpenTelemetry span.

```typescript
const span = startSpan('operation', { key: 'value' });
span.end();
```

## Docker Setup

This package assumes the observability service runs locally in Docker. To start the services:

```bash
docker-compose up -d observability-service observability-db
```

The service should be accessible at `http://localhost:8006`.

If the service is unavailable, events are automatically queued locally and sent when the service becomes available.

## Error Handling

The package gracefully handles service unavailability:

- Events are queued locally (IndexedDB) when the service is down
- Queued events are automatically sent when the service becomes available
- Retry logic with exponential backoff
- No errors are thrown to your application code

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  ObservabilityConfig,
  EventMetadata,
  UIEventMetadata,
  TrackedButtonProps,
} from '@ai-observability/client';
```

## Examples

### React Router Integration

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackUIEvent } from '@ai-observability/client';

function App() {
  const location = useLocation();

  useEffect(() => {
    trackUIEvent('page_view', 'page', {
      pagePath: location.pathname,
      routeName: location.pathname,
    });
  }, [location]);

  return <Routes>...</Routes>;
}
```

### Error Boundary Integration

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { trackUIError } from '@ai-observability/client';

class ErrorBoundary extends Component<{ children: ReactNode }> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackUIError(error, {
      errorType: 'ReactErrorBoundary',
      errorStack: errorInfo.componentStack,
    });
  }

  render() {
    return this.props.children;
  }
}
```

### API Error Tracking

```typescript
import axios from 'axios';
import { trackServiceError } from '@ai-observability/client';

// Intercept axios errors
axios.interceptors.response.use(
  response => response,
  error => {
    trackServiceError(error, {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers,
      data: error.config?.data,
    });
    return Promise.reject(error);
  }
);
```

## License

MIT
