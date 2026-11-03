/** Verify native appearance activation and render-time inertness. */
import { StrictMode, useState } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle.jsx';

/** Exercise the controlled component with actual state transitions. */
function Harness() {
  const [theme, setTheme] = useState('light');
  return (
    <div data-theme={theme}>
      <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} />
    </div>
  );
}

it.each(['click', '{Enter}', ' '])('switches both directions on %s activation', async (activation) => {
  render(<Harness />);
  const actor = userEvent.setup();
  for (const destination of ['Dark', 'Light']) {
    const button = screen.getByRole('button', { name: `Switch to ${destination} appearance` });
    expect(button).toHaveTextContent(`${destination} appearance`);
    expect(button).toHaveAttribute('type', 'button');
    if (activation === 'click') await actor.click(button);
    else {
      button.focus();
      await actor.keyboard(activation);
    }
    expect(button.closest('[data-theme]')).toHaveAttribute('data-theme', destination.toLowerCase());
  }
});

it('never activates on strict mount or prop rerender', () => {
  const onToggle = vi.fn();
  const { rerender } = render(<StrictMode><ThemeToggle theme="light" onToggle={onToggle} /></StrictMode>);
  expect(onToggle).not.toHaveBeenCalled();
  rerender(<StrictMode><ThemeToggle theme="dark" onToggle={onToggle} /></StrictMode>);
  expect(screen.getByRole('button', { name: 'Switch to Light appearance' })).toBeInTheDocument();
  expect(onToggle).not.toHaveBeenCalled();
});
