import { initObservability, trackEvent, trackUIEvent } from '../index';
import { getHttpClient } from '../core/client';

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      await initObservability();

      // Should check service health
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });

    it('should initialize with custom configuration', async () => {
      await initObservability({
        serviceUrl: 'http://custom:8000',
        serviceName: 'custom-app',
        devMode: true,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://custom:8000/health'),
        expect.any(Object)
      );
    });

    it('should handle service unavailable gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      await initObservability({ devMode: true });

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Service at http://localhost:8006 is not available')
      );

      consoleWarn.mockRestore();
    });
  });

  describe('Event Tracking Flow', () => {
    it('should track event and send to service', async () => {
      await initObservability({ testMode: false });

      await trackEvent('test_event', { key: 'value' });

      // Should have attempted to send event
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/events'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test_event'),
        })
      );
    });

    it('should queue events when service is unavailable', async () => {
      await initObservability();

      // Make service unavailable
      global.fetch = jest.fn().mockRejectedValue(new Error('Service down'));

      await trackEvent('queued_event', { test: true });

      // Should store in queue
      const queueKey = 'observability_event_queue';
      expect(localStorage.setItem).toHaveBeenCalledWith(
        queueKey,
        expect.any(String)
      );
    });

    it('should batch multiple events', async () => {
      jest.useFakeTimers();
      await initObservability();

      // Track multiple events quickly
      trackEvent('event1');
      trackEvent('event2');
      trackEvent('event3');

      // Should not send immediately
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only health check

      // Advance timers to trigger batch send
      jest.advanceTimersByTime(6000);

      // Should have batched and sent
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/events'),
        expect.any(Object)
      );

      jest.useRealTimers();
    });
  });

  describe('UI Event Tracking', () => {
    it('should track UI events with full context', async () => {
      await initObservability();

      await trackUIEvent('click', 'button', {
        elementName: 'submit',
        elementId: 'submit-btn',
        pagePath: '/dashboard',
        pageContext: 'main_form',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ui-events'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('submit'),
        })
      );
    });
  });

  describe('Session Management', () => {
    it('should maintain session across multiple events', async () => {
      await initObservability();

      await trackEvent('event1');
      const firstCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/events')
      );

      await trackEvent('event2');
      const secondCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/events') && call !== firstCall
      );

      // Extract session IDs from both calls
      const firstBody = JSON.parse(firstCall[1].body);
      const secondBody = JSON.parse(secondCall[1].body);

      // Should use same session ID
      expect(firstBody.session_id).toBe(secondBody.session_id);
    });

    it('should create new session after timeout', async () => {
      jest.useFakeTimers();
      await initObservability();

      await trackEvent('event1');
      const firstSessionId = sessionStorage.getItem('observability_session_id');

      // Advance time past session timeout (30 minutes)
      jest.advanceTimersByTime(31 * 60 * 1000);

      await trackEvent('event2');
      const secondSessionId = sessionStorage.getItem('observability_session_id');

      expect(firstSessionId).not.toBe(secondSessionId);

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should not throw errors when tracking fails', async () => {
      await initObservability();

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(trackEvent('test')).resolves.not.toThrow();
      await expect(trackUIEvent('click', 'button')).resolves.not.toThrow();
    });

    it('should retry failed requests', async () => {
      await initObservability();

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
      });

      await trackEvent('retry_test');

      // Should have retried multiple times
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe('Test Mode', () => {
    it('should not send events in test mode', async () => {
      await initObservability({ testMode: true });

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      await trackEvent('test_event');
      await trackUIEvent('click', 'button');

      // Should not have made additional calls
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(initialCallCount);
    });
  });
});
