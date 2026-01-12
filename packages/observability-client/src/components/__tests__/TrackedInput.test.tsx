import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackedInput } from '../TrackedInput';
import { trackUIEvent } from '../../tracking/ui-events';

jest.mock('../../tracking/ui-events');

describe('TrackedInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).location;
    window.location = { pathname: '/test-page' } as any;
  });

  it('should render input with props', () => {
    render(<TrackedInput inputName="email" placeholder="Enter email" />);

    const input = screen.getByPlaceholderText('Enter email');
    expect(input).toBeInTheDocument();
  });

  it('should track change event by default', async () => {
    const user = userEvent.setup();
    render(<TrackedInput inputName="username" />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    // Should track on change (not every keystroke in default config)
    expect(trackUIEvent).toHaveBeenCalled();
    expect(trackUIEvent).toHaveBeenCalledWith('change', 'input', expect.objectContaining({
      elementName: 'username',
      pagePath: '/test-page',
    }));
  });

  it('should sanitize input value by default', async () => {
    const user = userEvent.setup();
    render(<TrackedInput inputName="password" type="password" />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'secret123');

    fireEvent.change(input, { target: { value: 'secret123' } });

    expect(trackUIEvent).toHaveBeenCalledWith('change', 'input', expect.objectContaining({
      eventValue: '[REDACTED]',
    }));
  });

  it('should not sanitize when sanitize=false', async () => {
    render(<TrackedInput inputName="search" sanitize={false} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test query' } });

    expect(trackUIEvent).toHaveBeenCalledWith('change', 'input', expect.objectContaining({
      eventValue: 'test query',
    }));
  });

  it('should track focus event when enabled', () => {
    render(<TrackedInput inputName="email" trackOnFocus={true} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(trackUIEvent).toHaveBeenCalledWith('focus', 'input', expect.objectContaining({
      elementName: 'email',
    }));
  });

  it('should track blur event when enabled', () => {
    render(<TrackedInput inputName="email" trackOnBlur={true} />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(trackUIEvent).toHaveBeenCalledWith('blur', 'input', expect.objectContaining({
      elementName: 'email',
    }));
  });

  it('should not track when track=false', async () => {
    const user = userEvent.setup();
    render(<TrackedInput inputName="ignored" track={false} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    expect(trackUIEvent).not.toHaveBeenCalled();
  });

  it('should call original onChange handler', () => {
    const handleChange = jest.fn();
    render(<TrackedInput inputName="test" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('should include trackContext', () => {
    render(<TrackedInput inputName="username" trackContext="login_form" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user' } });

    expect(trackUIEvent).toHaveBeenCalledWith('change', 'input', expect.objectContaining({
      pageContext: 'login_form',
    }));
  });

  it('should forward standard input props', () => {
    render(
      <TrackedInput
        inputName="test"
        id="my-input"
        className="form-control"
        disabled
        type="email"
        required
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'my-input');
    expect(input).toHaveClass('form-control');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
  });
});
