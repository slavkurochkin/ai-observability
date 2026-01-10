import React, { SelectHTMLAttributes, ReactNode } from 'react';
import { trackUIEvent } from '../utils/otel';

interface TrackedSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  trackEvent?: string;
  trackMetadata?: Record<string, any>;
  trackContext?: string;
  track?: boolean;
  selectName?: string;
}

/**
 * Select component that automatically tracks change events
 * 
 * @example
 * <TrackedSelect
 *   name="evaluation_type"
 *   trackContext="evaluations_page"
 *   value={type}
 *   onChange={handleChange}
 * >
 *   <option value="variance">Variance</option>
 *   <option value="reference_based">Reference Based</option>
 * </TrackedSelect>
 */
export function TrackedSelect({
  children,
  trackEvent = 'select_change',
  trackMetadata = {},
  trackContext,
  track = true,
  selectName,
  onChange,
  ...props
}: TrackedSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (track) {
      const name = selectName || props.name || props.id || 'unknown_select';
      const value = e.target.value;
      
      trackUIEvent('change', 'select', {
        elementName: name,
        elementId: props.id,
        pagePath: window.location.pathname,
        pageContext: trackContext,
        eventValue: value,
        ...trackMetadata,
      });
    }

    if (onChange) {
      onChange(e);
    }
  };

  return (
    <select {...props} onChange={handleChange}>
      {children}
    </select>
  );
}

