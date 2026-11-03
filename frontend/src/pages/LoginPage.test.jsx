/** Exercise login against real local storage and every failure/state transition. */
import { it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import App from '../App.jsx';
import { renderRoute, user, session, post } from '../test/fixtures.js';
import { saveUsers, savePosts, getSession, setSession, STORAGE_KEYS } from '../utils/storage.js';

/** Observe actual router outcomes. */
function Location() {
  return (
    <output aria-label="Current route">
      {useLocation().pathname}
    </output>
  );
}

/** Mount the page with a callback and observable navigation. */
function mount() {
  const onSession = vi.fn();
  renderRoute(
    <>
      <LoginPage onSession={onSession} />
      <Location />
    </>,
    '/login',
  );
  return onSession;
}

/** Fill and submit synthetic credentials through user controls. */
async function login(actor, username = 'Mina', password = 'demo-only') {
  if (username) await actor.type(screen.getByLabelText('Username'), username);
  if (password) await actor.type(screen.getByLabelText('Password'), password);
  await actor.click(screen.getByRole('button', { name: 'Login' }));
}

it.each(['user', 'admin', 'Admin'])('persists registered %s role unchanged and routes on submit only', async (role) => {
  saveUsers([{ ...user, role }]);
  savePosts([post]);
  const onSession = mount();
  const actor = userEvent.setup();
  expect(getSession().value).toBeNull();
  expect(onSession).not.toHaveBeenCalled();
  await login(actor, ' mina ');
  expect(getSession().value).toEqual({ ...session, role });
  expect(onSession).toHaveBeenCalledWith({ ...session, role });
  expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'user' ? '/blogs' : '/admin');
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(JSON.stringify([{ ...user, role }]));
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});
it.each(['missing', 'invalid', 'blocked'])('demo admin succeeds independently of %s users read', async (condition) => {
  if (condition === 'invalid') localStorage.setItem(STORAGE_KEYS.users, '{bad');
  const get = Storage.prototype.getItem;
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (key === STORAGE_KEYS.users && condition === 'blocked') throw new Error('blocked');
    return get.call(this, key);
  });
  const onSession = mount();
  await login(userEvent.setup(), ' admin ', 'admin');
  expect(getSession().value).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
  expect(onSession).toHaveBeenCalled();
  expect(spy.mock.calls.some(([key]) => key === STORAGE_KEYS.users)).toBe(false);
  spy.mockRestore();
  if (condition === 'invalid') expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('{bad');
});
it.each([['', ''], ['', 'demo-only'], ['Mina', ''], ['  ', 'demo-only'], ['Mina', '  ']])
  ('rejects required fields %s/%s with associated errors and no mutation', async (username, password) => {
    const onSession = mount();
    await login(userEvent.setup(), username, password);
    const first = !username.trim() ? 'Username' : 'Password';
    const field = screen.getByLabelText(first);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveTextContent('Required');
    expect(localStorage.length).toBe(0);
    expect(onSession).not.toHaveBeenCalled();
  });
it.each([['unknown', 'demo-only'], ['Mina', 'wrong'], ['admin', 'wrong'], ['Mina', ' demo-only ']])
  ('shows exact invalid text for %s without changing existing session', async (username, password) => {
    saveUsers([user]);
    setSession(session);
    const onSession = mount();
    await login(userEvent.setup(), username, password);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Invalid username or password\.$/);
    expect(getSession().value).toEqual(session);
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
it('clears invalid feedback after correction and retains paste behavior', async () => {
  saveUsers([user]);
  mount();
  const actor = userEvent.setup();
  await login(actor, 'Mina', 'wrong');
  await actor.clear(screen.getByLabelText('Password'));
  await actor.paste('demo-only');
  await actor.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(getSession().value).toEqual(session);
});
for (const key of [STORAGE_KEYS.session, STORAGE_KEYS.users]) {
  for (const condition of ['malformed', 'invalid record', 'blocked']) {
    it(`blocks ordinary login on latest ${condition} ${key} and preserves bytes`, async () => {
      saveUsers([user]);
      const onSession = mount();
      const raw = condition === 'malformed' ? '{later bad' : condition === 'invalid record' ? '{}' : 'original bytes';
      localStorage.setItem(key, raw);
      const get = Storage.prototype.getItem;
      const spy = condition === 'blocked' ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
        if (name === key) throw new Error('blocked');
        return get.call(this, name);
      }) : null;
      const write = vi.spyOn(Storage.prototype, 'setItem');
      await login(userEvent.setup());
      expect(screen.getByRole('alert')).toHaveTextContent(condition === 'blocked' ? 'Local storage is unavailable' : 'Local data could not be read');
      expect(write).not.toHaveBeenCalled();
      expect(onSession).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
      spy?.mockRestore();
      expect(localStorage.getItem(key)).toBe(raw);
    });
  }
}
it.each(['malformed', 'blocked'])('demo cannot overwrite a %s session despite valid credentials', async (condition) => {
  localStorage.setItem(STORAGE_KEYS.session, '{bad');
  const spy = condition === 'blocked' ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }) : null;
  const onSession = mount();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await login(userEvent.setup(), 'admin', 'admin');
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(onSession).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  spy?.mockRestore();
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('{bad');
});
it('reads current account data on submission and supports manual recovery from a read failure', async () => {
  mount();
  const actor = userEvent.setup();
  localStorage.setItem(STORAGE_KEYS.users, '{bad');
  await login(actor);
  expect(screen.getByRole('alert')).toHaveTextContent('Local data could not be read');
  saveUsers([user]);
  await actor.click(screen.getByRole('button', { name: 'Login' }));
  expect(getSession().value).toEqual(session);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('preserves prior session and entered values on write failure and succeeds only after retry', async () => {
  saveUsers([user]);
  setSession({ ...session, displayName: 'Previous identity' });
  const onSession = mount();
  const actor = userEvent.setup();
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await login(actor);
  expect(screen.getByRole('alert')).toHaveTextContent('Your local session could not be saved. You are not signed in.');
  expect(getSession().value.displayName).toBe('Previous identity');
  expect(screen.getByLabelText('Username')).toHaveValue('Mina');
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  expect(onSession).not.toHaveBeenCalled();
  spy.mockRestore();
  await actor.click(screen.getByRole('button', { name: 'Login' }));
  expect(getSession().value).toEqual(session);
  expect(onSession).toHaveBeenCalledWith(session);
});
it('activates root login, registration login link and role home through actual App', async () => {
  renderRoute(<App />, '/');
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('link', { name: 'Login' }));
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  await actor.click(screen.getByRole('link', { name: 'Create account' }));
  expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  await actor.click(screen.getByRole('link', { name: 'Already have an account? Login' }));
  await login(actor, 'admin', 'admin');
  expect(screen.getByRole('status')).toHaveTextContent('Signed in locally as Admin.');
  expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/admin');
});
it('back link leaves login without creating a session', async () => {
  renderRoute(<App />, '/login');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  expect(getSession().value).toBeNull();
});
