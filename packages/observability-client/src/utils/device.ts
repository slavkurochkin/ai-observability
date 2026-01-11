/**
 * Get device type based on viewport width
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const width = window.innerWidth;
  if (width < 768) {
    return 'mobile';
  } else if (width < 1024) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Get viewport dimensions
 */
export function getViewportDimensions(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Get user agent
 */
export function getUserAgent(): string {
  if (typeof navigator === 'undefined') {
    return '';
  }
  return navigator.userAgent;
}
