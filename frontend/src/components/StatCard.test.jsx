/** Verify sourced statistic values and visible ambiguity without presentation side effects. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard.jsx';

describe('StatCard', () => {
  it.each([0, 12])('renders the exact label and count %s without a fabricated note', (value) => {
    const { container } = render(
      <StatCard label="Total Posts" value={value} />
    );
    expect(container.querySelector('dt')).toHaveTextContent('Total Posts');
    expect(container.querySelector('dd')).toHaveTextContent(String(value));
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('a, button')).toBeNull();
  });

  it.each(['indigo', 'violet', 'pink', 'teal'])('supports the supplied %s accent', (accent) => {
    const { container } = render(
      <StatCard label="Total users" value="?" accent={accent} note="Fourth measure unresolved." />
    );
    expect(screen.getByText('Total users', { exact: true })).toBeVisible();
    expect(container.querySelector('dd')).toHaveTextContent('?');
    expect(screen.getByText('Fourth measure unresolved.')).toBeVisible();
    expect(container.firstChild.className).toContain('border-t-');
    expect(container.querySelector('[title]')).toBeNull();
  });
});
