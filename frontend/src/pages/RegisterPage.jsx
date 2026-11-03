/** Create an ordinary local account only after successful prerequisite reads. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/Field.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { validateRegistration } from '../utils/auth.js';
import { getUsers, getSession, saveUsers, setSession } from '../utils/storage.js';
import { buttons, link } from '../utils/ui.js';

const initialInput = { displayName: '', username: '', password: '', confirmPassword: '' };

/** Persist account then session and disclose a failed second write honestly.
 * Args:
 *   onSession: Notify the route shell only after both writes succeed.
 * Returns:
 *   A local-only registration form with associated validation and storage errors.
 * Notes:
 *   Multi-key writes are not atomic; a partial account is never rolled back silently.
 */
export default function RegisterPage({ onSession }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialInput);
  const [errors, setErrors] = useState({});
  const [reads, setReads] = useState(null);
  const [failure, setFailure] = useState('');
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    setReads({ users: getUsers(), session: getSession() });
  }, []);

  /** Retain entered text exactly; validation owns normalization for lookup only. */
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Re-read both keys before any explicit account mutation. */
  function submit(event) {
    event.preventDefault();
    if (!reads || !reads.users.ok || !reads.session.ok || partial) return;
    setFailure('');
    const latest = { users: getUsers(), session: getSession() };
    setReads(latest);
    if (!latest.users.ok || !latest.session.ok) return;
    const nextErrors = validateRegistration(values, latest.users.value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    let account;
    try {
      account = {
        id: crypto.randomUUID(),
        displayName: values.displayName,
        username: values.username,
        password: values.password,
        role: 'user',
        createdAt: new Date().toISOString(),
      };
    } catch {
      setFailure('The local account could not be created. Nothing was saved. Please retry.');
      return;
    }
    const saved = saveUsers([...latest.users.value, account]);
    if (!saved.ok) {
      setFailure('The local account could not be saved. You are not signed in. Please retry.');
      return;
    }
    const session = {
      userId: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
    };
    if (!setSession(session).ok) {
      setPartial(true);
      setFailure('Your account was created locally, but your session could not be saved. You are not signed in. Retry signing in with this account when local storage is available.');
      return;
    }
    onSession(session);
    navigate('/blogs');
  }

  const blocked = !reads || !reads.users.ok || !reads.session.ok || partial;
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:py-16">
      <section className="self-start lg:sticky lg:top-16">
        <Link to="/" className={`font-display text-2xl font-bold no-underline ${link}`}>
          WriteSpace
        </Link>
        <p className="mt-12 text-xs font-bold uppercase tracking-widest text-primary-700">
          A space for your words
        </p>
        <h1 className="mt-4 font-display text-display font-bold text-foreground">
          Create your account.
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-foreground-muted">
          Choose a display name and username for your writing in this browser.
        </p>
        <div className="mt-8 max-w-md border-l-2 border-secondary-400 pl-5 text-sm leading-relaxed text-foreground-muted">
          Local-only demo: data and authentication are client-side. Credentials are stored in plain text.
          There is no backend, database, or network service. Do not use real or sensitive credentials.
        </div>
      </section>
      <section aria-label="Registration" className="rounded-card border border-border bg-surface p-6 shadow-editorial sm:p-9">
        <h2 className="font-display text-2xl font-bold text-foreground">
          Your local writing identity
        </h2>
        <p className="mb-7 mt-2 text-sm text-foreground-muted">
          All fields are required. Use a demo password only.
        </p>
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field
            id="displayName"
            label="Display name"
            value={values.displayName}
            onChange={change}
            error={errors.displayName}
            autoComplete="nickname"
          />
          <Field
            id="username"
            label="Username"
            value={values.username}
            onChange={change}
            error={errors.username}
            autoComplete="username"
          />
          <Field
            id="password"
            label="Password"
            type="password"
            value={values.password}
            onChange={change}
            error={errors.password}
            autoComplete="new-password"
          />
          <Field
            id="confirmPassword"
            label="Confirm password"
            type="password"
            value={values.confirmPassword}
            onChange={change}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
          {reads && (
            <>
              <StorageWarning result={reads.users} />
              <StorageWarning result={reads.session} />
            </>
          )}
          {failure && (
            <StorageWarning>{failure}</StorageWarning>
          )}
          <button type="submit" disabled={blocked} className={`${buttons.primary} w-full`}>
            Create account
          </button>
          <Link to="/" className={`inline-block text-sm ${link}`}>
            Back to WriteSpace
          </Link>
        </form>
      </section>
    </main>
  );
}
RegisterPage.propTypes = { onSession: PropTypes.func.isRequired };
