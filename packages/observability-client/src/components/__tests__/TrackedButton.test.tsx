import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackedButton } from '../TrackedButton';
import { trackUIEvent } from '../../tracking/ui-events';

jest.mock('../../tracking/ui-events');

describe('TrackedButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).location;
    window.location = { pathname: '/test-page' } as any;
  });

  it('should render button with children', () => {
    render(<TrackedButton>Click me</TrackedButton>);

    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should track click event by default', () => {
    render(<TrackedButton buttonName="test-button">Click me</TrackedButton>);

    fireEvent.click(screen.getByText('Click me'));

    expect(trackUIEvent).toHaveBeenCalledWith('click', 'button', {
      elementName: 'test-button',
      elementId: undefined,
      pagePath: '/test-page',
      pageContext: undefined,
    });
  });

  it('should use children as button name if buttonName not provided', () => {
    render(<TrackedButton>Submit Form</TrackedButton>);

    fireEvent.click(screen.getByText('Submit Form'));

    expect(trackUIEvent).toHaveBeenCalledWith('click', 'button', {
      elementName: 'Submit Form',
      elementId: undefined,
      pagePath: '/test-page',
      pageContext: undefined,
    });
  });

  it('should include trackContext in event', () => {
    render(
      <TrackedButton buttonName="create" trackContext="dashboard">
        Create
      </TrackedButton>
    );

    fireEvent.click(screen.getByText('Create'));

    expect(trackUIEvent).toHaveBeenCalledWith('click', 'button', {
      elementName: 'create',
      elementId: undefined,
      pagePath: '/test-page',
      pageContext: 'dashboard',
    });
  });

  it('should include trackMetadata in event', () => {
    render(
      <TrackedButton
        buttonName="save"
        trackMetadata={{ documentId: 123, action: 'save' }}
      >
        Save
      </TrackedButton>
    );

    fireEvent.click(screen.getByText('Save'));

    expect(trackUIEvent).toHaveBeenCalledWith('click', 'button', {
      elementName: 'save',
      elementId: undefined,
      pagePath: '/test-page',
      pageContext: undefined,
      documentId: 123,
      action: 'save',
    });
  });

  it('should not track when track=false', () => {
    render(
      <TrackedButton track={false} buttonName="no-track">
        Don't Track
      </TrackedButton>
    );

    fireEvent.click(screen.getByText("Don't Track"));

    expect(trackUIEvent).not.toHaveBeenCalled();
  });

  it('should call original onClick handler', () => {
    const handleClick = jest.fn();

    render(
      <TrackedButton buttonName="test" onClick={handleClick}>
        Click me
      </TrackedButton>
    );

    fireEvent.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
  });

  it('should forward standard button props', () => {
    render(
      <TrackedButton
        buttonName="test"
        id="my-button"
        className="btn-primary"
        disabled
        type="submit"
      >
        Button
      </TrackedButton>
    );

    const button = screen.getByText('Button');
    expect(button).toHaveAttribute('id', 'my-button');
    expect(button).toHaveClass('btn-primary');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('should use element ID in tracking data', () => {
    render(
      <TrackedButton id="submit-btn" buttonName="submit">
        Submit
      </TrackedButton>
    );

    fireEvent.click(screen.getByText('Submit'));

    expect(trackUIEvent).toHaveBeenCalledWith('click', 'button', {
      elementName: 'submit',
      elementId: 'submit-btn',
      pagePath: '/test-page',
      pageContext: undefined,
    });
  });

  it('should add data-tracked attribute', () => {
    render(<TrackedButton>Tracked Button</TrackedButton>);

    const button = screen.getByText('Tracked Button');
    expect(button).toHaveAttribute('data-tracked', 'true');
  });

  it('should handle non-string children gracefully', () => {
    render(
      <TrackedButton buttonName="icon-button">
        <span>Icon</span>
        <span>Text</span>
      </TrackedButton>
    );

    expect(screen.getByText('Icon')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(trackUIEvent).toHaveBeenCalledWith('click', 'button', {
      elementName: 'icon-button',
      elementId: undefined,
      pagePath: '/test-page',
      pageContext: undefined,
    });
  });
});
