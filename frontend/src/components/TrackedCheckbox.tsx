import React, { InputHTMLAttributes } from 'react';
import { trackUIEvent } from '../utils/otel';

interface TrackedCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  trackEvent?: string;
  trackMetadata?: Record<string, any>;
  trackContext?: string;
  track?: boolean;
  checkboxName?: string;
}

/**
 * Checkbox component that automatically tracks change events
 * 
 * @example
 * <TrackedCheckbox
 *   name="agree_to_terms"
 *   trackContext="signup_page"
 *   checked={agreed}
 *   onChange={handleChange}
 * />
 */
export function TrackedCheckbox({
  trackEvent = 'checkbox_change',
  trackMetadata = {},
  trackContext,
  track = true,
  checkboxName,
  onChange,
  ...props
}: TrackedCheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (track) {
      const name = checkboxName || props.name || props.id || 'unknown_checkbox';
      const checked = e.target.checked;
      
      trackUIEvent('change', 'checkbox', {
        elementName: name,
        elementId: props.id,
        pagePath: window.location.pathname,
        pageContext: trackContext,
        eventValue: checked ? 'checked' : 'unchecked',
        checked: checked,
        ...trackMetadata,
      });
    }

    if (onChange) {
      onChange(e);
    }
  };

  return (
    <input
      {...props}
      type="checkbox"
      onChange={handleChange}
    />
  );
}

