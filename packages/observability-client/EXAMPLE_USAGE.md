# Example: Using the Package in Your Project

## Quick Start Example

```typescript
// main.tsx or App.tsx
import { initObservability } from '@ai-observability/client';

// Initialize observability (call once at app startup)
initObservability({
  serviceUrl: process.env.OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'my-app',
  autoTrack: {
    pageViews: true,      // Auto-track page views
    errors: true,         // Auto-track JavaScript errors
    apiErrors: true,      // Auto-track API errors
  },
  devMode: true,          // Enable console logging in development
});
```

## Using Tracked Components

```typescript
import { TrackedButton, TrackedInput } from '@ai-observability/client';

function MyComponent() {
  return (
    <div>
      <TrackedButton
        buttonName="submit"
        trackContext="checkout_page"
        onClick={() => console.log('Clicked!')}
      >
        Submit Order
      </TrackedButton>

      <TrackedInput
        name="email"
        trackContext="signup_page"
        trackOnFocus={true}
        onChange={(e) => console.log(e.target.value)}
      />
    </div>
  );
}
```

## Using Hooks

```typescript
import { useObservability } from '@ai-observability/client';

function MyComponent() {
  const { trackEvent, trackUIEvent } = useObservability();

  const handleCustomAction = async () => {
    await trackEvent('custom_action', {
      action: 'button_click',
      page: 'dashboard',
    });
  };

  return <button onClick={handleCustomAction}>Click me</button>;
}
```

## Manual Tracking

```typescript
import { trackEvent, trackUIEvent, trackUIError } from '@ai-observability/client';

// Track a user event
await trackEvent('user_action', {
  action: 'purchase',
  amount: 99.99,
});

// Track a UI interaction
await trackUIEvent('click', 'button', {
  elementName: 'checkout-button',
  pagePath: '/cart',
});

// Track an error
try {
  // some code
} catch (error) {
  await trackUIError(error, {
    errorType: 'ValidationError',
    pageContext: 'checkout',
  });
}
```

## Integration with React Router

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackUIEvent } from '@ai-observability/client';

function App() {
  const location = useLocation();

  useEffect(() => {
    // Track page views on route change
    trackUIEvent('page_view', 'page', {
      pagePath: location.pathname,
      routeName: location.pathname,
    });
  }, [location]);

  return <Routes>...</Routes>;
}
```

## Error Boundary Integration

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { trackUIError } from '@ai-observability/client';

interface Props {
  children: ReactNode;
}

class ErrorBoundary extends Component<Props> {
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

## API Error Tracking

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
