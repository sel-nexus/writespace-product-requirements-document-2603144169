/** Verify accessible authoring transitions using real local persistence and route destinations. */
import { expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import WriteBlog from './WriteBlog.jsx';
import ReadBlog from './ReadBlog.jsx';
import App from '../App.jsx';
import { post, session, renderRoute } from '../test/fixtures.js';
import { STORAGE_KEYS, getPosts } from '../utils/storage.js';

const generatedId = '11111111-1111-4111-8111-111111111111';

/** Mount real authoring routes with complete stored prerequisites and reader/list destinations. */
function openWriter(mode = 'create', viewer = session, rows = [post], route, supplied) {
  if (viewer) localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(viewer));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(rows));
  localStorage.setItem(STORAGE_KEYS.users, 'unchanged accounts');
  return renderRoute(
    <Routes>
      <Route path="/write" element={<WriteBlog session={viewer} posts={supplied} />} />
      <Route path="/edit/:id" element={<WriteBlog session={viewer} posts={supplied} mode="edit" />} />
      <Route path="/edit" element={<WriteBlog session={viewer} mode="edit" />} />
      <Route path="/blog/:id" element={<ReadBlog session={viewer} />} />
      <Route path="/blogs" element={<h1>List destination</h1>} />
    </Routes>,
    route || (mode === 'edit' ? `/edit/${post.id}` : '/write'),
  );
}

/** Fill native controlled inputs without replacing application modules. */
function fillDraft(title = 'New title', content = '  Exact\n\nplain text <b>body</b>  ') {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Content'), { target: { value: content } });
}

it('starts empty with required associated controls, a 256px minimum textarea and live exact counter', async () => {
  const user = userEvent.setup();
  openWriter();
  expect(screen.getByLabelText('Title')).toHaveValue('');
  expect(screen.getByLabelText('Content')).toHaveValue('');
  expect(screen.getByLabelText('Content')).toHaveClass('min-h-64', 'resize-y');
  expect(screen.getByLabelText('Content')).toHaveAttribute('required');
  expect(screen.getByLabelText('Content')).toHaveAttribute('aria-required', 'true');
  expect(screen.getByText('0 characters')).toHaveAttribute('aria-live', 'polite');
  await user.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(screen.getAllByText('Required', { exact: true })).toHaveLength(2);
  expect(screen.getByLabelText('Title')).toHaveFocus();
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Title')).toHaveAttribute('aria-describedby', 'title-error');
  expect(screen.getByLabelText('Content')).toHaveAttribute('aria-describedby', 'content-counter content-error');
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  await user.type(screen.getByLabelText('Title'), 'Title');
  await user.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(screen.getByLabelText('Content')).toHaveFocus();
  await user.type(screen.getByLabelText('Content'), 'Text');
  expect(screen.getByText('4 characters')).toBeVisible();
});

it('creates, navigates to the real reader and persists UUID, exact text and latest session metadata', async () => {
  const user = userEvent.setup();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId);
  openWriter();
  fillDraft();
  const latest = { ...session, displayName: 'Latest writer', role: 'Admin', userId: 'admin' };
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(latest));
  await user.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
  expect(screen.getByText('Latest writer')).toBeVisible();
  const created = getPosts().value[0];
  expect(created).toEqual({
    id: generatedId, title: 'New title', content: '  Exact\n\nplain text <b>body</b>  ',
    authorId: 'admin', authorName: 'Latest writer', authorRole: 'Admin',
    createdAt: expect.any(String), updatedAt: created.createdAt,
  });
  expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  expect(getPosts().value[1]).toEqual(post);
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('unchanged accounts');
});

it.each(['user', 'admin', 'Admin'])('prefills edit for %s then preserves latest record metadata on save', async (role) => {
  const user = userEvent.setup();
  const viewer = { ...session, role, userId: role === 'user' ? session.userId : 'admin' };
  openWriter('edit', viewer);
  expect(screen.getByLabelText('Title')).toHaveValue(post.title);
  expect(screen.getByLabelText('Content')).toHaveValue(post.content);
  fillDraft();
  const latest = { ...post, authorName: 'Latest author', extra: 'Preserve me' };
  const survivor = { ...post, id: generatedId, title: 'Latest survivor' };
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([survivor, latest]));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
  expect(getPosts().value[0]).toEqual(survivor);
  expect(getPosts().value[1]).toEqual({
    ...latest, title: 'New title', content: '  Exact\n\nplain text <b>body</b>  ', updatedAt: expect.any(String),
  });
  expect(getPosts().value[1].updatedAt).not.toBe(post.updatedAt);
});

it.each(['foreign', 'guest', 'missing id', 'unknown id', 'unknown role'])('redirects %s edit without exposing a form or writing', (state) => {
  let viewer = session;
  if (state === 'guest') viewer = null;
  if (state === 'foreign' || state === 'unknown role') viewer = { ...session, userId: 'admin', role: 'ADMIN' };
  const route = state === 'missing id' ? '/edit' : state === 'unknown id' ? '/edit/unknown' : `/edit/${post.id}`;
  openWriter('edit', viewer, [post], route);
  expect(screen.getByRole('heading', { name: 'List destination' })).toBeVisible();
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it.each(['create', 'edit'])('cancel %s navigates to list/reader without writes', async (mode) => {
  const user = userEvent.setup();
  openWriter(mode);
  fillDraft();
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: mode === 'edit' ? post.title : 'List destination' })).toBeVisible();
  expect(writes).not.toHaveBeenCalled();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(session));
});

it.each(['create', 'edit'])('%s retains draft and destination on write failure then retries latest storage', async (mode) => {
  const user = userEvent.setup();
  openWriter(mode);
  fillDraft();
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const label = mode === 'edit' ? 'Save changes' : 'Publish post';
  await user.click(screen.getByRole('button', { name: label }));
  expect(screen.getByRole('alert')).toHaveTextContent('Post could not be saved. Local storage is unavailable.');
  expect(screen.getByLabelText('Title')).toHaveValue('New title');
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  write.mockRestore();
  const survivor = { ...post, id: generatedId, title: 'Added after failure' };
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post, survivor]));
  await user.click(screen.getByRole('button', { name: label }));
  expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
  expect(getPosts().value).toContainEqual(survivor);
});

it.each(['removed session', 'changed session', 'changed author', 'missing post', 'demoted admin'])(
  'edit rejects latest %s and retains draft with honest error', async (state) => {
    const user = userEvent.setup();
    const viewer = state === 'demoted admin' ? { ...session, userId: 'admin', role: 'admin' } : session;
    openWriter('edit', viewer);
    fillDraft();
    if (state === 'removed session') localStorage.removeItem(STORAGE_KEYS.session);
    if (state === 'changed session') localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...session, userId: 'admin' }));
    if (state === 'changed author') localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([{ ...post, authorId: 'admin' }]));
    if (state === 'missing post') localStorage.removeItem(STORAGE_KEYS.posts);
    if (state === 'demoted admin') localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...viewer, role: 'user' }));
    const bytes = localStorage.getItem(STORAGE_KEYS.posts);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent(state === 'missing post' ? 'Post not found' : 'no longer have permission');
    expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
  },
);

it('create rejects a removed session and UUID failures without false navigation', async () => {
  const user = userEvent.setup();
  openWriter();
  fillDraft();
  localStorage.removeItem(STORAGE_KEYS.session);
  await user.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('no longer have permission');
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
  await user.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved. Please try again.');
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

for (const mode of ['create', 'edit']) {
  it.each([STORAGE_KEYS.posts, STORAGE_KEYS.session])(`${mode} blocks newly malformed %s and preserves draft and bytes`, async (key) => {
    const user = userEvent.setup();
    openWriter(mode);
    fillDraft();
    localStorage.setItem(key, '{broken');
    await user.click(screen.getByRole('button', { name: mode === 'edit' ? 'Save changes' : 'Publish post' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged.');
    expect(screen.getByRole('button', { name: mode === 'edit' ? 'Save changes' : 'Publish post' })).toBeDisabled();
    expect(screen.getByLabelText('Title')).toHaveValue('New title');
    expect(localStorage.getItem(key)).toBe('{broken');
  });

  it.each([STORAGE_KEYS.posts, STORAGE_KEYS.session])(`${mode} fails closed on blocked latest %s reads`, async (key) => {
    const user = userEvent.setup();
    openWriter(mode);
    fillDraft();
    const original = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(name) {
      if (name === key) throw new Error('blocked');
      return original.call(this, name);
    });
    await user.click(screen.getByRole('button', { name: mode === 'edit' ? 'Save changes' : 'Publish post' }));
    expect(screen.getByRole('alert')).toHaveTextContent('local data could not be read');
    read.mockRestore();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
  });
}

it.each([STORAGE_KEYS.posts, STORAGE_KEYS.session])('initial corrupt %s shows warning and no form, ignoring supplied display props', (key) => {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  localStorage.setItem(key, '{broken');
  renderRoute(<WriteBlog session={session} posts={[post]} />, '/write');
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged; changes are disabled.');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).toBe('{broken');
});

it('initial blocked storage has a warning and no form without erasing bytes', () => {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  renderRoute(<WriteBlog session={session} />, '/write');
  expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Local storage is unavailable.');
  expect(screen.queryByLabelText('Content')).not.toBeInTheDocument();
  read.mockRestore();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it('route identity change rehydrates the next draft and clears previous errors', async () => {
  const user = userEvent.setup();
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post, { ...post, id: generatedId, title: 'Next draft' }]));
  renderRoute(
    <>
      <Link to={`/edit/${generatedId}`}>
        Next draft
      </Link>
      <Routes>
        <Route path="/edit/:id" element={<WriteBlog session={session} mode="edit" />} />
      </Routes>
    </>,
    `/edit/${post.id}`,
  );
  fillDraft('', '');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  await user.click(screen.getByRole('link', { name: 'Next draft' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Next draft');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('App wires real write, reader and edit routes on actual navigation', async () => {
  const user = userEvent.setup();
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  renderRoute(<App />, '/blogs');
  await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Write', exact: true }));
  fillDraft();
  await user.click(screen.getByRole('button', { name: 'Publish post' }));
  expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Edit', exact: true }));
  expect(screen.getByLabelText('Title')).toHaveValue('New title');
  await user.click(screen.getByRole('link', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: 'New title' })).toBeVisible();
});
