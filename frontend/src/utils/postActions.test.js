/** Exercise mutation branches against real localStorage, injecting only browser failures. */
import { beforeEach, expect, it, vi } from 'vitest';
import { createPost, updatePost, deletePost, validatePost } from './postActions.js';
import { STORAGE_KEYS, getPosts } from './storage.js';
import { post, session } from '../test/fixtures.js';

const generatedId = '11111111-1111-4111-8111-111111111111';
const draft = { title: '  New title  ', content: '  First line\n\nSecond line\t ' };
const nextTime = '2026-02-01T12:00:00.000Z';
const actions = [
  ['create', () => createPost(draft)],
  ['update', () => updatePost(post.id, draft)],
  ['delete', () => deletePost(post.id)],
];

beforeEach(() => {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([post]));
  localStorage.setItem(STORAGE_KEYS.users, 'untouched users');
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(nextTime));
});

it.each([null, undefined, {}, { title: 3, content: [] }, { title: '\t', content: '\n ' }])(
  'pure validation rejects missing, non-text and blank drafts %s without storage access', (input) => {
    const read = vi.spyOn(Storage.prototype, 'getItem');
    expect(validatePost(input)).toEqual({ title: 'Required', content: 'Required' });
    expect(read).not.toHaveBeenCalled();
  },
);

it('validates each field independently and preserves a one-character or large plain-text draft', () => {
  expect(validatePost({ title: 'x', content: '' })).toEqual({ content: 'Required' });
  expect(validatePost({ title: '', content: 'x' })).toEqual({ title: 'Required' });
  expect(validatePost(draft)).toEqual({});
  expect(validatePost({ title: 'x', content: '<script>'.repeat(10000) })).toEqual({});
});

it.each(['create', 'update'])('%s rejects invalid drafts without any mutation or reads', (action) => {
  const reads = vi.spyOn(Storage.prototype, 'getItem');
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const result = action === 'create' ? createPost({}) : updatePost(post.id, {});
  expect(result).toEqual({ ok: false, error: 'validation', errors: { title: 'Required', content: 'Required' } });
  expect(reads).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
});

it('prepends UUID and one ISO instant with exact text and only latest session authorship', () => {
  const latestSession = { ...session, userId: 'admin', role: 'Admin', displayName: 'Latest identity' };
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(latestSession));
  const result = createPost({ ...draft, id: post.id, authorId: post.authorId, authorName: 'Forged', createdAt: 'fake' });
  const created = {
    id: generatedId, ...draft, authorId: 'admin', authorName: 'Latest identity', authorRole: 'Admin',
    createdAt: nextTime, updatedAt: nextTime,
  };
  expect(result).toEqual({ ok: true, post: created });
  expect(getPosts()).toEqual({ ok: true, value: [created, post] });
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(latestSession));
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('untouched users');
});

it('creates from a missing posts key without relying on cached collections', () => {
  localStorage.removeItem(STORAGE_KEYS.posts);
  expect(createPost(draft).ok).toBe(true);
  expect(getPosts().value).toHaveLength(1);
});

it('reads latest storage after UUID generation instead of overwriting intervening data', () => {
  const added = { ...post, id: '22222222-2222-4222-8222-222222222222' };
  vi.mocked(crypto.randomUUID).mockImplementation(() => {
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([added, post]));
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...session, displayName: 'Changed name' }));
    return generatedId;
  });
  expect(createPost(draft).post.authorName).toBe('Changed name');
  expect(getPosts().value.slice(1)).toEqual([added, post]);
});

it.each(['throws', 'missing', 'invalid', 'non-string', 'collision'])('rejects UUID generation %s without writes', (failure) => {
  if (failure === 'throws') vi.mocked(crypto.randomUUID).mockImplementation(() => { throw new Error('unavailable'); });
  if (failure === 'missing') vi.stubGlobal('crypto', {});
  if (failure === 'invalid') vi.mocked(crypto.randomUUID).mockReturnValue('not-a-uuid');
  if (failure === 'non-string') vi.mocked(crypto.randomUUID).mockReturnValue(null);
  if (failure === 'collision') vi.mocked(crypto.randomUUID).mockReturnValue(post.id);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(createPost(draft)).toEqual({ ok: false, error: 'generation_failed' });
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it.each(['create', 'update'])('%s reports timestamp generation failure without writing', (action) => {
  vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw new Error('clock'); });
  expect(action === 'create' ? createPost(draft) : updatePost(post.id, draft))
    .toEqual({ ok: false, error: 'generation_failed' });
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

for (const [action, execute] of actions) {
  it.each([
    [STORAGE_KEYS.session, '{broken'], [STORAGE_KEYS.session, 'null'],
    [STORAGE_KEYS.session, '{}'], [STORAGE_KEYS.session, JSON.stringify({ ...session, userId: 'bad' })],
    [STORAGE_KEYS.posts, '{broken'], [STORAGE_KEYS.posts, '{}'], [STORAGE_KEYS.posts, 'null'],
    [STORAGE_KEYS.posts, JSON.stringify([{ ...post, authorName: '' }])],
    [STORAGE_KEYS.posts, JSON.stringify([{ ...post, updatedAt: '2026-01-10' }])],
  ])(`${action} preserves malformed %s bytes %s and never writes`, (key, bytes) => {
    localStorage.setItem(key, bytes);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(execute()).toEqual({ ok: false, error: 'read_failed' });
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe(bytes);
  });

  it.each([STORAGE_KEYS.posts, STORAGE_KEYS.session])(`${action} fails closed on blocked %s reads`, (key) => {
    const original = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(name) {
      if (name === key) throw new Error('blocked');
      return original.call(this, name);
    });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(execute()).toEqual({ ok: false, error: 'read_failed' });
    expect(writes).not.toHaveBeenCalled();
    read.mockRestore();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(session));
  });

  it(`${action} rejects a session removed since the display was rendered`, () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    expect(execute()).toEqual({ ok: false, error: 'permission_denied' });
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it(`${action} reports write failure and leaves all real stored state unchanged`, () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(execute()).toEqual({ ok: false, error: 'write_failed' });
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(session));
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('untouched users');
  });
}

for (const [action, execute] of actions.slice(1)) {
  it.each(['missing key', 'empty', 'other target'])(`${action} rejects latest %s without creating or writing`, (state) => {
    const bytes = state === 'empty' ? '[]' : JSON.stringify([{ ...post, id: generatedId }]);
    if (state === 'missing key') localStorage.removeItem(STORAGE_KEYS.posts);
    else localStorage.setItem(STORAGE_KEYS.posts, bytes);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(execute()).toEqual({ ok: false, error: 'not_found' });
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(state === 'missing key' ? null : bytes);
  });

  it.each(['foreign author', 'changed session', 'demoted admin', 'unknown role'])(
    `${action} denies latest %s without writing`, (state) => {
      let viewer = session;
      let target = post;
      if (state === 'foreign author') target = { ...post, authorId: 'admin' };
      else viewer = { ...session, userId: 'admin', role: state === 'unknown role' ? 'ADMIN' : 'user' };
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(viewer));
      localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([target]));
      const writes = vi.spyOn(Storage.prototype, 'setItem');
      expect(execute()).toEqual({ ok: false, error: 'permission_denied' });
      expect(writes).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([target]));
    },
  );
}

it.each(['user', 'admin', 'Admin'])('updates as latest %s preserving latest author, id, creation and unrelated metadata', (role) => {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ ...session, role }));
  const latestPost = { ...post, authorName: 'Latest author', authorRole: 'Custom', extra: 'Retained' };
  const survivor = { ...post, id: generatedId, title: 'Latest survivor' };
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([survivor, latestPost]));
  const result = updatePost(post.id, { ...draft, id: generatedId, authorName: 'Forged', createdAt: nextTime });
  const expected = { ...latestPost, ...draft, updatedAt: nextTime };
  expect(result).toEqual({ ok: true, post: expected });
  expect(getPosts().value).toEqual([survivor, expected]);
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('untouched users');
});

it.each(['admin', 'Admin'])('fresh %s can edit a foreign post and delete it without changing session', (role) => {
  const viewer = { ...session, userId: 'admin', role };
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(viewer));
  expect(updatePost(post.id, draft).ok).toBe(true);
  expect(getPosts().value[0].authorId).toBe(post.authorId);
  expect(deletePost(post.id)).toEqual({ ok: true });
  expect(getPosts().value).toEqual([]);
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(JSON.stringify(viewer));
});

it('owner deletion preserves newly added survivors and does not prompt in the helper', () => {
  const survivor = { ...post, id: generatedId, title: 'Fresh survivor' };
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify([survivor, post]));
  const confirm = vi.spyOn(window, 'confirm');
  expect(deletePost(post.id)).toEqual({ ok: true });
  expect(getPosts().value).toEqual([survivor]);
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('untouched users');
});
