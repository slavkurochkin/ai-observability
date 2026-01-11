# Fixing CORS and Quota Errors in Your Project

## The Issues

1. **CORS Error**: Your project at `http://localhost:3002` is blocked by the observability service
2. **QuotaExceededError**: Events are being queued but can't be sent, filling up localStorage

## Solution Steps

### Step 1: Update the Package (Already Fixed)

The package has been updated with fixes. You need to rebuild it:

```bash
cd packages/observability-client
npm run build
```

### Step 2: Restart Backend Service (CORS Fix)

The backend CORS has been updated to allow `localhost:3002`. Restart the service:

```bash
# In the main project directory
docker-compose restart observability-service
```

Or if running manually:
```bash
# Restart the FastAPI service
```

### Step 3: Update Package in Your Other Project

**If using `npm link`:**
```bash
# In package directory
cd packages/observability-client
npm run build  # Rebuild with fixes

# In your other project
cd /path/to/your/other/project
# The link should automatically pick up the new build
# But restart your dev server to be sure
```

**If using `file:` protocol:**
```bash
# In package directory
cd packages/observability-client
npm run build  # Rebuild with fixes

# In your other project
cd /path/to/your/other/project
# Restart your dev server - it should pick up the new build
```

### Step 4: Clear localStorage in Your Other Project

**Important**: Clear the corrupted queue in your browser:

1. Open your other project in the browser
2. Open DevTools (F12)
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Find **Local Storage** → your domain (e.g., `http://localhost:3002`)
5. Find and **delete** the key: `observability_event_queue`

**Or run in browser console:**
```javascript
localStorage.removeItem('observability_event_queue');
```

### Step 5: Restart Your Dev Server

```bash
# In your other project
# Stop the server (Ctrl+C)
# Restart
npm start
# or
npm run dev
```

## What Was Fixed

### Backend (CORS)
- Added `http://localhost:3002` to allowed origins
- Added common localhost ports

### Client Package
- **CORS error detection**: Won't queue CORS errors (they'll never succeed)
- **Quota handling**: Automatically clears old events when storage is full
- **Reduced queue size**: From 1000 to 100 events
- **Smarter cleanup**: Removes oldest events when quota exceeded
- **Better error handling**: Detects and skips CORS errors

## Verify It's Working

After the steps above:

1. Check browser console - CORS errors should stop
2. Check that events are being sent (if service is running)
3. Check that localStorage isn't filling up

## If CORS Still Fails

If you're using a different port, you can:

**Option 1**: Add your port to backend CORS (in `services/observability-service/main.py`):
```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",  # Add your port
    # ... etc
],
```

**Option 2**: Use a wildcard for development (less secure):
```python
allow_origins=["*"],  # Only for development!
```

Then restart the backend service.

## Temporary Workaround

If you can't restart the backend immediately, you can disable auto-tracking of API errors to prevent the loop:

```typescript
// In your other project's initialization
initObservability({
  serviceUrl: 'http://localhost:8006',
  serviceName: 'my-app',
  autoTrack: {
    pageViews: true,
    errors: true,
    apiErrors: false,  // Disable until CORS is fixed
  },
});
```

This will stop the API error tracking loop while you fix CORS.
