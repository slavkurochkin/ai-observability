# Migration Guide: Manual Integration → NPM Package

This guide helps you migrate from a manual observability integration to the `@ai-observability/client` npm package.

## Overview

**Before:** Manually copying utility functions and components into your project.

**After:** Installing and importing from the npm package with improved features:
- ✅ Event queuing when service is unavailable
- ✅ Automatic batching for better performance
- ✅ Retry logic with exponential backoff
- ✅ Session management with timeout
- ✅ TypeScript types included
- ✅ Regular updates and bug fixes

## Quick Migration Steps

### 1. Install the Package

```bash
npm install @ai-observability/client

# For local development (not published)
cd packages/observability-client
npm run link

# In your app
npm link @ai-observability/client
```

### 2. Remove Old Files

Remove your manual integration files:

```bash
# Common locations
rm -rf src/utils/observability.ts
rm -rf src/utils/otel.ts
rm -rf src/components/TrackedButton.tsx
rm -rf src/components/TrackedInput.tsx
# ... other tracked components
```

### 3. Update Imports

**Before (Manual):**
```typescript
import { trackEvent } from '../utils/observability';
import { TrackedButton } from '../components/TrackedButton';
```

**After (Package):**
```typescript
import { trackEvent, TrackedButton } from '@ai-observability/client';
```

### 4. Initialize Observability

Replace your manual initialization code with the package initialization.

**Before (Manual):**
```typescript
// main.tsx or App.tsx
const OBSERVABILITY_URL = import.meta.env.VITE_OBSERVABILITY_URL || 'http://localhost:8006';

// Maybe some custom session/user setup
// Maybe some OpenTelemetry setup
```

**After (Package):**
```typescript
// main.tsx or App.tsx
import { initObservability } from '@ai-observability/client';

initObservability({
  serviceUrl: import.meta.env.VITE_OBSERVABILITY_URL || 'http://localhost:8006',
  serviceName: 'my-app',
  autoTrack: {
    pageViews: true,
    errors: true,
    apiErrors: true,
  },
});
```

## Detailed Migration by Feature

### Event Tracking

**Before:**
```typescript
import { trackEvent } from '../utils/observability';

// Basic event tracking
trackEvent('button_click', { button: 'submit' });
```

**After:**
```typescript
import { trackEvent } from '@ai-observability/client';

// Same API!
trackEvent('button_click', { button: 'submit' });

// Now with automatic queuing, batching, and retry
```

**Benefits:**
- Events automatically queued if service is down
- Batched for better performance
- Automatic retry with exponential backoff

### Telemetry-Only Events

**Before:**
```typescript
// May not have had this feature
// Or implemented manually with OpenTelemetry API
```

**After:**
```typescript
import { trackEventTelemetryOnly } from '@ai-observability/client';

// Track in OpenTelemetry/Loki only (not database)
trackEventTelemetryOnly('page_view', { page: '/dashboard' });
```

### Tracked Components

**Before:**
```typescript
import { TrackedButton } from '../components/TrackedButton';

<TrackedButton
  onClick={handleClick}
  trackContext="dashboard"
  buttonName="create"
>
  Create
</TrackedButton>
```

**After:**
```typescript
import { TrackedButton } from '@ai-observability/client';

// Same API! No changes needed
<TrackedButton
  onClick={handleClick}
  trackContext="dashboard"
  buttonName="create"
>
  Create
</TrackedButton>
```

**Benefits:**
- All tracked components are maintained and updated
- Bug fixes automatically available
- Consistent behavior across projects

### React Hooks

**Before:**
```typescript
// May have created custom hooks
import { trackEvent } from '../utils/observability';

function MyComponent() {
  const handleAction = () => {
    trackEvent('action');
  };
}
```

**After:**
```typescript
import { useObservability } from '@ai-observability/client';

function MyComponent() {
  const { trackEvent, trackUIEvent } = useObservability();

  const handleAction = () => {
    trackEvent('action');
  };
}
```

**Benefits:**
- Hooks integrated with React lifecycle
- Consistent API across components
- Built-in optimization

### Error Tracking

**Before:**
```typescript
// Manual error tracking
try {
  await apiCall();
} catch (error) {
  fetch(`${OBSERVABILITY_URL}/errors/ui`, {
    method: 'POST',
    body: JSON.stringify({
      error_message: error.message,
      error_stack: error.stack,
    }),
  });
}
```

**After:**
```typescript
import { trackUIError, trackServiceError } from '@ai-observability/client';

// UI errors
try {
  throw new Error('Something went wrong');
} catch (error) {
  trackUIError(error, {
    errorType: 'ValidationError',
    pageContext: 'checkout',
  });
}

// Service errors
try {
  await fetch('/api/data');
} catch (error) {
  trackServiceError(error, {
    url: '/api/data',
    method: 'GET',
  });
}
```

### Session Management

**Before:**
```typescript
// Manual session ID generation
let sessionId = sessionStorage.getItem('session_id');
if (!sessionId) {
  sessionId = `session_${Date.now()}_${Math.random()}`;
  sessionStorage.setItem('session_id', sessionId);
}
```

**After:**
```typescript
import { getSessionId, resetSession } from '@ai-observability/client';

// Automatically managed with 30-minute timeout
const sessionId = getSessionId();

// Manually reset if needed
const newSessionId = resetSession();
```

### User ID Management

**Before:**
```typescript
// Manual user ID extraction
function getUserId() {
  const user = localStorage.getItem('user');
  if (user) {
    return JSON.parse(user).id;
  }
  return null;
}
```

**After:**
```typescript
import { getUserId, setUserId } from '@ai-observability/client';

// Automatically detects from common patterns
const userId = getUserId();

// Or set manually
setUserId(123);
```

## Configuration Migration

### Environment Variables

**Before:**
```bash
# .env
VITE_OBSERVABILITY_URL=http://localhost:8006
```

**After:**
```bash
# .env (same, but more options available)
VITE_OBSERVABILITY_URL=http://localhost:8006
VITE_OBSERVABILITY_SERVICE_NAME=my-app
```

### Auto-Tracking Setup

**Before:**
```typescript
// Manual setup for auto-tracking
window.addEventListener('error', (event) => {
  trackUIError(event.error);
});

// Manual page view tracking
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', { path: location.pathname });
  }, [location]);
}
```

**After:**
```typescript
// Automatic with configuration
initObservability({
  autoTrack: {
    pageViews: true,      // Automatic page view tracking
    errors: true,         // Automatic error tracking
    apiErrors: true,      // Automatic API error tracking
  },
});

// That's it! No manual setup needed.
```

## Benefits of Migration

### 1. Reduced Maintenance

- No need to manually sync updates
- Bug fixes automatically available
- Consistent behavior across projects

### 2. Better Performance

- Event batching (10 events or 5 seconds)
- Optimized network requests
- Reduced overhead

### 3. Improved Reliability

- Automatic retry with exponential backoff (max 3 attempts)
- Event queuing when service is unavailable
- Graceful degradation

### 4. Enhanced Features

- Session timeout management (30 minutes)
- Automatic user ID detection
- Device type detection
- Viewport tracking
- Test mode for unit testing

### 5. Better Developer Experience

- TypeScript types included
- Comprehensive documentation
- Examples and guides
- Consistent API

## Breaking Changes

### None! 🎉

The package API is designed to be compatible with the manual integration approach. Most code should work without changes.

### API Differences

**Changed Function Signatures:**

1. **initObservability** - New function (replaces manual setup)
   ```typescript
   // Add this to your app initialization
   initObservability({ /* config */ });
   ```

2. **trackEventTelemetryOnly** - New function
   ```typescript
   // Use for telemetry-only events (like page_view)
   trackEventTelemetryOnly('page_view', { page: '/dashboard' });
   ```

**Removed:**
- Manual health check code (handled by initObservability)
- Manual session management code (handled automatically)
- Manual retry logic (handled automatically)

## Testing After Migration

### 1. Verify Service Connection

```typescript
// Check that initialization works
await initObservability({ devMode: true });

// You should see console logs confirming:
// ✓ Service is healthy at http://localhost:8006
// ✓ Initialized successfully
```

### 2. Test Event Tracking

```typescript
// Track a test event
await trackEvent('migration_test', { migrated: true });

// Check observability service:
curl http://localhost:8006/events?event_type=migration_test
```

### 3. Test Components

```typescript
// Render a tracked component
<TrackedButton buttonName="test">Test Button</TrackedButton>

// Click it and verify event is tracked
curl http://localhost:8006/ui-events?element_name=test
```

### 4. Test Error Handling

```typescript
// Test service unavailable scenario
docker-compose stop observability-service

// Track event - should queue locally
await trackEvent('queued_event');

// Check localStorage
console.log(localStorage.getItem('observability_event_queue'));

// Restart service
docker-compose start observability-service

// Events should be sent automatically
```

## Troubleshooting

### Issue: "Invalid Hook Call" Error

**Cause:** Multiple React instances (when using npm link)

**Solution:**
```bash
cd packages/observability-client
npm run link  # This removes local React automatically
cd your-app
npm link @ai-observability/client
# Restart dev server
```

### Issue: Events Not Being Tracked

**Cause:** Service not initialized

**Solution:**
```typescript
// Make sure you call initObservability
await initObservability();
```

### Issue: Events Not Appearing in Database

**Cause:** Service unavailable or events queued

**Solution:**
```bash
# Check if service is running
curl http://localhost:8006/health

# Check localStorage queue
console.log(localStorage.getItem('observability_event_queue'));

# Restart service if needed
docker-compose up -d observability-service
```

## Rollback Plan

If you need to roll back:

1. **Uninstall package:**
   ```bash
   npm uninstall @ai-observability/client
   ```

2. **Restore old files from git:**
   ```bash
   git checkout src/utils/observability.ts
   git checkout src/components/Tracked*.tsx
   ```

3. **Revert imports:**
   ```typescript
   // Change back from:
   import { trackEvent } from '@ai-observability/client';

   // To:
   import { trackEvent } from '../utils/observability';
   ```

## Next Steps

1. ✅ Complete migration
2. ✅ Test thoroughly
3. ✅ Remove old files
4. ✅ Update documentation
5. ✅ Consider enabling auto-tracking features
6. ✅ Explore additional features (hooks, utilities)

## Support

- **Documentation:** [README.md](./README.md)
- **Examples:** [EXAMPLE_USAGE.md](./EXAMPLE_USAGE.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Integration Guide:** [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

## Feedback

If you encounter issues during migration, please:
1. Check the troubleshooting guide
2. Review the examples
3. Open an issue with details about your setup
