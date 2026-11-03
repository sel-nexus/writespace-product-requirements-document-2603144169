/** Verify transient appearance integration with real routes and local records. */
import { StrictMode } from 'react';
import { it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { renderRoute, session, user, post } from './test/fixtures.js';

/** Snapshot every local key without interpreting or changing record bytes. */
function records() {
  return Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]));
}

it.each([['guest', '/'], ['user', '/blogs'], ['admin', '/admin']])(
  'switches both appearances in the %s shell without changing local data', async (role, route) => {
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
    localStorage.setItem('writespace_users', JSON.stringify([user]));
    localStorage.setItem('unrelated', 'preserve');
    if (role !== 'guest') localStorage.setItem('writespace_session', JSON.stringify({ ...session, role }));
    const before = records();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const removes = vi.spyOn(Storage.prototype, 'removeItem');
    const clears = vi.spyOn(Storage.prototype, 'clear');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { rerender } = renderRoute(<StrictMode><App /></StrictMode>, route);
    const actor = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Switch to Dark appearance' });
    const root = button.closest('[data-theme]');
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(screen.getAllByText(post.title).length).toBeGreaterThan(0);
    await actor.click(button);
    expect(root).toHaveAttribute('data-theme', 'dark');
    rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StrictMode><App /></StrictMode>
      </MemoryRouter>,
    );
    expect(root).toHaveAttribute('data-theme', 'dark');
    await actor.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    const nav = screen.getByRole('navigation', { name: role === 'guest' ? 'Public navigation' : 'Main navigation' });
    await actor.click(within(nav).getByRole('link', { name: role === 'guest' ? 'Login' : 'Write', exact: true }));
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(root).toHaveAttribute('data-theme', 'dark');
    const input = screen.getAllByRole('textbox')[0];
    await actor.type(input, 'Unsaved text');
    const reverse = screen.getByRole('button', { name: 'Switch to Light appearance' });
    reverse.focus();
    await actor.keyboard(' ');
    expect(root).toHaveAttribute('data-theme', 'light');
    rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StrictMode><App /></StrictMode>
      </MemoryRouter>,
    );
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(input).toHaveValue('Unsaved text');
    expect(records()).toEqual(before);
    expect(writes).not.toHaveBeenCalled();
    expect(removes).not.toHaveBeenCalled();
    expect(clears).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each(['/login', '/register', '/unknown', '/blogs'])('exposes an inert light toggle on guest entry %s', (route) => {
  renderRoute(<App />, route);
  const button = screen.getByRole('button', { name: 'Switch to Dark appearance' });
  expect(button.closest('header')).toBeInTheDocument();
  expect(button.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  expect(screen.queryByRole('button', { name: 'Switch to Light appearance' })).not.toBeInTheDocument();
});

it('does not consult appearance preferences or OS state', async () => {
  localStorage.setItem('theme', 'dark');
  const reads = vi.spyOn(Storage.prototype, 'getItem');
  const media = vi.fn();
  vi.stubGlobal('matchMedia', media);
  renderRoute(<App />, '/login');
  const actor = userEvent.setup();
  const button = screen.getByRole('button', { name: 'Switch to Dark appearance' });
  button.focus();
  await actor.keyboard('{Enter}');
  expect(button.closest('[data-theme]')).toHaveAttribute('data-theme', 'dark');
  await actor.keyboard('{Enter}');
  expect(button.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  expect(reads.mock.calls.every(([key]) => key.startsWith('writespace_'))).toBe(true);
  expect(media).not.toHaveBeenCalled();
  expect(localStorage.getItem('theme')).toBe('dark');
});

it('switches both directions even when storage reads and writes are blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const removes = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  const clears = vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => { throw new Error('blocked'); });
  renderRoute(<App />, '/login');
  const actor = userEvent.setup();
  const button = screen.getByRole('button', { name: 'Switch to Dark appearance' });
  await actor.click(button);
  expect(button.closest('[data-theme]')).toHaveAttribute('data-theme', 'dark');
  await actor.click(screen.getByRole('button', { name: 'Switch to Light appearance' }));
  expect(button.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(writes).not.toHaveBeenCalled();
  expect(removes).not.toHaveBeenCalled();
  expect(clears).not.toHaveBeenCalled();
});
