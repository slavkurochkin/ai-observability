# Integration Guide: Where to Add Observability in Your React Project

## Where to Initialize

The `initObservability()` call should be placed **once at the very start of your application**, before any components render. Here are the common locations:

### Option 1: Main Entry Point (Recommended)

**File: `src/main.tsx` or `src/index.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initObservability } from '@ai-observability/client';
import App from './App';
import './index.css';

// Initialize observability FIRST, before rendering
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

// Then render your app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Option 2: App Component (Alternative)

**File: `src/App.tsx`**

```typescript
import { useEffect } from 'react';
import { initObservability } from '@ai-observability/client';

function App() {
  useEffect(() => {
    // Initialize once when app mounts
    initObservability({
      serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
      serviceName: 'my-app',
      autoTrack: {
        pageViews: true,
        errors: true,
        apiErrors: true,
      },
    });
  }, []); // Empty deps = run once

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}

export default App;
```

**Note:** Option 1 (main.tsx) is preferred because it initializes before any components render, ensuring all auto-tracking works from the start.

---

## Complete Setup Example

### Step 1: Install the Package

Using `file:` protocol or `npm link` (see LOCAL_TESTING.md)

### Step 2: Update Your Main Entry Point

**Create or update `src/main.tsx`:**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initObservability } from '@ai-observability/client';
import App from './App';
import './index.css';

// Initialize observability
initObservability({
  serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'my-react-app',
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 3: Use Tracked Components

**In any component file (e.g., `src/components/MyComponent.tsx`):**

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
        Submit
      </TrackedButton>

      <TrackedInput
        name="email"
        trackContext="signup_page"
        onChange={(e) => console.log(e.target.value)}
      />
    </div>
  );
}
```

### Step 4: Use Hooks

**In any component:**

```typescript
import { useObservability } from '@ai-observability/client';

function MyComponent() {
  const { trackEvent } = useObservability();

  const handleClick = async () => {
    await trackEvent('button_click', {
      button_name: 'custom_button',
      page: 'dashboard',
    });
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

---

## Environment Variables

Create a `.env` file in your project root:

```bash
# .env
REACT_APP_OBSERVABILITY_SERVICE_URL=http://localhost:8006
```

Or for Vite projects:

```bash
# .env
VITE_OBSERVABILITY_SERVICE_URL=http://localhost:8006
```

---

## Project Structure Example

```
my-react-app/
├── .env
├── package.json
├── src/
│   ├── main.tsx          ← Add initObservability here
│   ├── App.tsx
│   ├── components/
│   │   └── MyComponent.tsx  ← Use tracked components here
│   └── ...
└── ...
```

---

## Common React Project Types

### Create React App (CRA)

**File: `src/index.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initObservability } from '@ai-observability/client';
import './index.css';
import App from './App';

initObservability({
  serviceUrl: process.env.REACT_APP_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'my-cra-app',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Vite + React

**File: `src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initObservability } from '@ai-observability/client';
import App from './App.tsx';
import './index.css';

initObservability({
  serviceUrl: import.meta.env.VITE_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
  serviceName: 'my-vite-app',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Next.js

**File: `pages/_app.tsx` or `app/layout.tsx`**

For Pages Router (`pages/_app.tsx`):

```typescript
import { useEffect } from 'react';
import { initObservability } from '@ai-observability/client';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initObservability({
      serviceUrl: process.env.NEXT_PUBLIC_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
      serviceName: 'my-nextjs-app',
    });
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
```

For App Router (`app/layout.tsx`):

```typescript
'use client';

import { useEffect } from 'react';
import { initObservability } from '@ai-observability/client';

export default function RootLayout({ children }) {
  useEffect(() => {
    initObservability({
      serviceUrl: process.env.NEXT_PUBLIC_OBSERVABILITY_SERVICE_URL || 'http://localhost:8006',
      serviceName: 'my-nextjs-app',
    });
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## Important Notes

1. **Call `initObservability()` only once** - at the very start of your app
2. **Don't call it in multiple places** - it should be in your main entry point
3. **It's async** - but you don't need to await it (it initializes in the background)
4. **Auto-tracking starts immediately** - page views, errors, etc. are tracked automatically after initialization

---

## Troubleshooting

### Events not being tracked?

1. Check that `initObservability()` is called before any components render
2. Verify the service URL is correct (`http://localhost:8006`)
3. Make sure Docker services are running
4. Check browser console for errors (if `devMode: true`)

### TypeScript errors?

Make sure you've installed the package and it's in your `node_modules`. The types should be automatically available.

### Build errors?

Make sure you've built the package first:
```bash
cd packages/observability-client
npm run build
```
