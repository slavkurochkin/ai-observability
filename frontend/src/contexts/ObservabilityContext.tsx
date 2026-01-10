import { createContext, useContext, ReactNode } from 'react';
import { trackEvent, startSpan } from '../utils/otel';

interface ObservabilityContextType {
  trackEvent: (eventName: string, metadata?: Record<string, any>) => Promise<void>;
  startSpan: (name: string, metadata?: Record<string, any>) => any;
}

const ObservabilityContext = createContext<ObservabilityContextType | undefined>(undefined);

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  return (
    <ObservabilityContext.Provider value={{ trackEvent, startSpan }}>
      {children}
    </ObservabilityContext.Provider>
  );
}

export function useObservability() {
  const context = useContext(ObservabilityContext);
  if (context === undefined) {
    throw new Error('useObservability must be used within ObservabilityProvider');
  }
  return context;
}

