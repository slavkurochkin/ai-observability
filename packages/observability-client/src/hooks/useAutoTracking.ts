import { useEffect, useState } from 'react';
import { getConfig, updateConfig } from '../core/config';

/**
 * Hook to enable/disable auto-tracking per component
 */
export function useAutoTracking(enabled: boolean = true) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  useEffect(() => {
    const config = getConfig();
    const previousAutoTrack = { ...config.autoTrack };

    if (enabled) {
      // Enable all auto-tracking when enabled
      updateConfig({
        autoTrack: {
          pageViews: true,
          errors: true,
          apiErrors: true,
          clicks: false,
          formChanges: false,
          apiCalls: false,
        },
      });
    } else {
      // Disable all auto-tracking when disabled
      updateConfig({
        autoTrack: {
          pageViews: false,
          errors: false,
          apiErrors: false,
          clicks: false,
          formChanges: false,
          apiCalls: false,
        },
      });
    }

    // Restore previous config on unmount
    return () => {
      updateConfig({
        autoTrack: previousAutoTrack,
      });
    };
  }, [enabled]);

  return {
    isEnabled,
    setEnabled: setIsEnabled,
  };
}
