/** Verify list states, real storage integrity and actual App reading route wiring. */
import { expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home.jsx';
import App from '../App.jsx';
import { post, session, renderRoute } from '../test/fixtures.js';
import { STORAGE_KEYS } from '../utils/storage.js';

it('reads all posts, sorts ties stably, cycles sorted accents and preserves stored bytes', () => {
  const posts = [
    post,
    { ...post, id: '11111111-1111-4111-8111-111111111111', title: 'New first', createdAt: '2026-02-01T00:00:00.000Z' },
    { ...post, id: '22222222-2222-4222-8222-222222222222', title: 'New second', createdAt: '2026-02-01T00:00:00.000Z' },
    { ...post, id: '33333333-3333-4333-8333-333333333333', title: 'Fourth', createdAt: '2025-01-01T00:00:00.000Z' },
    { ...post, id: '44444444-4444-4444-8444-444444444444', title: 'Fifth', createdAt: '2024-01-01T00:00:00.000Z' },
  ];
  const bytes = JSON.stringify(posts);
  localStorage.setItem(STORAGE_KEYS.posts, bytes);
  renderRoute(
    <Home session={session} />,
  );
  expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent.trim()))
    .toEqual(['New first', 'New second', post.title, 'Fourth', 'Fifth']);
  expect(screen.getByRole('region', { name: 'Blog posts' })).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  const articles = screen.getAllByRole('article');
  ['border-t-primary-600', 'border-t-secondary-600', 'border-t-accent-pink', 'border-t-accent-teal', 'border-t-primary-600']
    .forEach((accent, index) => expect(articles[index]).toHaveClass(accent));
  expect(screen.getAllByRole('link', { name: 'Edit', exact: true })).toHaveLength(5);
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
});

it.each(['user', 'admin', 'Admin'])('renders exact empty copy and Write link for %s without saving fallback', (role) => {
  renderRoute(
    <Home session={{ ...session, role }} />,
  );
  expect(screen.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('href', '/write');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBeNull();
});

it.each([
  '{broken', '{}', 'null', JSON.stringify([{ ...post, content: '' }]),
  JSON.stringify([post, { ...post, createdAt: '2026-01-10' }]),
])('uses safe empty state and preserves corrupt bytes %s', (bytes) => {
  localStorage.setItem(STORAGE_KEYS.posts, bytes);
  renderRoute(
    <Home session={session} />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged; changes are disabled.');
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
});

it('handles unavailable reads without overwriting the collection', () => {
  const bytes = JSON.stringify([post]);
  localStorage.setItem(STORAGE_KEYS.posts, bytes);
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  renderRoute(
    <Home session={session} />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable.');
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  read.mockRestore();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
});

it('uses supplied posts and refreshes presentation when props change', () => {
  localStorage.setItem(STORAGE_KEYS.posts, '{broken');
  const { rerender } = renderRoute(
    <Home session={session} posts={[post]} />,
  );
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  rerender(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Home session={session} posts={[]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe('{broken');
});

it('reads fresh collection on a new list entry rather than retaining a stale cache', () => {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  const first = renderRoute(
    <Home session={session} />,
  );
  first.unmount();
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([{ ...post, title: 'Latest stored title' }]));
  renderRoute(
    <Home session={session} />,
  );
  expect(screen.getByRole('heading', { name: 'Latest stored title' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: post.title })).not.toBeInTheDocument();
});

it('App routes an actual list click to the full reader and back to the real list', async () => {
  const user = userEvent.setup();
  const content = 'x'.repeat(120) + '\nFull reader ending';
  const bytes = JSON.stringify([{ ...post, content }]);
  localStorage.setItem(STORAGE_KEYS.posts, bytes);
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  renderRoute(
    <App />,
    '/blogs',
  );
  expect(await screen.findByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(screen.queryByText(/Full reader ending/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: new RegExp(post.title) }));
  expect(screen.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
  expect(screen.getByText(/Full reader ending/)).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
});

it.each(['/blogs', `/blog/${post.id}`])('App redirects guest deep entry %s without revealing posts', async (path) => {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  renderRoute(
    <App />,
    path,
  );
  expect(await screen.findByRole('button', { name: 'Login', exact: true })).toBeVisible();
  expect(screen.queryByRole('heading', { name: post.title })).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
});
