/** Verify explicit role navigation, disclosures and guarded logout persistence. */
import { it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import App from '../App.jsx';
import { session, user, post, renderRoute } from '../test/fixtures.js';
import { getSession, setSession, saveUsers, savePosts, STORAGE_KEYS } from '../utils/storage.js';

/** Observe routes while testing the real navigation controls. */
function Location() {
  return (
    <output aria-label="Current route">
      {useLocation().pathname}
    </output>
  );
}

/** Mount navbar with synthetic persisted identity and an observable callback. */
function mount(role = 'user') {
  const identity = { ...session, role };
  setSession(identity);
  const onSession = vi.fn();
  renderRoute(
    <>
      <Navbar session={identity} onSession={onSession} />
      <Location />
    </>,
    '/blogs',
  );
  return onSession;
}

/** Explicitly open the account disclosure and activate logout. */
async function logout(actor) {
  await actor.click(screen.getByRole('button', { name: 'Account for Mina Chen' }));
  await actor.click(screen.getByRole('button', { name: 'Logout' }));
}

it.each(['user', 'admin', 'Admin'])('renders only sourced links for %s and activates them on click', async (role) => {
  const onSession = mount(role);
  const actor = userEvent.setup();
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  const nav = screen.getByRole('navigation', { hidden: true });
  expect(nav).toHaveClass('hidden');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(getSession().value.role).toBe(role);
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  await actor.click(toggle);
  expect(nav).toHaveClass('flex');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(within(nav).getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
  if (role === 'user') expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  else expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  await actor.click(within(nav).getByRole('link', { name: role === 'user' ? 'Write' : 'Users' }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'user' ? '/write' : '/users');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(onSession).not.toHaveBeenCalled();
});
it('toggles mobile and account controls closed, including native keyboard activation', async () => {
  mount();
  const actor = userEvent.setup();
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  await actor.click(toggle);
  await actor.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const account = screen.getByRole('button', { name: 'Account for Mina Chen' });
  account.focus();
  await actor.keyboard('{Enter}');
  expect(account).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  await actor.keyboard('{Enter}');
  expect(account).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  await actor.click(screen.getByRole('link', { name: 'WriteSpace' }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
});
it('clears only session and refreshes actual App to guest on explicit logout', async () => {
  setSession(session);
  saveUsers([user]);
  savePosts([post]);
  renderRoute(
    <>
      <App />
      <Location />
    </>,
    '/blogs',
  );
  const actor = userEvent.setup();
  expect(screen.getByRole('button', { name: 'Account for Mina Chen', exact: true })).toBeInTheDocument();
  expect(screen.getByLabelText('Current route').textContent).toBe('/blogs');
  expect(getSession().value).toEqual(session);
  await logout(actor);
  expect(getSession().value).toBeNull();
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(JSON.stringify([user]));
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  expect(within(screen.getByRole('main')).queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Account for Mina Chen', exact: true })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Current route').textContent).toBe('/');
  expect(screen.getByRole('heading', { name: 'WriteSpace', exact: true })).toBeInTheDocument();
  expect(within(screen.getByRole('navigation', { name: 'Footer navigation' })).getByRole('link', { name: 'Login', exact: true })).toBeInTheDocument();
});
it('completes logout when latest successful read reports an already missing session', async () => {
  const onSession = mount();
  localStorage.removeItem(STORAGE_KEYS.session);
  await logout(userEvent.setup());
  expect(onSession).toHaveBeenCalledWith(null);
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/');
});
it('preserves session and route on removal failure, then allows manual retry', async () => {
  const onSession = mount();
  const actor = userEvent.setup();
  const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  await logout(actor);
  expect(screen.getByRole('alert')).toHaveTextContent('Logout did not complete');
  expect(getSession().value).toEqual(session);
  expect(onSession).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  spy.mockRestore();
  await actor.click(screen.getByRole('button', { name: 'Logout' }));
  expect(getSession().value).toBeNull();
  expect(onSession).toHaveBeenCalledWith(null);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it.each(['invalid_data', 'storage_unavailable'])('gates removal on latest %s read and never signals success', async (error) => {
  const onSession = mount();
  const raw = error === 'invalid_data' ? '{later corruption' : JSON.stringify(session);
  localStorage.setItem(STORAGE_KEYS.session, raw);
  const spy = error === 'storage_unavailable'
    ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }) : null;
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  await logout(userEvent.setup());
  expect(screen.getByRole('alert')).toHaveTextContent(error === 'invalid_data' ? 'Local data could not be read' : 'Local storage is unavailable');
  expect(remove).not.toHaveBeenCalled();
  expect(onSession).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  spy?.mockRestore();
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(raw);
});


it('exposes appearance outside the mobile disclosure and activates only on input', async () => {
  const onToggle = vi.fn();
  const { rerender } = renderRoute(
    <Navbar session={session} onSession={vi.fn()} theme="light" onToggle={onToggle} />,
    '/blogs',
  );
  const actor = userEvent.setup();
  const button = screen.getByRole('button', { name: 'Switch to Dark appearance' });
  expect(button.closest('nav')).toBeNull();
  expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(onToggle).not.toHaveBeenCalled();
  await actor.click(button);
  expect(onToggle).toHaveBeenCalledTimes(1);
  rerender(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar session={session} onSession={vi.fn()} theme="dark" onToggle={onToggle} />
    </MemoryRouter>,
  );
  expect(onToggle).toHaveBeenCalledTimes(1);
  const reverse = screen.getByRole('button', { name: 'Switch to Light appearance' });
  reverse.focus();
  await actor.keyboard('{Enter}');
  expect(onToggle).toHaveBeenCalledTimes(2);
  await actor.keyboard(' ');
  expect(onToggle).toHaveBeenCalledTimes(3);
});
