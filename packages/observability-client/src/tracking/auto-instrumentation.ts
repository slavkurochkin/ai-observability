import { getConfig } from '../core/config';
import { trackUIEvent } from './ui-events';
import { trackUIError } from './errors';
import { trackServiceError } from './errors';

/**
 * Auto-instrumentation setup
 */
let isInitialized = false;
let originalFetch: typeof fetch | null = null;
let originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;

/**
 * Initialize auto-instrumentation
 */
export function initAutoInstrumentation(): void {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  const config = getConfig();

  // Auto-track page views
  if (config.autoTrack.pageViews) {
    setupPageViewTracking();
  }

  // Auto-track JavaScript errors
  if (config.autoTrack.errors) {
    setupErrorTracking();
  }

  // Auto-track API errors
  if (config.autoTrack.apiErrors) {
    setupAPITracking();
  }

  // Auto-track clicks on specific selectors
  if (config.autoTrack.clicks || (config.autoTrackSelectors.clicks && config.autoTrackSelectors.clicks.length > 0)) {
    setupClickTracking();
  }

  isInitialized = true;
}

/**
 * Setup page view tracking
 */
function setupPageViewTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Track initial page view
  trackPageView();

  // Track page views on navigation (for SPAs)
  let lastPath = window.location.pathname;

  // Use MutationObserver to detect route changes (works with most routers)
  const observer = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      trackPageView();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also listen to popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    trackPageView();
  });

  // Listen to pushState/replaceState (for programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    trackPageView();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    trackPageView();
  };
}

/**
 * Track page view
 */
function trackPageView(): void {
  const config = getConfig();
  const currentPath = window.location.pathname;

  // Check if path should be excluded
  if (config.exclude.paths?.some(path => currentPath.includes(path))) {
    return;
  }

  trackUIEvent('page_view', 'page', {
    pagePath: currentPath,
    routeName: currentPath,
  });
}

/**
 * Setup error tracking
 */
function setupErrorTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Track unhandled errors
  window.addEventListener('error', (event) => {
    trackUIError(event.error || new Error(event.message), {
      errorType: 'UnhandledError',
      errorSource: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
    });
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    trackUIError(error, {
      errorType: 'UnhandledPromiseRejection',
    });
  });
}

/**
 * Setup API tracking (fetch and XMLHttpRequest)
 */
function setupAPITracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Intercept fetch
  originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    const method = typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET');
    const config = getConfig();

    try {
      const response = await originalFetch!.apply(this, args);

      // Only track errors
      if (!response.ok && config.autoTrack.apiErrors) {
        const clonedResponse = response.clone();
        let responseData = null;
        try {
          responseData = await clonedResponse.text();
        } catch (e) {
          // Ignore
        }

        trackServiceError(
          new Error(`HTTP ${response.status}: ${response.statusText}`),
          {
            url,
            method,
            headers: args[1]?.headers as any,
            data: args[1]?.body as any,
          }
        );
      }

      return response;
    } catch (error: any) {
      if (config.autoTrack.apiErrors) {
        trackServiceError(error, {
          url,
          method,
          headers: args[1]?.headers as any,
          data: args[1]?.body as any,
        });
      }
      throw error;
    }
  };

  // Intercept XMLHttpRequest
  originalXHROpen = XMLHttpRequest.prototype.open;
  originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    (this as any)._observabilityMethod = method;
    (this as any)._observabilityUrl = typeof url === 'string' ? url : url.toString();
    return originalXHROpen!.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    const xhr = this;
    const method = (xhr as any)._observabilityMethod;
    const url = (xhr as any)._observabilityUrl;
    const config = getConfig();

    xhr.addEventListener('error', () => {
      if (config.autoTrack.apiErrors) {
        trackServiceError(
          new Error('XMLHttpRequest failed'),
          {
            url,
            method,
            data: args[0],
          }
        );
      }
    });

    xhr.addEventListener('load', () => {
      if (config.autoTrack.apiErrors && xhr.status >= 400) {
        trackServiceError(
          new Error(`HTTP ${xhr.status}: ${xhr.statusText}`),
          {
            url,
            method,
            data: args[0],
          }
        );
      }
    });

    return originalXHRSend!.apply(this, args);
  };
}

/**
 * Setup click tracking for specific selectors
 */
function setupClickTracking(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const config = getConfig();

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    // Skip elements that are already tracked by our tracked components
    // This prevents duplicate events when using TrackedButton, TrackedInput, etc.
    if (target.hasAttribute('data-tracked') || target.closest('[data-tracked]')) {
      return;
    }

    // Check if element should be excluded
    if (config.exclude.selectors?.some(selector => target.matches(selector))) {
      return;
    }

    // Check if element matches auto-track selectors
    const shouldTrack = config.autoTrack.clicks ||
      config.autoTrackSelectors.clicks?.some(selector => target.matches(selector));

    if (shouldTrack) {
      const elementName = target.getAttribute('data-track-name') ||
        target.getAttribute('aria-label') ||
        target.textContent?.trim() ||
        target.tagName.toLowerCase();

      trackUIEvent('click', target.tagName.toLowerCase(), {
        elementName: elementName.substring(0, 100), // Limit length
        elementId: target.id || undefined,
        pagePath: window.location.pathname,
      });
    }
  }, true); // Use capture phase to catch all clicks
}

/**
 * Cleanup auto-instrumentation
 */
export function cleanupAutoInstrumentation(): void {
  if (!isInitialized) {
    return;
  }

  // Restore original functions
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }

  if (originalXHROpen) {
    XMLHttpRequest.prototype.open = originalXHROpen;
    originalXHROpen = null;
  }

  if (originalXHRSend) {
    XMLHttpRequest.prototype.send = originalXHRSend;
    originalXHRSend = null;
  }

  isInitialized = false;
}
