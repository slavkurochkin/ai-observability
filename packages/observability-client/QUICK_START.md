# Quick Start: Test Locally

## Fastest Way: Use `file:` Protocol

### 1. Build the Package

```bash
cd packages/observability-client
npm install
npm run build
```

### 2. Add to Your Project's package.json

In your project's `package.json`, add:

```json
{
  "dependencies": {
    "@ai-observability/client": "file:../packages/observability-client"
  }
}
```

**Adjust the path** based on where your project is relative to the package:
- Same repo: `file:../packages/observability-client`
- Different location: `file:/absolute/path/to/packages/observability-client`

### 3. Install

```bash
cd /path/to/your/project
npm install
```

### 4. Use It!

```typescript
import { initObservability, trackEvent, TrackedButton } from '@ai-observability/client';

// Initialize once
initObservability({
  serviceUrl: 'http://localhost:8006',
  serviceName: 'my-app',
});

// Track events
await trackEvent('test', { hello: 'world' });

// Use components
<TrackedButton onClick={handleClick}>Click me</TrackedButton>
```

---

## Alternative: Use `npm link`

### 1. Link the Package

```bash
cd packages/observability-client
npm install
npm run build
npm link
```

### 2. Link in Your Project

```bash
cd /path/to/your/project
npm link @ai-observability/client
```

### 3. Use It!

Same as above - import and use normally.

**Note:** With `npm link`, changes to the package are immediately available (after rebuild). With `file:` protocol, you need to rebuild and restart your dev server.

---

## Testing in Current Frontend Project

To test in the existing `frontend/` project:

### Option 1: Update frontend/package.json

Add this to `frontend/package.json`:

```json
{
  "dependencies": {
    "@ai-observability/client": "file:../packages/observability-client"
  }
}
```

Then:

```bash
cd frontend
npm install
```

### Option 2: Use npm link

```bash
# Terminal 1: Build and link
cd packages/observability-client
npm install
npm run build
npm link

# Terminal 2: Link in frontend
cd frontend
npm link @ai-observability/client
```

### Update frontend/src/main.tsx

Replace the current observability setup with:

```typescript
import { initObservability } from '@ai-observability/client';

// Initialize observability
initObservability({
  serviceUrl: import.meta.env.VITE_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'observability-demo-frontend',
  autoTrack: {
    pageViews: true,
    errors: true,
    apiErrors: true,
  },
  devMode: true,
});
```

Then you can use the tracked components and hooks throughout your app!

---

## Watch Mode for Development

If you're actively developing the package:

```bash
# Terminal 1: Watch mode (rebuilds on changes)
cd packages/observability-client
npm run dev

# Terminal 2: Your project dev server
cd /path/to/your/project
npm run dev
```

With `npm link`, changes are picked up automatically. With `file:` protocol, restart your dev server after rebuilds.
