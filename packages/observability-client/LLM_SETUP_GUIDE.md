# LLM Setup Guide: @ai-observability/client

Use this guide to help set up the `@ai-observability/client` package in a React project.

## Package Information

- **Package Name**: `@ai-observability/client`
- **Type**: React observability/tracking library
- **Default Service URL**: `http://localhost:8006` (local Docker)
- **Main Exports**: `initObservability`, `trackEvent`, `trackUIEvent`, `TrackedButton`, `TrackedInput`, `TrackedCheckbox`, `TrackedSelect`, `useObservability`, `useAutoTracking`

## Setup Steps

### Step 1: Install the Package

**If using local package (file: protocol):**
```json
// In project's package.json
{
  "dependencies": {
    "@ai-observability/client": "file:../path/to/packages/observability-client"
  }
}
```

**If using npm link:**
```bash
# In package directory
cd packages/observability-client
npm install && npm run build && npm link

# In project directory
cd /path/to/project
npm link @ai-observability/client
```

### Step 2: Initialize in Main Entry Point

**Location**: `src/main.tsx` or `src/index.tsx` (before ReactDOM.render)

**Recommended Code (with error handling):**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Clear any stuck observability event queue to prevent storage quota errors
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('observability_event_queue');
  } catch (e) {
    // Ignore errors when clearing
  }
}

// Initialize observability ONLY if service is available and enabled
const OBSERVABILITY_ENABLED = process.env.REACT_APP_OBSERVABILITY_ENABLED !== 'false';
const OBSERVABILITY_SERVICE_URL = process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006';

if (OBSERVABILITY_ENABLED) {
  try {
    const { initObservability } = require('@ai-observability/client');
    
    if (OBSERVABILITY_SERVICE_URL) {
      initObservability({
        serviceUrl: OBSERVABILITY_SERVICE_URL,
        serviceName: 'project-name', // Replace with actual project name
        autoTrack: {
          pageViews: true,      // Auto-track page views
          errors: true,         // Auto-track JavaScript errors
          apiErrors: true,      // Auto-track API errors
          clicks: false,        // Manual click tracking
          formChanges: false,   // Manual form tracking
          apiCalls: false,      // Manual API tracking
        },
        devMode: process.env.NODE_ENV === 'development',
        batchSize: 5,           // Reduce batch size to prevent storage quota issues
      });
    }
  } catch (e) {
    // Package not available or initialization failed - continue without observability
    console.log('Observability not available or failed to initialize:', e.message);
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Simple Code (if package is guaranteed to be available):**
```typescript
import { initObservability } from '@ai-observability/client';

// Initialize BEFORE rendering the app
initObservability({
  serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'project-name', // Replace with actual project name
  autoTrack: {
    pageViews: true,      // Auto-track page views
    errors: true,         // Auto-track JavaScript errors
    apiErrors: true,      // Auto-track API errors
    clicks: false,        // Manual click tracking
    formChanges: false,   // Manual form tracking
    apiCalls: false,      // Manual API tracking
  },
  devMode: process.env.NODE_ENV === 'development',
});
```

**Important**: Place this BEFORE `ReactDOM.createRoot().render()` or `ReactDOM.render()`.

### Step 3: Backend Service Requirements

**Important**: The observability backend service must:
1. Be running at `http://localhost:8006` (or your configured URL)
2. Have CORS configured to allow your app's origin (e.g., `http://localhost:3002`)

**To check/configure CORS**:
- Backend should allow your origin in CORS middleware
- Common ports: 3000, 3001, 3002, 5173 (Vite default)
- Restart backend service after CORS changes

### Step 4: Environment Variables

Create `.env` file:
```bash
# Observability service URL
REACT_APP_OBSERVABILITY_SERVICE_URL=http://localhost:8006

# Enable/disable observability (set to 'false' to disable)
REACT_APP_OBSERVABILITY_ENABLED=true
```

For Vite projects, use `VITE_` prefix:
```bash
VITE_OBSERVABILITY_SERVICE_URL=http://localhost:8006
VITE_OBSERVABILITY_ENABLED=true
```

**Note**: Set `REACT_APP_OBSERVABILITY_ENABLED=false` to disable observability when the service isn't available or CORS isn't configured.

### Step 5: Usage Examples

**Tracked Components:**
```typescript
import { TrackedButton, TrackedInput } from '@ai-observability/client';

// TrackedButton - accepts children
<TrackedButton
  buttonName="submit"
  trackContext="checkout_page"
  onClick={handleClick}
>
  Submit
</TrackedButton>

// TrackedInput - self-closing, NO children
<TrackedInput
  id="email"
  trackContext="login_page"
  value={email}
  onChange={handleChange}
/>
```

**Important**: `TrackedInput` does NOT accept children (it's an input element). Always use it as a self-closing tag.

**Hooks:**
```typescript
import { useObservability } from '@ai-observability/client';

function MyComponent() {
  const { trackEvent } = useObservability();
  
  const handleClick = async () => {
    await trackEvent('button_click', { button_name: 'submit' });
  };
  
  return <button onClick={handleClick}>Click</button>;
}
```

**Manual Tracking (without components):**
```typescript
import { trackEvent, trackUIEvent } from '@ai-observability/client';

// General events
await trackEvent('user_action', { action: 'purchase' });

// UI events with pageContext
await trackUIEvent('click', 'button', {
  elementName: 'checkout',
  pageContext: 'checkout_page',  // Add pageContext directly
  pagePath: window.location.pathname,
});

// You can use trackUIEvent with any element, not just tracked components
const handleCustomClick = () => {
  trackUIEvent('click', 'button', {
    elementName: 'custom-button',
    pageContext: 'dashboard_page',
  });
};
```

## Common Project Types

### Create React App
- Entry: `src/index.tsx`
- Env var: `REACT_APP_OBSERVABILITY_SERVICE_URL`

### Vite + React
- Entry: `src/main.tsx`
- Env var: `VITE_OBSERVABILITY_SERVICE_URL`
- Use: `import.meta.env.VITE_OBSERVABILITY_SERVICE_URL`

### Next.js (Pages Router)
- Entry: `pages/_app.tsx`
- Env var: `NEXT_PUBLIC_OBSERVABILITY_SERVICE_URL`
- Wrap in `useEffect(() => { initObservability(...) }, [])`

### Next.js (App Router)
- Entry: `app/layout.tsx`
- Add `'use client'` directive
- Wrap in `useEffect(() => { initObservability(...) }, [])`

## Configuration Options

```typescript
initObservability({
  serviceUrl: string,              // Default: 'http://localhost:8006'
  serviceName: string,             // Default: '@ai-observability/client'
  autoTrack: {
    pageViews: boolean,            // Default: true
    errors: boolean,                // Default: true
    apiErrors: boolean,            // Default: true
    clicks: boolean,                // Default: false
    formChanges: boolean,          // Default: false
    apiCalls: boolean,             // Default: false
  },
  autoTrackSelectors: {
    clicks: string[],               // CSS selectors for auto-track clicks
  },
  exclude: {
    paths: string[],                // Paths to exclude
    selectors: string[],            // Selectors to exclude
  },
  batchSize: number,               // Default: 10
  batchInterval: number,           // Default: 5000ms
  retryAttempts: number,           // Default: 3
  devMode: boolean,               // Default: auto-detected
  testMode: boolean,               // Default: false
});
```

## Key Points for LLM

1. **Initialization must be BEFORE React rendering** - in main entry point
2. **Only initialize once** - don't call `initObservability()` multiple times
3. **Service URL defaults to localhost:8006** - assumes local Docker setup
4. **Backend CORS must allow your origin** - ensure backend service allows requests from your app's origin
5. **Auto-tracking works immediately** after initialization
6. **Package is React-only** - requires React >= 16.8.0 as peer dependency
7. **TypeScript support** - full type definitions included
8. **Graceful degradation** - works even if service is unavailable (queues events, but CORS errors are not queued)
9. **Must rebuild package** - when using local package, run `npm run build` after changes
10. **Clear localStorage if quota errors** - run `localStorage.removeItem('observability_event_queue')` if storage fills up
11. **Use try-catch for optional initialization** - wrap in try-catch if package might not be available (e.g., Docker builds)
12. **Docker builds** - Package won't be available in Docker unless copied into build context. Use `REACT_APP_OBSERVABILITY_ENABLED=false` or remove from package.json during Docker builds
13. **Clear queue on startup** - Clear `observability_event_queue` from localStorage on app startup to prevent quota errors

## Troubleshooting Checklist

- [ ] Package is installed (`npm install` completed) or linked (`npm link @ai-observability/client`)
- [ ] Package is built (`npm run build` in package directory)
- [ ] `initObservability()` is called in main entry point
- [ ] Initialization is BEFORE `ReactDOM.render()` or `ReactDOM.createRoot().render()`
- [ ] Service URL is correct (default: `http://localhost:8006`)
- [ ] Observability service is running and accessible
- [ ] Backend CORS allows your origin (see CORS section below)
- [ ] `REACT_APP_OBSERVABILITY_ENABLED` is not set to `false` (if you want it enabled)
- [ ] No duplicate initialization calls
- [ ] localStorage queue cleared if quota errors occurred
- [ ] Dev server restarted after linking package or changing .env

## Common Issues & Solutions

### CORS Errors

**Error**: `Access to fetch at 'http://localhost:8006/...' has been blocked by CORS policy`

**Solution**:
1. Ensure backend service allows your origin. Backend should have CORS configured for your port (e.g., `http://localhost:3002`)
2. Restart backend service after CORS changes: `docker-compose restart observability-service`
3. The package now detects CORS errors and won't queue them (they'll never succeed)

**Note**: CORS errors are automatically detected and not queued to prevent infinite loops.

### QuotaExceededError (localStorage Full)

**Error**: `Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota`

**Solution**:
1. Clear corrupted queue in browser:
   ```javascript
   // Run in browser console
   localStorage.removeItem('observability_event_queue');
   ```
2. Or manually delete in DevTools → Application → Local Storage
3. The package now automatically handles quota issues by clearing old events

**Note**: Queue size is limited to 100 events to prevent storage issues.

### Package Not Found After Linking

**Error**: `Cannot find module '@ai-observability/client'`

**Solution**:
1. **Build the package first**: `cd packages/observability-client && npm run build`
2. Verify `dist/` folder exists with `index.js`, `index.esm.js`, `index.d.ts`
3. Then link: `npm link` (in package) → `npm link @ai-observability/client` (in project)
4. **Restart dev server** after linking

### Events Not Being Sent

**Check**:
1. Backend service is running and accessible
2. CORS is configured correctly
3. Service URL is correct
4. `REACT_APP_OBSERVABILITY_ENABLED` is not set to `false`
5. Check browser console for errors (enable `devMode: true`)
6. Verify package is linked/installed: `npm list @ai-observability/client`

### Docker Build Issues

**Error**: Package not found during Docker build

**Solution**:
1. For Docker builds, either:
   - Remove `@ai-observability/client` from `package.json` before building
   - Or copy the package into Docker build context
   - Or set `REACT_APP_OBSERVABILITY_ENABLED=false` and use try-catch initialization
2. The package is typically only available in local development (via npm link)

### React Error: "Objects are not valid as a React child"

**Error**: `Objects are not valid as a React child (found: object with keys {$$typeof, type, key, props...})`

**Solution**:
1. **TrackedInput does NOT accept children** - use it as a self-closing tag:
   ```typescript
   // ✅ Correct
   <TrackedInput trackContext="page" value={value} onChange={handleChange} />
   
   // ❌ Wrong - will cause error
   <TrackedInput trackContext="page">Some text</TrackedInput>
   ```
2. Only `TrackedButton` and `TrackedSelect` accept children (they render `<button>` and `<select>` elements)

### Rebuild Package After Changes

**When using local package** (`file:` or `npm link`):
```bash
# After making changes to package source
cd packages/observability-client
npm run build

# Then restart your project's dev server
```

## Example Complete Setup

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initObservability } from '@ai-observability/client';
import App from './App';
import './index.css';

// Initialize observability
initObservability({
  serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'my-app',
  autoTrack: {
    pageViews: true,
    errors: true,
    apiErrors: true,
  },
  devMode: process.env.NODE_ENV === 'development',
});

// Render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Available Exports

**Functions:**
- `initObservability(config)` - Initialize the client
- `trackEvent(eventName, metadata)` - Track user events
- `trackEventTelemetryOnly(eventName, metadata)` - Track via OpenTelemetry only
- `trackUIEvent(interactionType, elementType, metadata)` - Track UI interactions
- `trackUIError(error, errorInfo)` - Track UI errors
- `trackServiceError(error, requestConfig)` - Track API/network errors

**Components:**
- `TrackedButton` - Auto-tracking button (accepts children)
- `TrackedInput` - Auto-tracking input (self-closing, no children)
- `TrackedCheckbox` - Auto-tracking checkbox (self-closing, no children)
- `TrackedSelect` - Auto-tracking select (accepts `<option>` children)

**Common Props for Tracked Components:**
- `trackContext?: string` - Sets `pageContext` for the event (e.g., "checkout_page", "login_form")
- `track?: boolean` - Enable/disable tracking (default: `true`)
- All standard HTML element props are supported

**Hooks:**
- `useObservability()` - Access tracking functions
- `useAutoTracking(enabled)` - Enable/disable auto-tracking

**Utilities:**
- `getSessionId()` - Get current session ID
- `getUserId()` - Get user ID
- `getDeviceType()` - Get device type
