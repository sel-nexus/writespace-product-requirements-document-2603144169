/** Verify plain-text reading and every confirmed deletion trust and persistence boundary. */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import ReadBlog from './ReadBlog.jsx';
import { post, session, renderRoute } from '../test/fixtures.js';
import { STORAGE_KEYS } from '../utils/storage.js';

const timezone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'UTC'; });
afterAll(() => {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
});
const otherId = '11111111-1111-4111-8111-111111111111';

/** Seed complete real storage and mount the reader with observable destinations.
 * Args:
 *   viewer: Identity used for initial control visibility and persisted session.
 *   rows: Complete initial local collection.
 *   route: Reader entry URL, including missing-resource test entries.
 *   supplied: Optional display-only prop collection.
 * Returns:
 *   Testing Library render controls for this isolated route tree.
 */
function openReader(viewer = session, rows = [post], route = `/blog/${post.id}`, supplied) {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(rows));
  if (viewer) localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(viewer));
  return renderRoute(
    <Routes>
      <Route path="/blog/:id" element={<ReadBlog session={viewer} posts={supplied} />} />
      <Route path="/blog" element={<ReadBlog session={viewer} posts={supplied} />} />
      <Route path="/blogs" element={<h1>List destination</h1>} />
      <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
    </Routes>,
    route,
  );
}

it('renders full exact whitespace and HTML as text with source author metadata and pinned date', () => {
  const content = '  First line\n\n\tIndented <script>alert(1)</script>\n<img src=x onerror=alert(2)>\n' + 'x'.repeat(5000);
  const authored = { ...post, content, authorRole: 'Admin', authorName: 'Actual author' };
  const { container } = openReader(session, [authored]);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(post.title);
  expect(screen.getByText('Actual author')).toBeVisible();
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveTextContent('👑');
  const body = container.querySelector('.whitespace-pre-wrap');
  expect(body.textContent).toBe(content);
  expect(body).toHaveClass('whitespace-pre-wrap', 'break-words');
  expect(container.querySelector('script, img')).toBeNull();
  expect(container.querySelector('time')).toHaveTextContent('Jan 10, 2026');
  expect(container.querySelector('time')).toHaveAttribute('dateTime', post.createdAt);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.posts))).toEqual([authored]);
});

it.each([
  ['owner', session, true],
  ['non-owner', { ...session, userId: 'admin' }, false],
  ['admin', { ...session, userId: 'admin', role: 'admin' }, true],
  ['Admin', { ...session, userId: 'admin', role: 'Admin' }, true],
  ['unknown role', { ...session, userId: 'admin', role: 'ADMIN' }, false],
  ['guest', null, false],
])('shows edit/delete only for permitted %s and never confirms or saves on render', (_, viewer, allowed) => {
  const confirm = vi.spyOn(window, 'confirm');
  openReader(viewer);
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  if (allowed) {
    expect(screen.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', `/edit/${post.id}`);
  } else {
    expect(screen.queryByRole('button', { name: 'Delete', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
  }
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it.each(['/blog', '/blog/unknown', `/blog/${otherId}`])('renders exact missing state at %s and activates back link', async (route) => {
  const user = userEvent.setup();
  openReader(session, [post], route);
  expect(screen.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to blogs' })).toHaveAttribute('href', '/blogs');
  await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByRole('heading', { name: 'List destination' })).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it('reads an absent collection as a missing post without creating storage', () => {
  renderRoute(
    <Routes>
      <Route path="/blog/:id" element={<ReadBlog session={session} />} />
    </Routes>,
    `/blog/${post.id}`,
  );
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBeNull();
});

it.each(['{broken', '{}', 'null', JSON.stringify([{ ...post, updatedAt: 'invalid' }])])(
  'fails closed on corrupt initial collection %s and preserves bytes', (bytes) => {
    localStorage.setItem(STORAGE_KEYS.posts, bytes);
    renderRoute(
      <Routes>
        <Route path="/blog/:id" element={<ReadBlog session={session} />} />
      </Routes>,
      `/blog/${post.id}`,
    );
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged; changes are disabled.');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
  },
);

it('handles unavailable initial reads without erasing real data', () => {
  const bytes = JSON.stringify([post]);
  localStorage.setItem(STORAGE_KEYS.posts, bytes);
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  renderRoute(
    <ReadBlog session={session} />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable.');
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  read.mockRestore();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
});

it('canceled confirmation performs no save, no fresh read and no navigation', async () => {
  const user = userEvent.setup();
  openReader();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const save = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(read).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it.each(['user', 'admin', 'Admin'])('confirmed %s deletes permitted post, preserves other keys and navigates after save', async (role) => {
  const user = userEvent.setup();
  const viewer = { ...session, role, userId: role === 'user' ? session.userId : 'admin' };
  const survivor = { ...post, id: otherId, title: 'Keep me' };
  openReader(viewer, [post, survivor]);
  localStorage.setItem(STORAGE_KEYS.users, 'untouched-account-bytes');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('heading', { name: 'List destination' })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.posts))).toEqual([survivor]);
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(viewer));
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('untouched-account-bytes');
});

it('re-reads after confirmation and preserves newly added and newly edited survivor records', async () => {
  const user = userEvent.setup();
  const original = { ...post, id: otherId, title: 'Old survivor' };
  openReader(session, [post, original]);
  const edited = { ...original, title: 'Latest survivor', content: 'Latest content', updatedAt: '2026-02-01T00:00:00.000Z' };
  const added = { ...post, id: '22222222-2222-4222-8222-222222222222', title: 'New addition' };
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([edited, post, added]));
    return true;
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.posts))).toEqual([edited, added]);
  expect(screen.getByRole('heading', { name: 'List destination' })).toBeVisible();
});

it.each(['removed session', 'changed session', 'changed author', 'admin demotion'])('rejects %s occurring during confirmation', async (change) => {
  const user = userEvent.setup();
  const initial = change === 'admin demotion' ? { ...session, userId: 'admin', role: 'admin' } : session;
  openReader(initial);
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (change === 'removed session') localStorage.removeItem(STORAGE_KEYS.session);
    if (change === 'changed session') localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...session, userId: 'admin' }));
    if (change === 'changed author') localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([{ ...post, authorId: 'admin' }]));
    if (change === 'admin demotion') localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...initial, role: 'user' }));
    return true;
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('You no longer have permission to delete this post.');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.posts))).toEqual([
    change === 'changed author' ? { ...post, authorId: 'admin' } : post,
  ]);
});

it('accepts a fresh admin session instead of rejecting a stale changed viewer', async () => {
  const user = userEvent.setup();
  openReader();
  const newSession = { ...session, userId: 'admin', role: 'Admin' };
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(newSession));
    return true;
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.posts))).toEqual([]);
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(newSession));
  expect(screen.getByRole('heading', { name: 'List destination' })).toBeVisible();
});

it.each(['missing key', 'removed target'])('rejects latest %s without writing or navigating', async (change) => {
  const user = userEvent.setup();
  openReader();
  const bytes = JSON.stringify([{ ...post, id: otherId }]);
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (change === 'missing key') localStorage.removeItem(STORAGE_KEYS.posts);
    else localStorage.setItem(STORAGE_KEYS.posts, bytes);
    return true;
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(change === 'missing key' ? null : bytes);
});

it.each([
  [STORAGE_KEYS.posts, '{broken'], [STORAGE_KEYS.posts, '{}'],
  [STORAGE_KEYS.posts, JSON.stringify([{ ...post, authorId: '' }])],
  [STORAGE_KEYS.session, '{broken'], [STORAGE_KEYS.session, 'null'],
  [STORAGE_KEYS.session, JSON.stringify({ ...session, role: '' })],
])('preserves newly corrupt %s bytes and blocks further mutations', async (key, bytes) => {
  const user = userEvent.setup();
  openReader();
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    localStorage.setItem(key, bytes);
    return true;
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged.');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit', exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).toBe(bytes);
  if (key === STORAGE_KEYS.session) expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it.each([STORAGE_KEYS.posts, STORAGE_KEYS.session])('fails closed when latest %s read throws', async (key) => {
  const user = userEvent.setup();
  openReader();
  const originalGet = Storage.prototype.getItem;
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(name) {
      if (name === key) throw new Error('blocked');
      return originalGet.call(this, name);
    });
    return true;
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('local data could not be read');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  vi.restoreAllMocks();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(session));
});

it('remains on failure with unchanged bytes and retries against fresh data after storage recovers', async () => {
  const user = userEvent.setup();
  openReader();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Post could not be deleted. Local storage is unavailable. Please try again.');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  save.mockRestore();
  const added = { ...post, id: otherId, title: 'Added after failure' };
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post, added]));
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.posts))).toEqual([added]);
  expect(screen.getByRole('heading', { name: 'List destination' })).toBeVisible();
});

it('supplied display props cannot overwrite corrupt actual storage on deletion', async () => {
  const user = userEvent.setup();
  openReader(session, [post], `/blog/${post.id}`, [post]);
  localStorage.setItem(STORAGE_KEYS.posts, '{bad bytes');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged.');
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe('{bad bytes');
});

it('Edit activates the separate edit route without deleting', async () => {
  const user = userEvent.setup();
  openReader();
  await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
  expect(screen.getByRole('heading', { name: 'Edit destination' })).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it('hydrates fresh posts and clears old errors when the route identity changes', async () => {
  const user = userEvent.setup();
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  renderRoute(
    <>
      <Link to={`/blog/${otherId}`}>
        Next post
      </Link>
      <Routes>
        <Route path="/blog/:id" element={<ReadBlog session={session} />} />
      </Routes>
    </>,
    `/blog/${post.id}`,
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toBeVisible();
  save.mockRestore();
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([{ ...post, id: otherId, title: 'Fresh route post' }]));
  await user.click(screen.getByRole('link', { name: 'Next post' }));
  expect(screen.getByRole('heading', { name: 'Fresh route post' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
