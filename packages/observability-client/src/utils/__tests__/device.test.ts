import { getDeviceType, getViewportDimensions, getUserAgent } from '../device';

describe('Device Utilities', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
      writable: true,
    });
  });

  describe('getDeviceType', () => {
    it('should return "mobile" for mobile user agents', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
        writable: true,
      });

      expect(getDeviceType()).toBe('mobile');
    });

    it('should return "tablet" for tablet user agents', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true,
        writable: true,
      });

      expect(getDeviceType()).toBe('tablet');
    });

    it('should return "desktop" for desktop user agents', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        configurable: true,
        writable: true,
      });

      expect(getDeviceType()).toBe('desktop');
    });

    it('should return "desktop" as default', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: '',
        configurable: true,
        writable: true,
      });

      expect(getDeviceType()).toBe('desktop');
    });
  });

  describe('getViewportDimensions', () => {
    it('should return current viewport dimensions', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1080,
      });

      const dimensions = getViewportDimensions();

      expect(dimensions).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it('should handle undefined window', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      const dimensions = getViewportDimensions();

      expect(dimensions).toEqual({
        width: 0,
        height: 0,
      });

      global.window = originalWindow;
    });
  });

  describe('getUserAgent', () => {
    it('should return user agent string', () => {
      const userAgent = 'Mozilla/5.0 (Test)';
      Object.defineProperty(window.navigator, 'userAgent', {
        value: userAgent,
        configurable: true,
      });

      expect(getUserAgent()).toBe(userAgent);
    });

    it('should return empty string if navigator is undefined', () => {
      const originalNavigator = global.navigator;
      delete (global as any).navigator;

      expect(getUserAgent()).toBe('');

      global.navigator = originalNavigator;
    });
  });
});
