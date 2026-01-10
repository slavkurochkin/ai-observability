import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { trackUIEvent } from '../utils/otel';

interface TrackedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
export function TrackedButton({
  children,
  trackEvent = 'button_click',
  trackMetadata = {},
  trackContext,
  track = true,
  buttonName,
  onClick,
  ...props
}: TrackedButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (track) {
      // Extract button name from children if not provided
      const name = buttonName || 
        (typeof children === 'string' ? children : 'button') ||
        props.name ||
        props.id ||
        'unknown_button';

      trackUIEvent('click', 'button', {
        elementName: name,
        elementId: props.id,
        pagePath: window.location.pathname,
        pageContext: trackContext,
        eventValue: null,
        ...trackMetadata,
      });
    }

    // Call original onClick handler
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button {...props} onClick={handleClick}>
      {children}
    </button>
  );
}

