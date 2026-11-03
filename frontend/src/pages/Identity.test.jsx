/** Exercise registration against real jsdom localStorage, including failure paths. */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import RegisterPage from './RegisterPage.jsx';
import App from '../App.jsx';
import { Field } from '../components/Field.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { user, session, post, TIME, renderRoute } from '../test/fixtures.js';
import { STORAGE_KEYS, getUsers, getSession, saveUsers, savePosts, setSession } from '../utils/storage.js';

/** Expose navigation outcomes without adding an application route stub. */
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

/** Mount the actual page with an observable route and callback. */
function mount() {
  const onSession = vi.fn();
  renderRoute(
    <>
      <RegisterPage onSession={onSession} />
      <Location />
    </>,
  );
  return onSession;
}

/** Fill synthetic values using native user interactions. */
async function fill(actor, overrides = {}) {
  const values = { displayName: 'Synthetic Writer', username: ' New.Writer ', password: ' demo-only ', confirmPassword: ' demo-only ', ...overrides };
  for (const [field, label] of [
    ['displayName', 'Display name'], ['username', 'Username'],
    ['password', 'Password'], ['confirmPassword', 'Confirm password'],
  ]) {
    if (values[field]) await actor.type(screen.getByLabelText(label, { exact: true }), values[field]);
  }
}

/** Submit through the accessible action rather than invoking component internals. */
async function submit(actor) {
  await actor.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('ordinary local registration', () => {
  it('persists a complete ordinary account and session, preserves collection and navigates only on submit', async () => {
    saveUsers([user]);
    savePosts([post]);
    const onSession = mount();
    const actor = userEvent.setup();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('f61c3987-d971-4d55-9904-c596edb7cafd');
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(TIME);
    await fill(actor);
    expect(getUsers()).toEqual({ ok: true, value: [user] });
    expect(getSession()).toEqual({ ok: true, value: null });
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    await submit(actor);
    const account = { id: 'f61c3987-d971-4d55-9904-c596edb7cafd', displayName: 'Synthetic Writer', username: ' New.Writer ', password: ' demo-only ', role: 'user', createdAt: TIME };
    const nextSession = { userId: account.id, displayName: account.displayName, username: account.username, role: 'user' };
    expect(getUsers()).toEqual({ ok: true, value: [user, account] });
    expect(getSession()).toEqual({ ok: true, value: nextSession });
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
    expect(onSession).toHaveBeenCalledWith(nextSession);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
  });
  it('renders actual root entry, activates register link and hydrates persisted identity after remount', async () => {
    const view = renderRoute(
      <>
        <App />
        <Location />
      </>,
      '/',
    );
    const actor = userEvent.setup();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
    await actor.click(screen.getByRole('link', { name: 'Get Started Free', exact: true }));
    await fill(actor);
    await submit(actor);
    expect(screen.getByRole('button', { name: 'Account for Synthetic Writer', exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Current route').textContent).toBe('/blogs');
    const persisted = getSession();
    expect(persisted.ok).toBe(true);
    expect(persisted.value.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(getUsers().value[0].createdAt).toBe(new Date(getUsers().value[0].createdAt).toISOString());
    view.unmount();
    renderRoute(
      <>
        <App />
        <Location />
      </>,
      '/blogs',
    );
    expect(screen.getByRole('button', { name: 'Account for Synthetic Writer', exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Current route').textContent).toBe('/blogs');
    expect(getSession()).toEqual(persisted);
  });
  it('renders a root failed-session warning without mutating invalid bytes', () => {
    localStorage.setItem(STORAGE_KEYS.session, '{invalid');
    renderRoute(<App />, '/');
    expect(screen.getByRole('alert')).toHaveTextContent('Local data could not be read');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('{invalid');
  });
  it('shows all required associations and focuses the first invalid field', async () => {
    mount();
    const actor = userEvent.setup();
    await submit(actor);
    for (const label of ['Display name', 'Username', 'Password', 'Confirm password']) {
      const field = screen.getByLabelText(label, { exact: true });
      expect(field).toHaveAttribute('aria-required', 'true');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveTextContent('Required');
    }
    expect(screen.getByLabelText('Display name')).toHaveFocus();
    expect(localStorage.length).toBe(0);
  });
  for (const field of ['displayName', 'username', 'password', 'confirmPassword']) {
    it(`rejects a blank ${field} with an associated error and no writes`, async () => {
      const onSession = mount();
      const actor = userEvent.setup();
      await fill(actor, { [field]: '  ' });
      await submit(actor);
      const labels = { displayName: 'Display name', username: 'Username', password: 'Password', confirmPassword: 'Confirm password' };
      const control = screen.getByLabelText(labels[field], { exact: true });
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(control.getAttribute('aria-describedby'))).toHaveTextContent('Required');
      expect(localStorage.length).toBe(0);
      expect(onSession).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    });
  }
  it('rejects password mismatch and accepts a corrected confirmation', async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor, { confirmPassword: 'wrong' });
    await submit(actor);
    expect(screen.getByText('Passwords do not match')).toHaveAttribute('role', 'alert');
    expect(localStorage.length).toBe(0);
    await actor.clear(screen.getByLabelText('Confirm password'));
    await actor.type(screen.getByLabelText('Confirm password'), ' demo-only ');
    await submit(actor);
    expect(getSession().ok).toBe(true);
    expect(getSession().value.role).toBe('user');
  });
  it.each(['ADMIN', ' mina '])('rejects reserved or duplicate username %s with no mutation', async (username) => {
    saveUsers([user]);
    const onSession = mount();
    const actor = userEvent.setup();
    await fill(actor, { username });
    await submit(actor);
    expect(screen.getByText('Already exists')).toHaveAttribute('role', 'alert');
    expect(getUsers()).toEqual({ ok: true, value: [user] });
    expect(getSession().value).toBeNull();
    expect(onSession).not.toHaveBeenCalled();
  });
  it('re-reads the latest collection to catch a duplicate created after mount', async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor);
    saveUsers([{ ...user, username: 'NEW.WRITER' }]);
    await submit(actor);
    expect(screen.getByText('Already exists')).toBeInTheDocument();
    expect(getUsers().value).toHaveLength(1);
    expect(getSession().value).toBeNull();
  });
  it('appends to the latest collection without overwriting intervening accounts', async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor);
    saveUsers([user]);
    await submit(actor);
    expect(getUsers().value).toHaveLength(2);
    expect(getUsers().value[0]).toEqual(user);
  });
  it('navigates back only on link activation and does not save input', async () => {
    renderRoute(<App />, '/register');
    const actor = userEvent.setup();
    await fill(actor);
    await actor.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });
});

for (const key of [STORAGE_KEYS.users, STORAGE_KEYS.session]) {
  describe(`failed prerequisite ${key}`, () => {
    it.each(['{bad', JSON.stringify(key === STORAGE_KEYS.users ? [{ ...user, createdAt: '2026-02-30T00:00:00.000Z' }] : { ...session, userId: 'invalid' })])
      ('blocks invalid mount data and preserves every byte: %s', async (raw) => {
        localStorage.setItem(key, raw);
        const onSession = mount();
        const actor = userEvent.setup();
        await fill(actor);
        expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
        await submit(actor);
        expect(screen.getByRole('alert')).toHaveTextContent('Local data could not be read');
        expect(localStorage.getItem(key)).toBe(raw);
        expect(localStorage.length).toBe(1);
        expect(onSession).not.toHaveBeenCalled();
      });
    it('handles blocked reads on mount without uncaught errors or writes', async () => {
      localStorage.setItem(key, 'original bytes');
      const get = Storage.prototype.getItem;
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
        if (name === key) throw new DOMException('blocked', 'SecurityError');
        return get.call(this, name);
      });
      mount();
      expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable');
      spy.mockRestore();
      expect(localStorage.getItem(key)).toBe('original bytes');
      expect(localStorage.length).toBe(1);
    });
    it('detects corruption after mount before either write', async () => {
      const onSession = mount();
      const actor = userEvent.setup();
      await fill(actor);
      localStorage.setItem(key, '{later corruption');
      await submit(actor);
      expect(screen.getByRole('alert')).toHaveTextContent('Local data could not be read');
      expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
      expect(localStorage.getItem(key)).toBe('{later corruption');
      expect(localStorage.length).toBe(1);
      expect(onSession).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    });
    it('detects a read exception after mount before either write', async () => {
      const onSession = mount();
      const actor = userEvent.setup();
      await fill(actor);
      const get = Storage.prototype.getItem;
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
        if (name === key) throw new Error('blocked');
        return get.call(this, name);
      });
      await submit(actor);
      expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable');
      spy.mockRestore();
      expect(localStorage.length).toBe(0);
      expect(onSession).not.toHaveBeenCalled();
    });
  });
}

describe('observed write failures', () => {
  it('keeps state unchanged when account write fails and allows a manual retry', async () => {
    saveUsers([user]);
    const onSession = mount();
    const actor = userEvent.setup();
    await fill(actor);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    await submit(actor);
    expect(screen.getByRole('alert')).toHaveTextContent('The local account could not be saved. You are not signed in.');
    expect(getUsers()).toEqual({ ok: true, value: [user] });
    expect(getSession().value).toBeNull();
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Username')).toHaveValue(' New.Writer ');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    spy.mockRestore();
    await submit(actor);
    expect(getUsers().value).toHaveLength(2);
    expect(getSession().value.role).toBe('user');
  });
  it('discloses partial creation, preserves old session and never repeats account creation', async () => {
    setSession(session);
    const onSession = mount();
    const actor = userEvent.setup();
    await fill(actor);
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === STORAGE_KEYS.session) throw new Error('session blocked');
      return set.call(this, key, value);
    });
    await submit(actor);
    expect(screen.getByRole('alert')).toHaveTextContent('Your account was created locally, but your session could not be saved.');
    expect(screen.getByRole('alert')).toHaveTextContent('You are not signed in. Retry signing in');
    expect(getUsers().value).toHaveLength(1);
    expect(getUsers().value[0].username).toBe(' New.Writer ');
    expect(getSession()).toEqual({ ok: true, value: session });
    expect(onSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    await submit(actor);
    expect(getUsers().value).toHaveLength(1);
  });
  it('reports identity generation exceptions without saving anything', async () => {
    mount();
    const actor = userEvent.setup();
    await fill(actor);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    await submit(actor);
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved. Please retry.');
    expect(localStorage.length).toBe(0);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });
});

describe('shared field and warning contracts', () => {
  it('associates helper and error, retains paste, and handles optional fields', async () => {
    const actor = userEvent.setup();
    const onChange = vi.fn();
    renderRoute(<Field id="sample" label="Sample" value="" onChange={onChange} required={false} hint="Helpful" error="Invalid" />);
    const field = screen.getByLabelText('Sample');
    expect(field).toHaveAttribute('aria-required', 'false');
    expect(field).not.toBeRequired();
    expect(field).toHaveAttribute('aria-describedby', 'sample-hint sample-error');
    await actor.click(field);
    await actor.paste('synthetic pasted text');
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid');
  });
  it('supports hint-only fields without an error or invalid state', () => {
    renderRoute(<Field id="sample" label="Sample" value="" onChange={() => {}} hint="Helpful" />);
    expect(screen.getByLabelText('Sample')).toHaveAttribute('aria-describedby', 'sample-hint');
    expect(screen.getByLabelText('Sample')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('omits descriptions for fields with no feedback and successful or absent warnings', () => {
    renderRoute(
      <>
        <Field id="sample" label="Sample" value="" onChange={() => {}} />
        <StorageWarning />
        <StorageWarning result={{ ok: true }} />
      </>,
    );
    expect(screen.getByLabelText('Sample')).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
