import { getConfig } from './config';
import { getSessionId } from './session';
import { getObservabilityUserId } from '../utils/user';
import { getDeviceType, getViewportDimensions, getUserAgent } from '../utils/device';
import type { QueuedEvent } from '../types';

/**
 * Event queue for offline support
 */
class EventQueue {
  private queue: QueuedEvent[] = [];
  private readonly STORAGE_KEY = 'observability_event_queue';
  private maxQueueSize = 100; // Reduced to prevent quota issues

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load event queue from storage:', e);
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e: any) {
      // If quota exceeded, clear old events and try again
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('[Observability] Storage quota exceeded, clearing old events');
        // Keep only the most recent 50 events
        this.queue = this.queue.slice(-50);
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
        } catch (e2) {
          // If still fails, clear completely
          console.warn('[Observability] Still unable to save, clearing queue');
          this.clear();
        }
      } else {
        console.warn('Failed to save event queue to storage:', e);
      }
    }
  }

  /**
   * Add event to queue
   */
  enqueue(event: Omit<QueuedEvent, 'id' | 'timestamp' | 'retries'>): void {
    // Aggressively trim queue if it's getting large
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest 25% of events
      const removeCount = Math.floor(this.maxQueueSize * 0.25);
      this.queue.splice(0, removeCount);
    }

    const queuedEvent: QueuedEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      ...event,
    };

    this.queue.push(queuedEvent);
    this.saveToStorage();
  }

  /**
   * Get all queued events
   */
  getAll(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Remove event from queue
   */
  remove(eventId: string): void {
    this.queue = this.queue.filter(e => e.id !== eventId);
    this.saveToStorage();
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Increment retry count for event
   */
  incrementRetry(eventId: string): void {
    const event = this.queue.find(e => e.id === eventId);
    if (event) {
      event.retries++;
      this.saveToStorage();
    }
  }
}

/**
 * HTTP client with retry logic and batching
 */
class HttpClient {
  private queue: EventQueue;
  private batch: Array<{ endpoint: string; payload: any }> = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;

  constructor() {
    this.queue = new EventQueue();
    this.startBatchProcessor();
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    const config = getConfig();
    const interval = config.batchInterval;

    setInterval(() => {
      this.flushBatch();
    }, interval);
  }

  /**
   * Send event with retry logic
   */
  async send(
    endpoint: string,
    payload: any,
    options: {
      queueOnFailure?: boolean;
      immediate?: boolean;
    } = {}
  ): Promise<void> {
    const config = getConfig();
    const { queueOnFailure = true, immediate = false } = options;

    // In test mode, don't actually send
    if (config.testMode) {
      if (config.devMode) {
        console.log('[Observability Test Mode] Would send:', endpoint, payload);
      }
      return;
    }

    if (immediate) {
      try {
        await this.sendImmediate({ endpoint, payload }, queueOnFailure);
      } catch (error) {
        // Error is handled by sendImmediate
      }
    } else {
      this.batch.push({ endpoint, payload });
      if (this.batch.length >= config.batchSize) {
        this.flushBatch();
      }
    }
  }

  /**
   * Send event immediately
   */
  private async sendImmediate(
    event: { endpoint: string; payload: any },
    queueOnFailure: boolean
  ): Promise<void> {
    const config = getConfig();
    const { endpoint, payload } = event;

    try {
      const response = await fetch(`${config.serviceUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (config.devMode) {
        console.debug('[Observability] Event sent successfully:', endpoint);
      }
    } catch (error: any) {
      if (config.devMode) {
        console.warn('[Observability] Failed to send event:', error);
      }

      // Don't queue CORS errors - they'll never succeed
      const isCorsError = error?.message?.includes('CORS') || 
                         error?.message?.includes('Failed to fetch') ||
                         error?.name === 'TypeError' && error?.message?.includes('fetch');

      if (queueOnFailure && !isCorsError) {
        // Determine event type from endpoint
        let eventType: QueuedEvent['type'] = 'event';
        if (endpoint.includes('/ui-events')) {
          eventType = 'ui_event';
        } else if (endpoint.includes('/errors/ui')) {
          eventType = 'ui_error';
        } else if (endpoint.includes('/errors/services')) {
          eventType = 'service_error';
        }

        this.queue.enqueue({
          type: eventType,
          payload: { endpoint, payload },
        });
      } else if (isCorsError && config.devMode) {
        console.warn(
          '[Observability] CORS error detected. ' +
          'Make sure the observability service allows requests from this origin. ' +
          `Current origin: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`
        );
      }

      throw error;
    }
  }

  /**
   * Flush batch of events
   */
  private async flushBatch(): Promise<void> {
    if (this.isProcessing || this.batch.length === 0) {
      return;
    }

    this.isProcessing = true;
    const events = [...this.batch];
    this.batch = [];

    try {
      // Send events individually (batch endpoint can be added later)
      for (const event of events) {
        try {
          await this.sendImmediate(event, true);
        } catch (error) {
          // Event is queued by sendImmediate, continue with next
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process queued events
   */
  async processQueue(): Promise<void> {
    const config = getConfig();
    const queuedEvents = this.queue.getAll();

    if (queuedEvents.length === 0) {
      return;
    }

    // Limit processing to prevent overwhelming
    const eventsToProcess = queuedEvents.slice(0, 10);

    for (const event of eventsToProcess) {
      if (event.retries >= config.retryAttempts) {
        // Max retries reached, remove from queue
        this.queue.remove(event.id);
        continue;
      }

      try {
        const { endpoint, payload } = event.payload;
        await this.sendImmediate({ endpoint, payload }, false);
        this.queue.remove(event.id);
      } catch (error: any) {
        // Don't retry CORS errors
        const isCorsError = error?.message?.includes('CORS') || 
                           error?.message?.includes('Failed to fetch');
        
        if (isCorsError) {
          // Remove CORS errors immediately - they'll never succeed
          this.queue.remove(event.id);
          continue;
        }

        this.queue.incrementRetry(event.id);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, event.retries) * 1000));
      }
    }
  }

  /**
   * Check if service is available
   */
  async checkHealth(): Promise<boolean> {
    const config = getConfig();

    try {
      const response = await fetch(`${config.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all queued events
   */
  clearQueue(): void {
    this.queue.clear();
  }
}

/**
 * Global HTTP client instance
 */
let httpClient: HttpClient | null = null;

/**
 * Get or create HTTP client
 */
export function getHttpClient(): HttpClient {
  if (!httpClient) {
    httpClient = new HttpClient();
  }
  return httpClient;
}

/**
 * Initialize HTTP client
 */
export function initHttpClient(): void {
  httpClient = new HttpClient();
  
  // Start processing queue periodically
  setInterval(() => {
    httpClient?.processQueue();
  }, 10000); // Every 10 seconds

  // Process queue on page visibility change (when user comes back)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        httpClient?.processQueue();
      }
    });
  }
}
