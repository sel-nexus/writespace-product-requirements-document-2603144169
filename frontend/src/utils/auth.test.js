/** Verify pure validation, exact-password lookup and source-preserving permissions. */
import { describe, it, expect } from 'vitest';
import { authenticate, validateRegistration, validateNewUser, isAdmin, homeFor, canManagePost } from './auth.js';
import { user, session, post } from '../test/fixtures.js';

const input = { displayName: 'Synthetic Writer', username: 'New.Writer', password: ' demo-only ', confirmPassword: ' demo-only ', role: 'user' };

describe('registration validation', () => {
  it('accepts a unique complete registration without mutation or role escalation', () => {
    const values = { ...input, role: 'admin' };
    const users = [Object.freeze({ ...user })];
    expect(validateRegistration(Object.freeze(values), Object.freeze(users))).toEqual({});
    expect(values.role).toBe('admin');
    expect(users).toEqual([user]);
  });
  for (const field of ['displayName', 'username', 'password', 'confirmPassword']) {
    it.each([undefined, null, 8, {}, '', '  '])(`requires ${field}: %s`, (value) => {
      expect(validateRegistration({ ...input, [field]: value }, [])).toHaveProperty(field, 'Required');
    });
  }
  it('returns every required field rather than stopping at the first', () => {
    expect(validateRegistration({}, [])).toEqual({ displayName: 'Required', username: 'Required', password: 'Required', confirmPassword: 'Required' });
  });
  it('rejects exact password mismatch, including surrounding spaces', () => {
    expect(validateRegistration({ ...input, confirmPassword: 'demo-only' }, [])).toEqual({ confirmPassword: 'Passwords do not match' });
  });
  it.each(['admin', 'ADMIN', ' Admin ', 'aDmIn'])('reserves bootstrap username %s', (username) => {
    expect(validateRegistration({ ...input, username }, [])).toEqual({ username: 'Already exists' });
  });
  it.each(['Mina', 'mina', ' MINA '])('rejects normalized duplicate %s', (username) => {
    expect(validateRegistration({ ...input, username }, [user])).toEqual({ username: 'Already exists' });
  });
  it('normalizes stored usernames too', () => {
    expect(validateRegistration({ ...input, username: 'mina' }, [{ ...user, username: '  MiNa ' }])).toEqual({ username: 'Already exists' });
  });
});
describe('admin-created account validation', () => {
  it.each(['user', 'admin', 'Admin'])('accepts selected role %s without rewriting', (role) => {
    const values = { ...input, role };
    expect(validateNewUser(values, [])).toEqual({});
    expect(values.role).toBe(role);
  });
  for (const field of ['displayName', 'username', 'password', 'role']) {
    it.each([undefined, null, 3, '', '  '])(`requires new-user ${field}: %s`, (value) => {
      expect(validateNewUser({ ...input, [field]: value }, [])).toHaveProperty(field, 'Required');
    });
  }
  it.each(['ADMIN', 'guest', ' user '])('rejects unsupported selected role %s', (role) => {
    expect(validateNewUser({ ...input, role }, [])).toEqual({ role: 'Invalid role' });
  });
  it('rejects account duplicates and reserved bootstrap keys', () => {
    expect(validateNewUser({ ...input, username: 'mina' }, [user])).toEqual({ username: 'Already exists' });
    expect(validateNewUser({ ...input, username: 'ADMIN' }, [])).toEqual({ username: 'Already exists' });
  });
});
describe('authentication', () => {
  it.each(['admin', ' ADMIN '])('authenticates bootstrap %s with source identity and role', (username) => {
    expect(authenticate(username, 'admin', [])).toEqual({ ok: true, session: { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' } });
  });
  it.each(['Mina', ' mina ', 'MINA'])('authenticates normalized ordinary username %s and preserves original session values', (username) => {
    expect(authenticate(username, 'demo-only', [user])).toEqual({ ok: true, session });
  });
  it.each(['admin', 'Admin', 'UnresolvedRole'])('preserves registered role %s', (role) => {
    expect(authenticate('mina', 'demo-only', [{ ...user, role }])).toEqual({ ok: true, session: { ...session, role } });
  });
  it('matches stored username key but exact password including whitespace', () => {
    expect(authenticate('mina', ' demo-only ', [{ ...user, username: ' MiNa ', password: ' demo-only ' }])).toEqual({ ok: true, session: { ...session, username: ' MiNa ' } });
  });
  it.each([
    ['unknown', 'demo-only'], ['mina', 'wrong'], ['mina', ' demo-only'],
    ['mina', 'DEMO-ONLY'], ['admin', 'Admin'], ['admin', ' admin '],
    ['', 'demo-only'], ['  ', 'demo-only'], [undefined, 'demo-only'], [7, 'demo-only'],
    ['mina', undefined], ['mina', null], ['mina', 3],
  ])('rejects invalid credentials %s / %s', (username, password) => {
    expect(authenticate(username, password, [user])).toEqual({ ok: false, error: 'invalid_credentials' });
  });
  it('rejects an ordinary login with an empty collection', () => {
    expect(authenticate('mina', 'demo-only', [])).toEqual({ ok: false, error: 'invalid_credentials' });
  });
});
describe('role destinations and ownership', () => {
  it.each([
    [null, false, '/'], [undefined, false, '/'],
    [session, false, '/blogs'], [{ ...session, role: 'admin' }, true, '/admin'],
    [{ ...session, role: 'Admin' }, true, '/admin'], [{ ...session, role: 'ADMIN' }, false, '/blogs'],
    [{ ...session, role: 'Unknown' }, false, '/blogs'],
  ])('selects the exact source role home for %s', (value, admin, home) => {
    const snapshot = value && { ...value };
    expect(isAdmin(value)).toBe(admin);
    expect(homeFor(value)).toBe(home);
    if (value) expect(value).toEqual(snapshot);
  });
  it.each([
    [null, post, false], [session, null, false], [session, post, true],
    [{ ...session, userId: 'different' }, post, false],
    [{ ...session, userId: 'different', role: 'admin' }, post, true],
    [{ ...session, userId: 'different', role: 'Admin' }, post, true],
    [{ ...session, userId: 'different', role: 'ADMIN' }, post, false],
  ])('checks ownership and admin spelling without modifying data', (value, resource, allowed) => {
    expect(canManagePost(value, resource)).toBe(allowed);
    expect(post.authorId).toBe(session.userId);
  });
});
