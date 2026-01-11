import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { trackUIEvent } from '../tracking/ui-events';
import { filterValidProps } from '../utils/filterProps';

export interface TrackedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  trackEvent?: string;
  trackMetadata?: Record<string, any>;
  trackContext?: string;
  track?: boolean;
  buttonName?: string;
}

/**
 * Button component that automatically tracks click events
 * 
 * @example
 * <TrackedButton
 *   trackContext="evaluations_page"
 *   buttonName="create_evaluation"
 *   onClick={handleCreate}
 * >
 *   Create Evaluation
 * </TrackedButton>
 */
export function TrackedButton(props: TrackedButtonProps) {
  // Extract all custom props first, including children
  const {
    children,
    trackEvent = 'button_click',
    trackMetadata = {},
    trackContext,
    track = true,
    buttonName,
    onClick,
    ...restProps
  } = props;
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (track) {
      // Extract button name from children if not provided
      const name = buttonName ||
        (typeof children === 'string' ? children : 'button') ||
        restProps.name ||
        restProps.id ||
        'unknown_button';

      trackUIEvent('click', 'button', {
        elementName: name,
        elementId: restProps.id,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '',
        pageContext: trackContext,
        ...trackMetadata,
      });
    }

    // Call original onClick handler
    if (onClick) {
      onClick(e);
    }
  };

  // Filter props using whitelist approach
  const cleanProps = filterValidProps(restProps, 'button');

  // Ensure onClick is set
  cleanProps.onClick = handleClick;

  // Validate children - ensure it's not an invalid React element object
  let validChildren = children;
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    // If it's an object but not a valid React element, convert to string
    if (!React.isValidElement(children)) {
      validChildren = String(children);
    }
  }

  // Use JSX with explicit prop spreading to avoid any issues
  // Add data-tracked attribute to prevent auto-instrumentation from double-tracking
  return (
    <button {...cleanProps} onClick={handleClick} data-tracked="true">
      {validChildren}
    </button>
  );
}
