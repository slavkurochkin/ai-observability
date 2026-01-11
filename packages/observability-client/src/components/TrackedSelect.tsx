import React, { SelectHTMLAttributes, ReactNode } from 'react';
import { trackUIEvent } from '../tracking/ui-events';
import { filterValidProps } from '../utils/filterProps';

export interface TrackedSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
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
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        pageContext: trackContext,
        eventValue: value,
        ...trackMetadata,
      });
    }

    if (onChange) {
      onChange(e);
    }
  };

  // Filter props using whitelist approach
  const cleanProps = filterValidProps(props, 'select');

  // Ensure onChange is set
  cleanProps.onChange = handleChange;

  // Validate children - ensure it's not an invalid React element object
  let validChildren = children;
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    // If it's an object but not a valid React element, convert to string
    if (!React.isValidElement(children)) {
      validChildren = String(children);
    }
  }

  // Use JSX with explicit prop spreading
  // Add data-tracked attribute to prevent auto-instrumentation from double-tracking
  return (
    <select {...cleanProps} onChange={handleChange} data-tracked="true">
      {validChildren}
    </select>
  );
}
