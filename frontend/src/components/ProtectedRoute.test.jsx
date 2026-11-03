/** Verify the full route matrix with actual App composition and storage. */
import { it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { session, renderRoute } from '../test/fixtures.js';
import { setSession, STORAGE_KEYS } from '../utils/storage.js';

/** Expose router outcomes without creating application page stubs. */
function Location() {
  return (
    <output aria-label="Current route">
      {useLocation().pathname}
    </output>
  );
}

for (const role of [null, 'user', 'admin', 'Admin']) {
  for (const path of ['/', '/login', '/register', '/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users']) {
    it(`routes ${role || 'guest'} at ${path} according to the access matrix`, () => {
      if (role) setSession({ ...session, role });
      renderRoute(
        <>
          <App />
          <Location />
        </>,
        path,
      );
      const admin = role === 'admin' || role === 'Admin';
      const entry = path === '/login' || path === '/register';
      const restricted = path === '/admin' || path === '/users';
      const expected = path === '/' ? '/' : entry
        ? (role ? (admin ? '/admin' : '/blogs') : path)
        : !role ? '/login' : restricted && !admin ? '/blogs' : path;
      expect(screen.getByLabelText('Current route')).toHaveTextContent(expected);
      if (expected === '/login') expect(screen.getByLabelText('Password')).toBeInTheDocument();
      if (expected === '/register') expect(screen.getByLabelText('Display name')).toBeInTheDocument();
      if (role) expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session)).role).toBe(role);
      else expect(localStorage.length).toBe(0);
    });
  }
}
it('treats malformed persisted session as guest without repairing bytes', () => {
  localStorage.setItem(STORAGE_KEYS.session, '{bad');
  renderRoute(
    <>
      <App />
      <Location />
    </>,
    '/admin',
  );
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('{bad');
  expect(screen.getByRole('alert')).toHaveTextContent('Local data could not be read');
});

it('fails closed with a visible warning on blocked shell session reads', () => {
  setSession(session);
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  renderRoute(
    <>
      <App />
      <Location />
    </>,
    '/users',
  );
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable');
  spy.mockRestore();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session))).toEqual(session);
});
