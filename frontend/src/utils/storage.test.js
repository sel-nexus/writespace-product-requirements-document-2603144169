/** Verify exact envelopes and real localStorage integrity at every boundary. */
import { describe, it, expect, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers, getSession, setSession, clearSession, STORAGE_KEYS } from './storage.js';
import { user, post, session } from '../test/fixtures.js';

const stores = [
  { key: STORAGE_KEYS.users, read: getUsers, write: saveUsers, value: [user], fallback: [] },
  { key: STORAGE_KEYS.posts, read: getPosts, write: savePosts, value: [post], fallback: [] },
  { key: STORAGE_KEYS.session, read: getSession, write: setSession, value: session, fallback: null },
];
for (const store of stores) {
  describe(store.key, () => {
    it('returns the exact successful missing-key envelope without writing', () => {
      expect(store.read()).toEqual({ ok: true, value: store.fallback });
      expect(localStorage.getItem(store.key)).toBeNull();
      expect(localStorage.length).toBe(0);
    });
    it('persists a complete value and returns its exact enveloped record', () => {
      expect(store.write(store.value)).toEqual({ ok: true });
      expect(localStorage.getItem(store.key)).toBe(JSON.stringify(store.value));
      expect(store.read()).toEqual({ ok: true, value: store.value });
    });
    it.each(['{broken', '', 'null', '42', '"value"', '{}', '[null]'])('rejects invalid bytes %s without altering them', (raw) => {
      localStorage.setItem(store.key, raw);
      expect(store.read()).toEqual({ ok: false, value: store.fallback, error: 'invalid_data' });
      expect(localStorage.getItem(store.key)).toBe(raw);
      expect(localStorage.length).toBe(1);
    });
    it('handles access exceptions without erasing any stored bytes', () => {
      const raw = JSON.stringify(store.value);
      localStorage.setItem(store.key, raw);
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
      expect(store.read()).toEqual({ ok: false, value: store.fallback, error: 'storage_unavailable' });
      spy.mockRestore();
      expect(localStorage.getItem(store.key)).toBe(raw);
    });
    it.each(['QuotaExceededError', 'SecurityError'])('reports %s write failure and preserves existing state', (name) => {
      localStorage.setItem(store.key, 'original bytes');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', name); });
      expect(store.write(store.value)).toEqual({ ok: false, error: 'storage_unavailable' });
      expect(localStorage.getItem(store.key)).toBe('original bytes');
    });
    it('reports serialization failure before any mutation', () => {
      localStorage.setItem(store.key, 'original bytes');
      const cyclic = {};
      cyclic.self = cyclic;
      expect(store.write(cyclic)).toEqual({ ok: false, error: 'storage_unavailable' });
      expect(localStorage.getItem(store.key)).toBe('original bytes');
    });
    it('handles localStorage property access failure on read and write', () => {
      const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('blocked'); });
      expect(store.read()).toEqual({ ok: false, value: store.fallback, error: 'storage_unavailable' });
      expect(store.write(store.value)).toEqual({ ok: false, error: 'storage_unavailable' });
      spy.mockRestore();
      expect(localStorage.length).toBe(0);
    });
  });
}

for (const [key, read, record, collection] of [
  [STORAGE_KEYS.users, getUsers, user, true],
  [STORAGE_KEYS.posts, getPosts, post, true],
  [STORAGE_KEYS.session, getSession, session, false],
]) {
  describe(`${key} complete schema`, () => {
    for (const field of Object.keys(record)) {
      it.each([undefined, null, 7, {}, [], '', '   '])(`rejects missing, non-text or blank ${field}: %s`, (value) => {
        const invalid = { ...record, [field]: value };
        const raw = JSON.stringify(collection ? [record, invalid] : invalid);
        localStorage.setItem(key, raw);
        expect(read()).toEqual({ ok: false, value: collection ? [] : null, error: 'invalid_data' });
        expect(localStorage.getItem(key)).toBe(raw);
      });
    }
    it.each([null, [], 'record', 4])('rejects a non-record row %s', (value) => {
      const raw = JSON.stringify(collection ? [value] : value);
      localStorage.setItem(key, raw);
      expect(read()).toEqual({ ok: false, value: collection ? [] : null, error: 'invalid_data' });
      expect(localStorage.getItem(key)).toBe(raw);
    });
    it('preserves unknown nonempty role spellings rather than rewriting data', () => {
      const roleField = collection && key === STORAGE_KEYS.posts ? 'authorRole' : 'role';
      const value = { ...record, [roleField]: 'UnresolvedRole' };
      const raw = JSON.stringify(collection ? [value] : value);
      localStorage.setItem(key, raw);
      expect(read()).toEqual({ ok: true, value: collection ? [value] : value });
      expect(localStorage.getItem(key)).toBe(raw);
    });
  });
}

for (const [key, read, record, dateFields] of [
  [STORAGE_KEYS.users, getUsers, user, ['createdAt']],
  [STORAGE_KEYS.posts, getPosts, post, ['createdAt', 'updatedAt']],
]) {
  for (const field of dateFields) {
    it.each(['not-a-date', '2026-01-10', '2026-01-10T09:00:00Z', '2026-01-10T10:00:00.000+01:00', '2026-02-30T09:00:00.000Z', '2026-01-10T09:00:00.000z', '999999-01-01T00:00:00.000Z'])
      (`${key} rejects noncanonical ${field}: %s`, (value) => {
        const raw = JSON.stringify([{ ...record, [field]: value }]);
        localStorage.setItem(key, raw);
        expect(read()).toEqual({ ok: false, value: [], error: 'invalid_data' });
        expect(localStorage.getItem(key)).toBe(raw);
      });
  }
}

it.each([
  [STORAGE_KEYS.users, getUsers, { ...user, id: 'u-1' }, []],
  [STORAGE_KEYS.posts, getPosts, { ...post, id: 'admin' }, []],
  [STORAGE_KEYS.posts, getPosts, { ...post, authorId: 'u-1' }, []],
  [STORAGE_KEYS.session, getSession, { ...session, userId: 'u-1' }, null],
])('rejects invalid UUID identity in %s', (key, read, value, fallback) => {
  const raw = JSON.stringify(fallback === null ? value : [value]);
  localStorage.setItem(key, raw);
  expect(read()).toEqual({ ok: false, value: fallback, error: 'invalid_data' });
  expect(localStorage.getItem(key)).toBe(raw);
});
it('accepts bootstrap account, session and post author identities', () => {
  const adminUser = { ...user, id: 'admin', username: 'admin', role: 'Admin' };
  const adminSession = { ...session, userId: 'admin', role: 'admin' };
  const adminPost = { ...post, authorId: 'admin' };
  saveUsers([adminUser]);
  setSession(adminSession);
  savePosts([adminPost]);
  expect(getUsers()).toEqual({ ok: true, value: [adminUser] });
  expect(getSession()).toEqual({ ok: true, value: adminSession });
  expect(getPosts()).toEqual({ ok: true, value: [adminPost] });
});
it('accepts empty complete collections', () => {
  saveUsers([]);
  savePosts([]);
  expect(getUsers()).toEqual({ ok: true, value: [] });
  expect(getPosts()).toEqual({ ok: true, value: [] });
});
it('rejects an array as session root', () => {
  localStorage.setItem(STORAGE_KEYS.session, '[]');
  expect(getSession()).toEqual({ ok: false, value: null, error: 'invalid_data' });
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('[]');
});
describe('clearSession', () => {
  it('removes only session and remains successful when already absent', () => {
    saveUsers([user]);
    savePosts([post]);
    setSession(session);
    expect(clearSession()).toEqual({ ok: true });
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(getUsers()).toEqual({ ok: true, value: [user] });
    expect(getPosts()).toEqual({ ok: true, value: [post] });
    expect(clearSession()).toEqual({ ok: true });
  });
  it('reports remove exceptions and retains all stored state', () => {
    setSession(session);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(clearSession()).toEqual({ ok: false, error: 'storage_unavailable' });
    expect(getSession()).toEqual({ ok: true, value: session });
  });
  it('reports storage property access exceptions', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(clearSession()).toEqual({ ok: false, error: 'storage_unavailable' });
    spy.mockRestore();
  });
});
