import React from 'react';

/**
 * Whitelist of valid HTML attributes for input elements
 */
const VALID_INPUT_ATTRS = new Set([
  'accept', 'alt', 'autoComplete', 'autoFocus', 'capture', 'checked', 'defaultChecked',
  'defaultValue', 'disabled', 'form', 'formAction', 'formEncType', 'formMethod', 'formNoValidate',
  'formTarget', 'height', 'id', 'list', 'max', 'maxLength', 'min', 'minLength', 'multiple',
  'name', 'pattern', 'placeholder', 'readOnly', 'required', 'size', 'src', 'step', 'tabIndex',
  'type', 'value', 'width',
  // Event handlers
  'onChange', 'onFocus', 'onBlur', 'onClick', 'onDoubleClick', 'onMouseDown', 'onMouseUp',
  'onMouseEnter', 'onMouseLeave', 'onMouseMove', 'onMouseOver', 'onMouseOut', 'onKeyDown',
  'onKeyPress', 'onKeyUp', 'onSubmit', 'onInvalid', 'onReset',
  // ARIA and data attributes
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid', 'aria-required',
  'role', 'data-*',
  // Standard HTML attributes
  'className', 'class', 'style', 'title', 'lang', 'dir', 'accessKey', 'contentEditable',
  'contextMenu', 'draggable', 'hidden', 'spellCheck', 'translate',
]);

/**
 * Whitelist of valid HTML attributes for button elements
 */
const VALID_BUTTON_ATTRS = new Set([
  'autoFocus', 'disabled', 'form', 'formAction', 'formEncType', 'formMethod', 'formNoValidate',
  'formTarget', 'id', 'name', 'tabIndex', 'type', 'value',
  // Event handlers
  'onClick', 'onDoubleClick', 'onMouseDown', 'onMouseUp', 'onMouseEnter', 'onMouseLeave',
  'onMouseMove', 'onMouseOver', 'onMouseOut', 'onKeyDown', 'onKeyPress', 'onKeyUp',
  'onFocus', 'onBlur', 'onSubmit', 'onReset',
  // ARIA and data attributes
  'aria-label', 'aria-labelledby', 'aria-describedby', 'role', 'data-*',
  // Standard HTML attributes
  'className', 'class', 'style', 'title', 'lang', 'dir', 'accessKey', 'contentEditable',
  'contextMenu', 'draggable', 'hidden', 'spellCheck', 'translate',
]);

/**
 * Whitelist of valid HTML attributes for select elements
 */
const VALID_SELECT_ATTRS = new Set([
  'autoFocus', 'disabled', 'form', 'id', 'multiple', 'name', 'required', 'size', 'tabIndex', 'value',
  // Event handlers
  'onChange', 'onFocus', 'onBlur', 'onClick', 'onDoubleClick', 'onMouseDown', 'onMouseUp',
  'onMouseEnter', 'onMouseLeave', 'onMouseMove', 'onMouseOver', 'onMouseOut', 'onKeyDown',
  'onKeyPress', 'onKeyUp', 'onSubmit', 'onInvalid', 'onReset',
  // ARIA and data attributes
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid', 'aria-required',
  'role', 'data-*',
  // Standard HTML attributes
  'className', 'class', 'style', 'title', 'lang', 'dir', 'accessKey', 'contentEditable',
  'contextMenu', 'draggable', 'hidden', 'spellCheck', 'translate',
]);

/**
 * Filters props using a whitelist approach - only includes known valid HTML attributes
 */
export function filterValidProps(
  props: Record<string, any>,
  elementType: 'input' | 'button' | 'select' = 'input'
): Record<string, any> {
  const whitelist = elementType === 'button' 
    ? VALID_BUTTON_ATTRS 
    : elementType === 'select'
    ? VALID_SELECT_ATTRS
    : VALID_INPUT_ATTRS;
  
  const clean: Record<string, any> = {};
  
  for (const key in props) {
    if (!props.hasOwnProperty(key)) continue;
    if (key === 'children') continue; // Handle children separately
    
    // Check if key is in whitelist (or starts with 'data-' or 'aria-')
    // Also allow className (React) and class (HTML)
    const isValidKey = 
      whitelist.has(key) ||
      key.startsWith('data-') ||
      key.startsWith('aria-') ||
      key === 'className' ||
      key === 'class' ||
      key === 'style'; // style is a special object but React handles it
    
    if (!isValidKey) continue;
    
    const value = props[key];
    
    // Skip null/undefined (but allow them if explicitly set)
    if (value === null || value === undefined) {
      clean[key] = value;
      continue;
    }
    
    // Special handling for style (React accepts style objects)
    if (key === 'style' && typeof value === 'object' && !Array.isArray(value) && !value.$$typeof) {
      // Only allow plain style objects, not React elements
      if (!React.isValidElement(value)) {
        clean[key] = value;
      }
      continue;
    }
    
    // NEVER allow objects (including React elements, arrays, plain objects)
    // EXCEPT style which is handled above
    if (typeof value === 'object') {
      // Double-check: if it's a React element, definitely skip
      if (value.$$typeof || React.isValidElement(value)) {
        continue; // Skip React elements
      }
      // Skip all other objects (arrays, plain objects, etc.)
      continue;
    }
    
    // Only allow primitives and functions
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'function'
    ) {
      clean[key] = value;
    }
  }
  
  return clean;
}
