/** Verify account form, confirmation and failure integrity through user actions. */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import UserManagement from './UserManagement.jsx';
import { renderRoute, user, session } from '../test/fixtures.js';
import { getUsers, saveUsers, setSession, STORAGE_KEYS } from '../utils/storage.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
beforeEach(() => {
  setSession(admin);
  saveUsers([user]);
});

/** Fill synthetic account fields using ordinary form events. */
async function fill(role = 'user', username = 'Writer') {
  await userEvent.type(screen.getByLabelText('Display name'), 'Demo Writer');
  await userEvent.type(screen.getByLabelText('Username'), username);
  await userEvent.type(screen.getByLabelText('Password'), 'demo-new');
  await userEvent.selectOptions(screen.getByLabelText('Role'), role);
}

/** Activate only the desktop row's control in the CSS-independent unit DOM. */
function deleteButton() {
  return within(screen.getByRole('table')).getByRole('button', { name: `Delete ${user.username}` });
}

/** Assert all account mutation controls, including both row layouts, are disabled. */
function expectReadOnly() {
  for (const label of ['Display name', 'Username', 'Password', 'Role']) {
    expect(screen.getByLabelText(label)).toBeDisabled();
  }
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  for (const button of screen.getAllByRole('button', { name: /^Delete / })) {
    expect(button).toBeDisabled();
  }
}

it.each(['user', 'admin', 'Admin'])('creates selected %s account, clears form and re-reads actual persistence', async (role) => {
  renderRoute(<UserManagement session={admin} />, '/users');
  expect(getUsers().value).toEqual([user]);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  await fill(role);
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('status')).toHaveTextContent('Account created locally.');
  const saved = getUsers().value[1];
  expect(saved).toMatchObject({ displayName: 'Demo Writer', username: 'Writer', password: 'demo-new', role });
  expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
  expect(screen.getByLabelText('Username')).toHaveValue('');
  expect(screen.queryByText('demo-new')).not.toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('Writer')).toBeInTheDocument();
});

it('rejects empty fields with linked alerts, focus and unchanged storage', async () => {
  renderRoute(<UserManagement session={admin} />, '/users');
  const bytes = localStorage.getItem(STORAGE_KEYS.users);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Display name')).toHaveFocus();
  for (const label of ['Display name', 'Username', 'Password']) {
    const field = screen.getByLabelText(label);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(field.getAttribute('aria-describedby').split(' ').at(-1))).toHaveTextContent('Required');
  }
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it.each([' MINA ', ' ADMIN '])('rejects normalized duplicate %s', async (username) => {
  renderRoute(<UserManagement session={admin} />, '/users');
  await fill('user', username);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Username')).toHaveFocus();
  expect(screen.getByText('Already exists')).toHaveAttribute('role', 'alert');
  expect(getUsers().value).toEqual([user]);
});

it('does nothing on render or canceled confirmation, then persists confirmed deletion and survives remount', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const view = renderRoute(<UserManagement session={admin} />, '/users');
  const bytes = localStorage.getItem(STORAGE_KEYS.users);
  expect(confirm).not.toHaveBeenCalled();
  await userEvent.click(deleteButton());
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  confirm.mockReturnValue(true);
  const other = { ...user, id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', username: 'Other' };
  saveUsers([user, other]);
  await userEvent.click(deleteButton());
  expect(getUsers().value).toEqual([other]);
  expect(screen.getByRole('status')).toHaveTextContent('Account deleted locally.');
  view.unmount();
  renderRoute(<UserManagement session={admin} />, '/users');
  expect(within(screen.getByRole('table')).getByText('Other')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).queryByText(user.username)).not.toBeInTheDocument();
});

it('shows bootstrap and active admin as nondeletable without inventing tooltip or date', () => {
  setSession({ ...session, role: 'Admin' });
  renderRoute(<UserManagement session={{ ...session, role: 'Admin' }} />, '/users');
  expect(deleteButton()).toBeDisabled();
  const bootstrap = within(screen.getByRole('table')).getByRole('button', { name: 'Delete admin' });
  expect(bootstrap).toBeDisabled();
  expect(bootstrap).not.toHaveAttribute('title');
  expect(within(screen.getByRole('table')).getByText('—')).toBeInTheDocument();
});

it('keeps existing status and persisted bytes unchanged when deletion is canceled', async () => {
  renderRoute(<UserManagement session={admin} />, '/users');
  await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  const bytes = localStorage.getItem(STORAGE_KEYS.users);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  await userEvent.click(deleteButton());
  expect(screen.getByRole('status')).toHaveTextContent('Account created locally.');
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
});

it.each(['self', 'bootstrap', 'missing', 'role', 'corrupt-users', 'corrupt-session'])('rechecks %s protection after confirmation', async (mode) => {
  renderRoute(<UserManagement session={admin} />, '/users');
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (mode === 'self') setSession({ ...session, role: 'Admin' });
    if (mode === 'bootstrap') saveUsers([{ ...user, username: ' ADMIN ' }]);
    if (mode === 'missing') saveUsers([]);
    if (mode === 'role') setSession(session);
    if (mode === 'corrupt-users') localStorage.setItem(STORAGE_KEYS.users, '{bad');
    if (mode === 'corrupt-session') localStorage.setItem(STORAGE_KEYS.session, '{bad');
    return true;
  });
  await userEvent.click(deleteButton());
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'missing' ? 'Account not found'
    : mode === 'self' ? 'cannot delete itself' : mode === 'bootstrap' ? 'cannot be deleted'
      : mode === 'role' ? 'administrator session' : 'could not be read');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  if (mode === 'corrupt-users') expect(localStorage.getItem(STORAGE_KEYS.users)).toBe('{bad');
  else if (mode !== 'missing') expect(getUsers().value).toHaveLength(1);
  if (mode.startsWith('corrupt-')) expectReadOnly();
  expect(within(screen.getByRole('table')).getByText(user.username)).toBeInTheDocument();
});

it.each(['create', 'delete'])('shows write failure for %s without success or changed data', async (action) => {
  renderRoute(<UserManagement session={admin} />, '/users');
  if (action === 'create') await fill();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const bytes = localStorage.getItem(STORAGE_KEYS.users);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  await userEvent.click(action === 'create' ? screen.getByRole('button', { name: 'Create account' }) : deleteButton());
  expect(screen.getByRole('alert')).toHaveTextContent('No account changes were saved');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
  expect(within(screen.getByRole('table')).getByText(user.username)).toBeInTheDocument();
  for (const label of ['Display name', 'Username', 'Password', 'Role']) {
    expect(screen.getByLabelText(label)).toBeEnabled();
  }
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  expect(deleteButton()).toBeEnabled();
  write.mockRestore();
  await userEvent.click(action === 'create' ? screen.getByRole('button', { name: 'Create account' }) : deleteButton());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(action === 'create' ? 'Account created locally.' : 'Account deleted locally.');
  expect(getUsers().value).toHaveLength(action === 'create' ? 2 : 0);
});

it.each(['users', 'session'])('initial corrupt %s storage disables changes and preserves bytes', (key) => {
  localStorage.setItem(STORAGE_KEYS[key], '{bad');
  renderRoute(<UserManagement session={admin} />, '/users');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('invalid');
  expect(localStorage.getItem(STORAGE_KEYS[key])).toBe('{bad');
  if (key === 'users') expect(screen.getByText('No stored accounts to display.')).toBeInTheDocument();
});

it.each(['users', 'session'])('unavailable initial %s read is safe and read-only', (key) => {
  const read = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
    if (name === STORAGE_KEYS[key]) throw Error('blocked');
    return read.call(this, name);
  });
  renderRoute(<UserManagement session={admin} />, '/users');
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

it('renders successful empty accounts and disables a missing session', () => {
  saveUsers([]);
  localStorage.removeItem(STORAGE_KEYS.session);
  renderRoute(<UserManagement />, '/users');
  expect(screen.getByText('No stored accounts to display.')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('administrator session');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

it.each(['duplicate', 'role', 'corrupt', 'uuid'])('rejects latest %s creation failure and retains form', async (mode) => {
  renderRoute(<UserManagement session={admin} />, '/users');
  await fill();
  if (mode === 'duplicate') saveUsers([{ ...user, username: ' writer ' }]);
  if (mode === 'role') setSession(session);
  if (mode === 'corrupt') localStorage.setItem(STORAGE_KEYS.users, '{bad');
  if (mode === 'uuid') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('uuid'); });
  const bytes = localStorage.getItem(STORAGE_KEYS.users);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'duplicate' ? 'Already exists'
    : mode === 'role' ? 'administrator session' : mode === 'corrupt' ? 'could not be read' : 'identity');
  expect(screen.getByLabelText('Username')).toHaveValue('Writer');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(localStorage.getItem(STORAGE_KEYS.users)).toBe(bytes);
  if (mode === 'corrupt') expectReadOnly();
});

it.each([
  ['create', 'users', 'corrupt'], ['create', 'session', 'corrupt'],
  ['create', 'users', 'throw'], ['create', 'session', 'throw'],
  ['delete', 'users', 'corrupt'], ['delete', 'session', 'corrupt'],
  ['delete', 'users', 'throw'], ['delete', 'session', 'throw'],
])('latches read-only after late %s %s %s failure without subsequent confirmation or writes', async (action, key, mode) => {
  const other = { ...user, id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', username: 'Other' };
  saveUsers([user, other]);
  renderRoute(<UserManagement session={admin} />, '/users');
  await fill();
  const read = Storage.prototype.getItem;
  const setItem = Storage.prototype.setItem;
  const original = Object.fromEntries(['users', 'session'].map((name) => [name, read.call(localStorage, STORAGE_KEYS[name])]));
  let failedBytes;
  let readFailure;
  /** Introduce the failure after hydration, or inside native confirmation. */
  function failRead() {
    if (mode === 'corrupt') setItem.call(localStorage, STORAGE_KEYS[key], '{bad');
    else readFailure = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
      if (name === STORAGE_KEYS[key]) throw Error('blocked');
      return read.call(this, name);
    });
    failedBytes = Object.fromEntries(['users', 'session'].map((name) => [name, read.call(localStorage, STORAGE_KEYS[name])]));
  }
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
    failRead();
    return true;
  });
  if (action === 'create') failRead();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  await userEvent.click(action === 'create' ? screen.getByRole('button', { name: 'Create account' }) : deleteButton());
  expect(screen.getByRole('alert')).toHaveTextContent(mode === 'corrupt' ? 'could not be read' : 'Local storage could not complete');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.getByLabelText('Username')).toHaveValue('Writer');
  expectReadOnly();
  expect(within(screen.getByRole('table')).getByText('Other')).toBeInTheDocument();
  const confirmations = confirm.mock.calls.length;
  expect(confirmations).toBe(action === 'delete' ? 1 : 0);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  for (const name of ['users', 'session']) {
    expect(read.call(localStorage, STORAGE_KEYS[name])).toBe(failedBytes[name]);
  }
  // External recovery must not re-enable this mounted page.
  readFailure?.mockRestore();
  for (const name of ['users', 'session']) localStorage.setItem(STORAGE_KEYS[name], original[name]);
  write.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  for (const button of screen.getAllByRole('button', { name: /^Delete / })) await userEvent.click(button);
  fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form'));
  expectReadOnly();
  expect(confirm).toHaveBeenCalledTimes(confirmations);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  for (const name of ['users', 'session']) {
    expect(read.call(localStorage, STORAGE_KEYS[name])).toBe(original[name]);
  }
});
