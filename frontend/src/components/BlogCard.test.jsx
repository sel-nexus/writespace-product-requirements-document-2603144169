/** Verify real semantic card links, source metadata, exact excerpts and permissions. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { BlogCard } from './BlogCard.jsx';
import { post, session, renderRoute } from '../test/fixtures.js';

const timezone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'UTC'; });
afterAll(() => {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
});

it('renders exact metadata with author avatar, not the viewer avatar, without writes', () => {
  const authored = { ...post, authorName: 'Publication Owner', authorRole: 'Admin' };
  const { container } = renderRoute(
    <BlogCard post={authored} session={session} />,
  );
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(screen.getByText(authored.authorName)).toBeVisible();
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveTextContent('👑');
  expect(container.querySelector('time')).toHaveAttribute('dateTime', post.createdAt);
  expect(container.querySelector('time')).toHaveTextContent('Jan 10, 2026');
  expect(container.querySelector('article')).not.toHaveAttribute('tabindex');
  expect(container.querySelector('[onclick]')).toBeNull();
  expect(localStorage.length).toBe(0);
});

it.each([1, 119, 120, 121, 5000])('renders only content.slice(0,120) for length %i', (length) => {
  const content = 'x'.repeat(length);
  const { container } = renderRoute(
    <BlogCard post={{ ...post, content }} />,
  );
  expect(container.querySelector('a p').textContent).toBe(content.slice(0, 120));
  expect(screen.getByRole('img', { name: 'User avatar' })).toHaveTextContent('📚');
});

it('escapes HTML in title and excerpt rather than injecting markup', () => {
  const title = '<img src=x onerror=alert(1)>';
  const content = '<script>alert(1)</script> & <b>plain</b>';
  const { container } = renderRoute(
    <BlogCard post={{ ...post, title, content }} />,
  );
  expect(screen.getByRole('heading')).toHaveTextContent(title);
  expect(container.querySelector('a p').textContent).toBe(content);
  expect(container.querySelector('script, img, b')).toBeNull();
});

it.each([
  [0, 'border-t-primary-600'], [1, 'border-t-secondary-600'],
  [2, 'border-t-accent-pink'], [3, 'border-t-accent-teal'],
  [4, 'border-t-primary-600'], [7, 'border-t-accent-teal'],
])('cycles position %i to %s', (index, accent) => {
  renderRoute(
    <BlogCard post={post} index={index} />,
  );
  expect(screen.getByRole('article')).toHaveClass(accent);
});

it.each([
  ['owner', session, true],
  ['non-owner', { ...session, userId: 'admin' }, false],
  ['admin', { ...session, userId: 'admin', role: 'admin' }, true],
  ['Admin', { ...session, userId: 'admin', role: 'Admin' }, true],
  ['unknown non-owner role', { ...session, userId: 'admin', role: 'ADMIN' }, false],
  ['guest', null, false],
])('exposes Edit only for permitted %s', (_, viewer, allowed) => {
  renderRoute(
    <BlogCard post={post} session={viewer} />,
  );
  if (allowed) expect(screen.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', `/edit/${post.id}`);
  else expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: new RegExp(post.title) })).toHaveAttribute('href', `/blog/${post.id}`);
});

it('navigates through the reader link only on keyboard activation', async () => {
  const user = userEvent.setup();
  renderRoute(
    <Routes>
      <Route path="/blogs" element={<BlogCard post={post} session={session} />} />
      <Route path="/blog/:id" element={<h1>Reader destination</h1>} />
    </Routes>,
    '/blogs',
  );
  expect(screen.queryByText('Reader destination')).not.toBeInTheDocument();
  screen.getByRole('link', { name: new RegExp(post.title) }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('heading', { name: 'Reader destination' })).toBeVisible();
});

it('activates Edit as a sibling link without opening the reader', async () => {
  const user = userEvent.setup();
  renderRoute(
    <Routes>
      <Route path="/blogs" element={<BlogCard post={post} session={session} />} />
      <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
      <Route path="/blog/:id" element={<h1>Reader destination</h1>} />
    </Routes>,
    '/blogs',
  );
  const edit = screen.getByRole('link', { name: 'Edit', exact: true });
  expect(edit.parentElement.tagName).toBe('ARTICLE');
  await user.click(edit);
  expect(screen.getByRole('heading', { name: 'Edit destination' })).toBeVisible();
  expect(screen.queryByText('Reader destination')).not.toBeInTheDocument();
});
