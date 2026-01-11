import React, { InputHTMLAttributes } from 'react';
import { trackUIEvent } from '../tracking/ui-events';
import { filterValidProps } from '../utils/filterProps';

export interface TrackedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  trackEvent?: string;
  trackMetadata?: Record<string, any>;
  trackContext?: string;
  track?: boolean;
  inputName?: string;
  trackOnChange?: boolean;
  trackOnFocus?: boolean;
  trackOnBlur?: boolean;
}

/**
 * Input component that automatically tracks change, focus, and blur events
 * 
 * @example
 * <TrackedInput
 *   name="email"
 *   trackContext="login_page"
 *   trackOnFocus={true}
 *   onChange={handleChange}
 * />
 */
export function TrackedInput({
  trackEvent = 'input_change',
  trackMetadata = {},
  trackContext,
  track = true,
  inputName,
  trackOnChange = false,
  trackOnFocus = false,
  trackOnBlur = true,
  onChange,
  onFocus,
  onBlur,
  ...props
}: TrackedInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (track && trackOnChange) {
      const name = inputName || props.name || props.id || 'unknown_input';
      const value = e.target.value;

      trackUIEvent('change', 'input', {
        elementName: name,
        elementId: props.id,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        pageContext: trackContext,
        eventValue: value.length > 100 ? value.substring(0, 100) : value, // Sanitize long values
        ...trackMetadata,
      });
    }

    if (onChange) {
      onChange(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (track && trackOnFocus) {
      const name = inputName || props.name || props.id || 'unknown_input';

      trackUIEvent('focus', 'input', {
        elementName: name,
        elementId: props.id,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        pageContext: trackContext,
        ...trackMetadata,
      });
    }

    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (track && trackOnBlur) {
      const name = inputName || props.name || props.id || 'unknown_input';
      const value = e.target.value;

      trackUIEvent('blur', 'input', {
        elementName: name,
        elementId: props.id,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        pageContext: trackContext,
        eventValue: value.length > 100 ? value.substring(0, 100) : value,
        ...trackMetadata,
      });
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  // Filter props using whitelist approach
  const cleanProps = filterValidProps(props, 'input');

  // Ensure event handlers are set
  cleanProps.onChange = handleChange;
  cleanProps.onFocus = handleFocus;
  cleanProps.onBlur = handleBlur;

  // Use JSX with explicit prop spreading
  // Add data-tracked attribute to prevent auto-instrumentation from double-tracking
  return <input {...cleanProps} data-tracked="true" />;
}
