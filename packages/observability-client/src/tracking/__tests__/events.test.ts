import { trackEvent, trackEventTelemetryOnly } from '../events';
import { getHttpClient } from '../../core/client';
import { getConfig } from '../../core/config';
import { trace } from '@opentelemetry/api';

jest.mock('../../core/client');
jest.mock('../../core/config');
jest.mock('@opentelemetry/api');

describe('Event Tracking', () => {
  const mockHttpClient = {
    send: jest.fn(),
  };

  const mockTracer = {
    startSpan: jest.fn(() => ({
      setAttribute: jest.fn(),
      end: jest.fn(),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getHttpClient as jest.Mock).mockReturnValue(mockHttpClient);
    (getConfig as jest.Mock).mockReturnValue({
      serviceName: 'test-app',
      devMode: false,
    });
    (trace.getTracer as jest.Mock).mockReturnValue(mockTracer);
    mockHttpClient.send.mockResolvedValue({ ok: true });
  });

  describe('trackEventTelemetryOnly', () => {
    it('should create OpenTelemetry span with event name', () => {
      trackEventTelemetryOnly('button_click');

      expect(trace.getTracer).toHaveBeenCalledWith('observability-client');
      expect(mockTracer.startSpan).toHaveBeenCalledWith('user.button_click');
    });

    it('should add metadata as span attributes', () => {
      const span = {
        setAttribute: jest.fn(),
        end: jest.fn(),
      };
      mockTracer.startSpan.mockReturnValue(span);

      trackEventTelemetryOnly('page_view', {
        page: '/dashboard',
        userId: 123,
      });

      expect(span.setAttribute).toHaveBeenCalledWith('page', '/dashboard');
      expect(span.setAttribute).toHaveBeenCalledWith('userId', '123');
      expect(span.end).toHaveBeenCalled();
    });

    it('should handle OpenTelemetry errors silently', () => {
      (trace.getTracer as jest.Mock).mockImplementation(() => {
        throw new Error('OpenTelemetry not available');
      });

      expect(() => trackEventTelemetryOnly('test')).not.toThrow();
    });

    it('should log warning in dev mode on error', () => {
      (getConfig as jest.Mock).mockReturnValue({ devMode: true });
      (trace.getTracer as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      trackEventTelemetryOnly('test');

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create OpenTelemetry span'),
        expect.any(Error)
      );

      consoleWarn.mockRestore();
    });
  });

  describe('trackEvent', () => {
    it('should send event to observability service', async () => {
      await trackEvent('user_action', { action: 'click' });

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        '/events',
        expect.objectContaining({
          event_type: 'user_action',
          event_metadata: { action: 'click' },
          service_name: 'test-app',
        }),
        expect.objectContaining({
          queueOnFailure: true,
          immediate: false,
        })
      );
    });

    it('should include session and user ID', async () => {
      sessionStorage.setItem('observability_session_id', 'session_123');
      localStorage.setItem('observability_user_id', '456');

      await trackEvent('test_event');

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        '/events',
        expect.objectContaining({
          session_id: expect.stringContaining('session_'),
          user_id: expect.any(Number),
        }),
        expect.any(Object)
      );
    });

    it('should use category from metadata', async () => {
      await trackEvent('event', { category: 'custom_category' });

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        '/events',
        expect.objectContaining({
          event_category: 'custom_category',
        }),
        expect.any(Object)
      );
    });

    it('should default to user_interaction category', async () => {
      await trackEvent('event', {});

      expect(mockHttpClient.send).toHaveBeenCalledWith(
        '/events',
        expect.objectContaining({
          event_category: 'user_interaction',
        }),
        expect.any(Object)
      );
    });

    it('should create OpenTelemetry span', async () => {
      await trackEvent('test_event', { key: 'value' });

      expect(mockTracer.startSpan).toHaveBeenCalledWith('user.test_event');
    });

    it('should handle send errors gracefully', async () => {
      mockHttpClient.send.mockRejectedValue(new Error('Network error'));

      await expect(trackEvent('test')).resolves.not.toThrow();
    });

    it('should log in dev mode', async () => {
      (getConfig as jest.Mock).mockReturnValue({
        serviceName: 'test-app',
        devMode: true,
      });
      const consoleDebug = jest.spyOn(console, 'debug').mockImplementation();

      await trackEvent('test_event', { key: 'value' });

      expect(consoleDebug).toHaveBeenCalledWith(
        '[Observability] Event tracked:',
        'test_event',
        { key: 'value' }
      );

      consoleDebug.mockRestore();
    });

    it('should log errors in dev mode', async () => {
      (getConfig as jest.Mock).mockReturnValue({
        serviceName: 'test-app',
        devMode: true,
      });
      mockHttpClient.send.mockRejectedValue(new Error('Test error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await trackEvent('test_event');

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to track event'),
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });
});
