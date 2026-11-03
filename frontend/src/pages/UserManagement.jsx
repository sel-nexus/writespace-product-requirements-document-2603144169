/** Manage browser-local demo accounts without treating client roles as security. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Field } from '../components/Field.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { UserRow } from '../components/UserRow.jsx';
import { isAdmin } from '../utils/auth.js';
import { getSession, getUsers } from '../utils/storage.js';
import { createUser, deleteUser } from '../utils/userActions.js';
import { buttons, input } from '../utils/ui.js';

const emptyForm = { displayName: '', username: '', password: '', role: 'user' };
const failures = {
  admin_required: 'A current administrator session is required. No account changes were saved.',
  bootstrap_protected: 'The default admin account cannot be deleted.',
  self_protected: 'The active account cannot delete itself.',
  not_found: 'Account not found. No account was deleted.',
  identity_unavailable: 'An account identity could not be generated. No account was created.',
  invalid_data: 'Local data could not be read. No account changes were saved.',
  storage_unavailable: 'Local storage could not complete this action. No account changes were saved. Please retry.',
};

/** Hydrate account display, validate creation and confirm eligible deletion.
 * Args:
 *   props: Shell session used only as initial display context.
 * Returns:
 *   Labelled account form and responsive account list with honest status.
 */
export default function UserManagement({ session }) {
  const [usersRead, setUsersRead] = useState(null);
  const [sessionRead, setSessionRead] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [status, setStatus] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  useEffect(() => {
    setUsersRead(getUsers());
    setSessionRead(getSession());
  }, []);
  const current = sessionRead?.ok ? sessionRead.value : session;
  const enabled = Boolean(!readOnly && usersRead?.ok && sessionRead?.ok && isAdmin(sessionRead.value));
  const users = usersRead?.ok ? usersRead.value : [];
  const accounts = users.some((user) => user.id === 'admin') ? users : [
    { id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }, ...users,
  ];

  /** Retain controlled input identity and permit normal typing/paste. */
  function change(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  /** Persist valid submissions; latch read failures while leaving write retries enabled. */
  function submit(event) {
    event.preventDefault();
    if (!enabled) return;
    setFailure('');
    setStatus('');
    const result = createUser(form);
    setErrors(result.errors || {});
    if (!result.ok) {
      if (result.failureKind === 'read') setReadOnly(true);
      if (result.errors) {
        event.currentTarget.elements.namedItem(Object.keys(result.errors)[0])?.focus();
      } else setFailure(failures[result.error]);
      return;
    }
    setUsersRead({ ok: true, value: result.users });
    setForm(emptyForm);
    setStatus('Account created locally.');
  }

  /** Confirm enabled deletion and latch failed reads without discarding displayed accounts. */
  function remove(id) {
    if (!enabled) return;
    if (!window.confirm('Delete this local account?')) return;
    setFailure('');
    setStatus('');
    const result = deleteUser(id, true);
    if (!result.ok) {
      if (result.failureKind === 'read') setReadOnly(true);
      setFailure(failures[result.error]);
      return;
    }
    setUsersRead({ ok: true, value: result.users });
    setStatus('Account deleted locally.');
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-secondary-700">
          Administration
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold">
          User Management
        </h1>
        <p className="mt-4 max-w-3xl text-foreground-muted">
          Local-only demo. Credentials are stored in plain text; client-side account controls are not secure authorization.
          Use demo credentials only, never real or sensitive passwords.
        </p>
      </header>
      <StorageWarning result={usersRead} />
      <StorageWarning result={sessionRead} />
      {sessionRead?.ok && !isAdmin(sessionRead.value) && (
        <p role="alert" className="text-error">
          {failures.admin_required}
        </p>
      )}
      {failure && (
        <p role="alert" className="rounded-control border border-error bg-error-light p-4 text-error">
          {failure}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-success">
        {status}
      </p>
      <section aria-labelledby="create-account" className="rounded-card border border-border bg-surface p-5 sm:p-8">
        <h2 id="create-account" className="font-display text-2xl font-bold">
          Create account
        </h2>
        <form noValidate onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field
            id="displayName"
            label="Display name"
            value={form.displayName}
            onChange={change}
            error={errors.displayName}
            disabled={!enabled}
            autoComplete="off"
          />
          <Field
            id="username"
            label="Username"
            value={form.username}
            onChange={change}
            error={errors.username}
            disabled={!enabled}
            autoComplete="off"
          />
          <Field
            id="password"
            label="Password"
            type="password"
            value={form.password}
            onChange={change}
            error={errors.password}
            disabled={!enabled}
            autoComplete="new-password"
            hint="Use a demo-only password."
          />
          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-semibold">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={change}
              disabled={!enabled}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'role-error' : undefined}
              className={input}
            >
              <option value="user">
                user
              </option>
              <option value="admin">
                admin
              </option>
              <option value="Admin">
                Admin
              </option>
            </select>
            {errors.role && (
              <p id="role-error" role="alert" className="text-sm text-error">
                {errors.role}
              </p>
            )}
          </div>
          <button type="submit" disabled={!enabled} className={`${buttons.primary} sm:col-span-2 sm:justify-self-start`}>
            Create account
          </button>
        </form>
      </section>
      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading" className="mb-5 font-display text-2xl font-bold">
          Accounts
        </h2>
        {!users.length && (
          <p className="mb-5 text-foreground-muted">
            No stored accounts to display.
          </p>
        )}
        <div className="hidden overflow-x-auto rounded-card border border-border bg-surface sm:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Local accounts
            </caption>
            <thead className="bg-surface-raised text-foreground-muted">
              <tr>
                {['Identity', 'Role', 'Created', 'Actions'].map((label) => (
                  <th key={label} scope="col" className="p-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((user) => (
                <UserRow key={user.id} user={user} session={current} disabled={!enabled} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 sm:hidden">
          {accounts.map((user) => (
            <UserRow key={user.id} user={user} session={current} disabled={!enabled} onDelete={remove} mobile />
          ))}
        </div>
      </section>
    </main>
  );
}
UserManagement.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string.isRequired, role: PropTypes.string.isRequired }),
};
