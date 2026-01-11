# Quick Reference for LLM: @ai-observability/client Setup

## Package Setup

**Package**: `@ai-observability/client` (React observability library)
**Default Service**: `http://localhost:8006` (requires backend CORS config)
**Install**: `npm link @ai-observability/client` or `"@ai-observability/client": "file:../path/to/package"`
**Important**: Build package first: `cd packages/observability-client && npm run build`

## Required Setup Code

**Location**: `src/main.tsx` or `src/index.tsx` (BEFORE ReactDOM.render)

**Recommended (with error handling):**
```typescript
// Clear stuck queue on startup
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('observability_event_queue');
  } catch (e) {}
}

// Initialize if enabled
const OBSERVABILITY_ENABLED = process.env.REACT_APP_OBSERVABILITY_ENABLED !== 'false';
if (OBSERVABILITY_ENABLED) {
  try {
    const { initObservability } = require('@ai-observability/client');
    initObservability({
      serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
      serviceName: 'project-name',
      autoTrack: { pageViews: true, errors: true, apiErrors: true },
      devMode: process.env.NODE_ENV === 'development',
      batchSize: 5,
    });
  } catch (e) {
    console.log('Observability not available:', e.message);
  }
}
```

**Simple (if package guaranteed available):**
```typescript
import { initObservability } from '@ai-observability/client';

initObservability({
  serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'project-name',
  autoTrack: { pageViews: true, errors: true, apiErrors: true },
  devMode: process.env.NODE_ENV === 'development',
});
```

## Key Rules

1. Initialize ONCE in main entry point
2. BEFORE ReactDOM.render/ReactDOM.createRoot
3. Service URL defaults to `http://localhost:8006`
4. Backend CORS must allow your origin (check backend config)
5. Auto-tracking starts immediately after init
6. **REBUILD package after changes**: `cd packages/observability-client && npm run build` (if using local package)
7. **Restart dev server** after rebuilding package or linking
8. Clear localStorage if quota errors: `localStorage.removeItem('observability_event_queue')`
9. Use try-catch for optional initialization (Docker builds, missing package)
10. Set `REACT_APP_OBSERVABILITY_ENABLED=false` to disable when service unavailable
11. Clear queue on startup to prevent quota errors
12. **TrackedInput/TrackedCheckbox are self-closing** - do NOT pass children to them

## Common Issues

**CORS Error**: Backend must allow your origin. Restart backend after CORS changes. Disable with `REACT_APP_OBSERVABILITY_ENABLED=false` if service unavailable.

**QuotaExceededError**: Clear queue: `localStorage.removeItem('observability_event_queue')`. Clear on startup to prevent.

**Module Not Found**: Build package first: `cd packages/observability-client && npm run build`. Then link: `npm link @ai-observability/client`. Restart dev server.

**Docker Build Fails**: Remove from package.json or set `REACT_APP_OBSERVABILITY_ENABLED=false`. Package only available in local dev.

## Usage

```typescript
// Components
import { TrackedButton, TrackedInput } from '@ai-observability/client';
<TrackedButton trackContext="page_name" onClick={handleClick}>Click</TrackedButton>
<TrackedInput trackContext="page_name" value={value} onChange={handleChange} />

// Hooks
const { trackEvent } = useObservability();
await trackEvent('action', { data: 'value' });

// Manual tracking with pageContext
import { trackUIEvent } from '@ai-observability/client';
await trackUIEvent('click', 'button', {
  elementName: 'submit',
  pageContext: 'checkout_page',  // Add pageContext directly
});

// General events
import { trackEvent } from '@ai-observability/client';
await trackEvent('event_name', { metadata });
```

**Important Notes**:
- `TrackedInput` and `TrackedCheckbox` are **self-closing** - do NOT pass children: `<TrackedInput />` ✅ not `<TrackedInput>text</TrackedInput>` ❌
- `TrackedButton` and `TrackedSelect` accept children: `<TrackedButton>Click</TrackedButton>` ✅
- **After package updates**: Rebuild with `npm run build` in package directory, then restart your app's dev server

## Exports

**Functions**: `initObservability`, `trackEvent`, `trackUIEvent`, `trackUIError`, `trackServiceError`
**Components**: `TrackedButton`, `TrackedInput`, `TrackedCheckbox`, `TrackedSelect`
**Hooks**: `useObservability()`, `useAutoTracking()`
