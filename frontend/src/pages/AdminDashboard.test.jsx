/** Exercise real guarded local storage, admin activation and late prerequisite failures. */
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminDashboard from './AdminDashboard.jsx';
import App from '../App.jsx';
import { post, user, session, TIME, renderRoute } from '../test/fixtures.js';
import { STORAGE_KEYS as keys } from '../utils/storage.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

/** Seed complete records before render without mocking application readers or mutations.
 * @param {object[]} posts Complete post collection.
 * @param {object[]} users Complete account collection.
 * @returns {void}
 */
function seed(posts = [post], users = [user]) {
  localStorage.setItem(keys.posts, JSON.stringify(posts));
  localStorage.setItem(keys.users, JSON.stringify(users));
  localStorage.setItem(keys.session, JSON.stringify(admin));
}

/** Render the dashboard and observable destinations in the existing router fixture.
 * @param {object|null} identity Shell session supplied to the page.
 * @returns {object} Testing Library render controls.
 */
function show(identity = admin) {
  return renderRoute(
    <Routes>
      <Route
        path="/admin"
        element={<AdminDashboard session={identity} />}
      />
      <Route
        path="/write"
        element={
          <h1>
            Write destination
          </h1>
        }
      />
      <Route
        path="/users"
        element={
          <h1>
            Users destination
          </h1>
        }
      />
      <Route
        path="/edit/:id"
        element={
          <h1>
            Edit destination
          </h1>
        }
      />
    </Routes>,
    '/admin',
  );
}

/** Read one exact source label's displayed count, preserving the duplicate casing.
 * @param {string} label Source statistic label.
 * @returns {string} Rendered statistic value.
 */
function count(label) {
  return screen.getByText(label, { exact: true }).closest('dl').querySelector('dd').textContent;
}

/** Assert every mutation path is disabled, including both navigation quick actions.
 * @returns {void}
 */
function expectReadOnly() {
  expect(screen.queryByRole('link', { name: 'Edit', exact: true })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Write New Post' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Manage Users' })).toBeNull();
  for (const control of screen.getAllByRole('button')) expect(control).toBeDisabled();
}

describe('AdminDashboard', () => {
  it('counts all successful arrays, preserves role spellings and includes bootstrap exactly once', () => {
    const users = [
      user,
      { ...user, id: '11111111-1111-4111-8111-111111111111', username: 'lower', role: 'admin' },
      { ...user, id: '22222222-2222-4222-8222-222222222222', username: 'upper', role: 'Admin' },
      { ...user, id: '33333333-3333-4333-8333-333333333333', username: 'other', role: 'ADMIN' },
      { ...user, id: 'admin', username: 'bootstrap', role: 'Admin' },
      { ...user, id: '44444444-4444-4444-8444-444444444444', username: ' ADMIN ', role: 'admin' },
    ];
    seed([post], users);
    const bytes = localStorage.getItem(keys.users);
    show();
    expect(count('Total Posts')).toBe('1');
    expect(count('Total Users')).toBe('5');
    expect(count('Total Admins')).toBe('3');
    expect(count('Total users')).toBe('?');
    expect(screen.getByText(/Source ambiguity:/)).toBeVisible();
    expect(screen.getByText(/include the bootstrap admin once/)).toBeVisible();
    expect(localStorage.getItem(keys.users)).toBe(bytes);
  });

  it('treats missing keys as successful empty arrays without seeding stored bootstrap data', () => {
    localStorage.setItem(keys.session, JSON.stringify(admin));
    show();
    expect(count('Total Posts')).toBe('0');
    expect(count('Total Users')).toBe('1');
    expect(count('Total Admins')).toBe('1');
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Write New Post' })).toBeVisible();
    expect(localStorage.getItem(keys.users)).toBeNull();
    expect(localStorage.getItem(keys.posts)).toBeNull();
  });

  it('sorts five newest posts stably by creation time, not updatedAt, without writes on render or focus', () => {
    const dates = ['01', '05', '03', '05', '04', '02', '06'];
    const posts = dates.map((day, index) => ({
      ...post, id: `00000000-0000-4000-8000-00000000000${index}`,
      title: `Post ${index}`, createdAt: `2026-01-${day}T09:00:00.000Z`, updatedAt: TIME,
    }));
    seed(posts);
    const bytes = localStorage.getItem(keys.posts);
    const confirm = vi.spyOn(window, 'confirm');
    show();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Post 6', 'Post 1', 'Post 3', 'Post 4', 'Post 2',
    ]);
    expect(count('Total Posts')).toBe('7');
    const edits = screen.getAllByRole('link', { name: 'Edit', exact: true });
    expect(edits).toHaveLength(5);
    expect(edits[0]).toHaveAttribute('href', `/edit/${posts[6].id}`);
    edits[0].focus();
    fireEvent.mouseOver(edits[0]);
    screen.getAllByRole('button', { name: 'Delete', exact: true })[0].focus();
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem(keys.posts)).toBe(bytes);
    expect(screen.queryByText('Edit destination')).toBeNull();
  });

  it.each([
    ['Write New Post', 'Write destination'], ['Manage Users', 'Users destination'], ['Edit', 'Edit destination'],
  ])('navigates %s only on activation', async (name, destination) => {
    seed();
    show();
    expect(screen.queryByText(destination)).toBeNull();
    await userEvent.click(screen.getByRole('link', { name, exact: true }));
    expect(screen.getByRole('heading', { name: destination })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(keys.posts))).toEqual([post]);
  });

  it('canceled deletion preserves posts and users exactly', async () => {
    seed();
    const bytes = localStorage.getItem(keys.posts);
    const users = localStorage.getItem(keys.users);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(localStorage.getItem(keys.posts)).toBe(bytes);
    expect(localStorage.getItem(keys.users)).toBe(users);
    expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it.each(['admin', 'Admin'])('confirmed %s deletion uses latest posts and refreshes counts after persistence', async (role) => {
    seed();
    localStorage.setItem(keys.session, JSON.stringify({ ...admin, role }));
    show({ ...admin, role });
    const added = { ...post, id: '55555555-5555-4555-8555-555555555555', title: 'Concurrent post' };
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      localStorage.setItem(keys.posts, JSON.stringify([post, added]));
      return true;
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(JSON.parse(localStorage.getItem(keys.posts))).toEqual([added]);
    expect(count('Total Posts')).toBe('1');
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
    expect(screen.queryByRole('heading', { name: post.title })).toBeNull();
  });

  it.each([keys.posts, keys.users])('invalid %s disables all mutations and preserves malformed bytes', async (key) => {
    seed();
    localStorage.setItem(key, '{broken');
    const posts = localStorage.getItem(keys.posts);
    const users = localStorage.getItem(keys.users);
    show();
    expectReadOnly();
    expect(screen.getByRole('alert')).toHaveTextContent('invalid');
    expect(count(key === keys.posts ? 'Total Posts' : 'Total Users')).toBe('?');
    await userEvent.click(screen.getByRole('button', { name: 'Write New Post' }));
    expect(localStorage.getItem(keys.posts)).toBe(posts);
    expect(localStorage.getItem(keys.users)).toBe(users);
  });

  it.each([keys.posts, keys.users])('incomplete %s records fail closed rather than contributing partial counts', (key) => {
    seed();
    const bytes = JSON.stringify(key === keys.posts ? [{ title: 'Incomplete' }] : [{ username: 'Incomplete' }]);
    localStorage.setItem(key, bytes);
    show();
    expectReadOnly();
    expect(localStorage.getItem(key)).toBe(bytes);
    expect(screen.getByRole('alert')).toHaveTextContent('invalid');
  });

  it.each([keys.posts, keys.users])('unavailable %s read preserves both collections and disables mutations', (key) => {
    seed();
    const read = Storage.prototype.getItem;
    const posts = localStorage.getItem(keys.posts);
    const users = localStorage.getItem(keys.users);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(name) {
      if (name === key) throw new Error('denied');
      return read.call(this, name);
    });
    show();
    expectReadOnly();
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
    expect(read.call(localStorage, keys.posts)).toBe(posts);
    expect(read.call(localStorage, keys.users)).toBe(users);
  });

  it.each([null, session])('non-admin presentation never exposes mutation links', (identity) => {
    seed();
    show(identity);
    expectReadOnly();
  });

  it.each(['Edit', 'Write New Post', 'Manage Users'])('late user corruption blocks activated %s navigation', async (name) => {
    seed();
    show();
    localStorage.setItem(keys.users, '{late');
    await userEvent.click(screen.getByRole('link', { name, exact: true }));
    expect(screen.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    expectReadOnly();
    expect(localStorage.getItem(keys.users)).toBe('{late');
    expect(JSON.parse(localStorage.getItem(keys.posts))).toEqual([post]);
  });

  it.each(['missing', 'ordinary', 'corrupt', 'unavailable'])('late %s session blocks deletion without confirmation or writes', async (change) => {
    seed();
    show();
    const bytes = localStorage.getItem(keys.posts);
    const confirm = vi.spyOn(window, 'confirm');
    if (change === 'missing') localStorage.removeItem(keys.session);
    if (change === 'ordinary') localStorage.setItem(keys.session, JSON.stringify(session));
    if (change === 'corrupt') localStorage.setItem(keys.session, '{broken');
    if (change === 'unavailable') {
      const read = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(name) {
        if (name === keys.session) throw new Error('denied');
        return read.call(this, name);
      });
    }
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(confirm).not.toHaveBeenCalled();
    expect(localStorage.getItem(keys.posts)).toBe(bytes);
    expectReadOnly();
    expect(screen.getAllByRole('alert').some((alert) => /permission|could not be read/.test(alert.textContent))).toBe(true);
  });

  it.each([keys.users, keys.posts, keys.session])('changes to %s during confirmation prevent deletion', async (key) => {
    seed();
    show();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      localStorage.setItem(key, '{changed');
      return true;
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(localStorage.getItem(key)).toBe('{changed');
    if (key !== keys.posts) expect(JSON.parse(localStorage.getItem(keys.posts))).toEqual([post]);
    expectReadOnly();
  });

  it('post removed during confirmation reports not-found without a false success', async () => {
    seed();
    show();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      localStorage.setItem(keys.posts, '[]');
      return true;
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
    expect(screen.getByRole('status')).not.toHaveTextContent('Post deleted.');
    expect(localStorage.getItem(keys.posts)).toBe('[]');
  });

  it('write failure keeps the post and bytes, reports failure and permits an explicit retry', async () => {
    seed();
    const bytes = localStorage.getItem(keys.posts);
    show();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Post could not be deleted');
    expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
    expect(localStorage.getItem(keys.posts)).toBe(bytes);
    expect(screen.getByRole('status')).not.toHaveTextContent('Post deleted.');
    write.mockRestore();
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(localStorage.getItem(keys.posts)).toBe('[]');
    expect(count('Total Posts')).toBe('0');
  });

  it.each(['read_failed', 'permission_denied'])('helper catches a %s session change after confirmation checks', async (failure) => {
    seed();
    show();
    const bytes = localStorage.getItem(keys.posts);
    const read = Storage.prototype.getItem;
    let sessionReads = 0;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(name) {
      if (name === keys.session && ++sessionReads === 3) {
        return failure === 'read_failed' ? '{broken' : JSON.stringify({
          ...session, userId: '99999999-9999-4999-8999-999999999999',
        });
      }
      return read.call(this, name);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete', exact: true }));
    expect(localStorage.getItem(keys.posts)).toBe(bytes);
    expectReadOnly();
    expect(screen.getByRole('alert')).toHaveTextContent(failure === 'read_failed' ? 'could not be read' : 'permission');
  });

  it('refreshes reads and disables mutations when the supplied shell session changes', () => {
    seed();
    const view = renderRoute(
      <AdminDashboard session={admin} />,
      '/admin',
    );
    localStorage.setItem(keys.users, '{changed');
    view.rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminDashboard session={session} />
      </MemoryRouter>,
    );
    expectReadOnly();
    expect(count('Total Users')).toBe('?');
    expect(localStorage.getItem(keys.users)).toBe('{changed');
  });

  it.each(['guest', 'ordinary', 'admin', 'Admin'])('App deep-entry applies the %s route boundary', async (role) => {
    seed();
    if (role === 'guest') localStorage.removeItem(keys.session);
    else localStorage.setItem(keys.session, JSON.stringify(role === 'ordinary' ? session : { ...admin, role }));
    renderRoute(
      <App />,
      '/admin',
    );
    if (role === 'guest') expect(await screen.findByRole('heading', { name: /Welcome back/i })).toBeVisible();
    else if (role === 'ordinary') expect(await screen.findByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    else expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });
});
