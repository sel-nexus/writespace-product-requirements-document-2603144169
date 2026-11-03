/** Verify the full route matrix with actual App composition and storage. */
import { it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import App from '../App.jsx';
import { session, post, renderRoute } from '../test/fixtures.js';
import { setSession, savePosts, STORAGE_KEYS } from '../utils/storage.js';

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
        : !role ? '/login' : (restricted && !admin) || path === '/edit/example' ? '/blogs' : path;
      expect(screen.getByLabelText('Current route').textContent).toBe(expected);
      if (expected === '/login') expect(screen.getByLabelText('Password')).toBeInTheDocument();
      if (expected === '/register') expect(screen.getByLabelText('Display name')).toBeInTheDocument();
      if (role) expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session)).role).toBe(role);
      else expect(localStorage.length).toBe(0);
    });
  }
}
const ownedPost = { ...post, title: 'Owned route fixture' };
const foreignPost = {
  ...post,
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Foreign route fixture',
  authorId: '22222222-2222-4222-8222-222222222222',
  authorName: 'Another Writer',
};

for (const role of [null, 'user', 'admin', 'Admin']) {
  for (const record of [ownedPost, foreignPost]) {
    it(`routes ${role || 'guest'} editing ${record.title} without changing persisted records`, () => {
      const identity = role ? { ...session, role } : null;
      if (identity) setSession(identity);
      savePosts([ownedPost, foreignPost]);
      const postsBefore = localStorage.getItem(STORAGE_KEYS.posts);
      const path = `/edit/${record.id}`;
      renderRoute(
        <>
          <App />
          <Location />
        </>,
        path,
      );
      const allowed = Boolean(role && (record === ownedPost || role === 'admin' || role === 'Admin'));
      const expected = !role ? '/login' : allowed ? path : '/blogs';
      expect(screen.getByLabelText('Current route').textContent).toBe(expected);
      if (allowed) {
        expect(screen.getByRole('form', { name: 'Edit post', exact: true })).toBeInTheDocument();
        expect(screen.getByLabelText('Title')).toHaveValue(record.title);
        expect(screen.getByLabelText('Content')).toHaveValue(record.content);
      } else {
        expect(screen.queryByRole('form', { name: 'Edit post', exact: true })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
        if (!role) expect(screen.getByLabelText('Password')).toBeInTheDocument();
        else expect(screen.getByRole('heading', { name: 'All Blogs', exact: true })).toBeInTheDocument();
      }
      expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(postsBefore);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session))).toEqual(identity);
      expect(localStorage.getItem(STORAGE_KEYS.users)).toBeNull();
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
  expect(screen.getByLabelText('Current route').textContent).toBe('/login');
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
  expect(screen.getByLabelText('Current route').textContent).toBe('/login');
  expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable');
  spy.mockRestore();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session))).toEqual(session);
});
