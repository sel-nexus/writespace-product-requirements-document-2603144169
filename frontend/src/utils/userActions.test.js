/** Exercise account mutations against real local storage, including trust failures. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { user, session, TIME } from '../test/fixtures.js';
import { getUsers, setSession, saveUsers, STORAGE_KEYS } from './storage.js';
import { createUser, deleteUser, isBootstrapUser } from './userActions.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const values = { displayName: 'Demo Writer', username: 'Writer', password: 'demo-new', role: 'user' };
const newId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
beforeEach(() => {
  setSession(admin);
  saveUsers([user]);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(newId);
});

describe('createUser', () => {
  it.each(['user', 'admin', 'Admin'])('persists UUID, ISO and exact selected %s role without changing session', (role) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TIME));
    const beforeSession = localStorage.getItem(STORAGE_KEYS.session);
    const result = createUser({ ...values, username: ' Writer ', role });
    expect(result).toEqual({ ok: true, user: {
      ...values, username: ' Writer ', role, id: newId, createdAt: TIME,
    }, users: [user, { ...values, username: ' Writer ', role, id: newId, createdAt: TIME }] });
    expect(getUsers().value).toEqual(result.users);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(beforeSession);
  });
  it('accepts the other administrator spelling without normalizing existing data', () => {
    setSession({ ...admin, role: 'Admin' });
    saveUsers([{ ...user, role: 'FutureRole' }]);
    expect(createUser(values).users[0].role).toBe('FutureRole');
  });
  it.each(['displayName', 'username', 'password', 'role'])('rejects blank and invalid types for %s', (field) => {
    const bytes = localStorage.getItem(STORAGE_KEYS.users);
    for (const value of ['', '   ', null, undefined, 42, {}, []]) {
      expect(createUser({ ...values, [field]: value })).toMatchObject({
        ok: false, error: 'validation', errors: { [field]: 'Required' },
      });
      expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
    }
  });
  it.each([null, undefined, false, 12, 'text'])('rejects invalid input %s without throwing or writing', (value) => {
    expect(createUser(value)).toMatchObject({ ok: false, error: 'validation', errors: {
      displayName: 'Required', username: 'Required', password: 'Required', role: 'Required',
    } });
    expect(getUsers().value).toEqual([user]);
  });
  it.each(['ADMIN', 'User', ' admin ', 'owner'])('rejects unsupported role %s', (role) => {
    expect(createUser({ ...values, role })).toMatchObject({ errors: { role: 'Invalid role' } });
    expect(getUsers().value).toEqual([user]);
  });
  it.each(['mina', ' MINA ', 'admin', ' ADMIN '])('rejects normalized duplicate %s', (username) => {
    expect(createUser({ ...values, username })).toMatchObject({ errors: { username: 'Already exists' } });
    expect(getUsers().value).toEqual([user]);
  });
  it('uses the latest collection for duplicates and preserves intervening accounts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TIME));
    const other = { ...user, id: '11111111-2222-4333-8444-555555555555', username: 'Writer' };
    saveUsers([user, other]);
    expect(createUser(values).error).toBe('validation');
    const result = createUser({ ...values, username: 'Next' });
    expect(result.users.slice(0, 2)).toEqual([user, other]);
    const created = { ...values, username: 'Next', id: newId, createdAt: TIME };
    expect(result).toEqual({ ok: true, user: created, users: [user, other, created] });
    expect(getUsers().value).toEqual([user, other, created]);
  });
  it.each([null, session, { ...admin, role: 'ADMIN' }])('rejects latest missing/nonadmin session', (latest) => {
    if (latest) setSession(latest);
    else localStorage.removeItem(STORAGE_KEYS.session);
    expect(createUser(values)).toEqual({ ok: false, error: 'admin_required' });
    expect(getUsers().value).toEqual([user]);
  });
  it('creates from a successful missing collection, not a failed fallback', () => {
    localStorage.removeItem(STORAGE_KEYS.users);
    expect(createUser(values).users).toHaveLength(1);
    expect(getUsers().value[0].username).toBe('Writer');
  });
  it.each(['throw', 'missing', 'invalid'])('reports UUID %s failure without writing', (mode) => {
    if (mode === 'throw') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('unavailable'); });
    if (mode === 'missing') vi.stubGlobal('crypto', {});
    if (mode === 'invalid') vi.spyOn(crypto, 'randomUUID').mockReturnValue('bad-id');
    expect(createUser(values)).toEqual({ ok: false, error: 'identity_unavailable' });
    expect(getUsers().value).toEqual([user]);
  });
  it('reports timestamp generation failure after successful reads and UUID without writing', () => {
    vi.useFakeTimers();
    const generationTime = Date.parse(TIME) + 1000;
    vi.setSystemTime(generationTime);
    const iso = Date.prototype.toISOString;
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(function () {
      if (this.getTime() === generationTime) throw Error('timestamp unavailable');
      return iso.call(this);
    });
    const usersBytes = localStorage.getItem(STORAGE_KEYS.users);
    const sessionBytes = localStorage.getItem(STORAGE_KEYS.session);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(createUser(values)).toEqual({ ok: false, error: 'identity_unavailable' });
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(usersBytes);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(sessionBytes);
  });
});

describe('deleteUser', () => {
  it('persists deletion from the latest collection without touching session or other accounts', () => {
    const other = { ...user, id: newId, username: 'Other' };
    saveUsers([user, other]);
    const bytes = localStorage.getItem(STORAGE_KEYS.session);
    expect(deleteUser(user.id, true)).toEqual({ ok: true, users: [other] });
    expect(getUsers().value).toEqual([other]);
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe(bytes);
    expect(deleteUser(user.id, true)).toEqual({ ok: false, error: 'not_found' });
  });
  it.each([false, undefined, 'true', 1, null])('cancellation %s leaves bytes unchanged', (confirmed) => {
    const bytes = localStorage.getItem(STORAGE_KEYS.users);
    expect(deleteUser(user.id, confirmed)).toEqual({ ok: false, error: 'canceled' });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
  });
  it('protects bootstrap even when absent from the stored collection', () => {
    expect(deleteUser('admin', true).error).toBe('bootstrap_protected');
    saveUsers([{ ...user, username: ' ADMIN ' }]);
    expect(deleteUser(user.id, true).error).toBe('bootstrap_protected');
    expect(getUsers().value).toEqual([{ ...user, username: ' ADMIN ' }]);
  });
  it('protects the latest active id, including a just-switched administrator', () => {
    setSession({ ...session, role: 'Admin' });
    expect(deleteUser(user.id, true).error).toBe('self_protected');
    expect(getUsers().value).toEqual([user]);
  });
  it.each([null, session, { ...admin, role: 'owner' }])('requires latest admin session', (latest) => {
    if (latest) setSession(latest);
    else localStorage.removeItem(STORAGE_KEYS.session);
    expect(deleteUser(user.id, true).error).toBe('admin_required');
    expect(getUsers().value).toEqual([user]);
  });
  it.each(['absent', undefined, null, 123])('reports missing account %s honestly', (id) => {
    expect(deleteUser(id, true)).toEqual({ ok: false, error: 'not_found' });
    expect(getUsers().value).toEqual([user]);
  });
});

describe.each([
  ['create', () => createUser(values)],
  ['delete', () => deleteUser(user.id, true)],
])('%s failure integrity', (_name, action) => {
  it.each(['users', 'session'])('preserves corrupt %s bytes and prohibits writing', (key) => {
    for (const raw of ['{bad', '{}', '[{}]', 'null']) {
      localStorage.setItem(STORAGE_KEYS[key], raw);
      const before = localStorage.getItem(STORAGE_KEYS.users);
      expect(action()).toEqual({ ok: false, error: 'invalid_data', failureKind: 'read' });
      expect(localStorage.getItem(STORAGE_KEYS[key])).toBe(raw);
      expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(before);
    }
  });
  it.each(['users', 'session'])('blocks unavailable latest %s read', (key) => {
    const bytes = localStorage.getItem(STORAGE_KEYS.users);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
      if (name === STORAGE_KEYS[key]) throw Error('blocked');
      return read.call(this, name);
    });
    expect(action()).toEqual({ ok: false, error: 'storage_unavailable', failureKind: 'read' });
    expect(read.call(localStorage, STORAGE_KEYS.users)).toBe(bytes);
  });
  it('reports write failure and retains actual persisted bytes', () => {
    const bytes = localStorage.getItem(STORAGE_KEYS.users);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    expect(action()).toEqual({ ok: false, error: 'storage_unavailable', failureKind: 'write' });
    expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
    write.mockRestore();
    const retry = action();
    expect(retry.ok).toBe(true);
    expect(getUsers().value).toEqual(retry.users);
  });
});

it('recognizes bootstrap identities only, including missing values safely', () => {
  expect(isBootstrapUser({ id: 'admin' })).toBe(true);
  expect(isBootstrapUser({ username: ' ADMIN ' })).toBe(true);
  expect(isBootstrapUser(user)).toBe(false);
  expect(isBootstrapUser(null)).toBe(false);
  expect(isBootstrapUser({ username: 1 })).toBe(false);
});
