/** Sign in locally only after successful prerequisite reads and a confirmed write. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/Field.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { authenticate, homeFor } from '../utils/auth.js';
import { getSession, getUsers, setSession } from '../utils/storage.js';
import { buttons, link } from '../utils/ui.js';

/** Validate demo or registered credentials, preserving entered text on failure. */
export default function LoginPage({ onSession }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [reads, setReads] = useState(null);

  /** Retain original input while the auth helper owns username lookup normalization. */
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Submit bootstrap independently of users, but never overwrite an unread session. */
  function submit(event) {
    event.preventDefault();
    setFailure('');
    setReads(null);
    const nextErrors = {};
    if (!values.username.trim()) nextErrors.username = 'Required';
    if (!values.password.trim()) nextErrors.password = 'Required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    const bootstrap = values.username.trim().toLowerCase() === 'admin' && values.password === 'admin';
    const users = bootstrap ? null : getUsers();
    const session = getSession();
    setReads({ users, session });
    if (!session.ok || (users && !users.ok)) return;
    const result = authenticate(values.username, values.password, bootstrap ? [] : users.value);
    if (!result.ok) {
      setFailure('Invalid username or password.');
      return;
    }
    if (!setSession(result.session).ok) {
      setFailure('Your local session could not be saved. You are not signed in. Please retry.');
      return;
    }
    onSession(result.session);
    navigate(homeFor(result.session));
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-16">
      <section>
        <Link to="/" className={`font-display text-2xl font-bold ${link}`}>
          WriteSpace
        </Link>
        <p className="mt-12 text-xs font-bold uppercase tracking-widest text-primary-700">
          A space for your words
        </p>
        <h1 className="mt-4 font-display text-display font-bold">
          Welcome back.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground-muted">
          Sign in to your writing identity in this browser.
        </p>
        <p className="mt-8 border-l-2 border-secondary-400 pl-5 text-sm leading-relaxed text-foreground-muted">
          Local-only demo: data and authentication are client-side. Credentials are stored in plain text.
          There is no backend, database, or network service. Do not use real or sensitive credentials.
        </p>
      </section>
      <section aria-label="Login" className="rounded-card border border-border bg-surface p-6 shadow-editorial sm:p-9">
        <h2 className="font-display text-2xl font-bold">
          Login
        </h2>
        <p className="mb-7 mt-2 text-sm text-foreground-muted">
          Demo admin: username admin / password admin
        </p>
        <form onSubmit={submit} noValidate className="space-y-5">
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
            autoComplete="current-password"
          />
          {reads && (
            <>
              <StorageWarning result={reads.users} />
              <StorageWarning result={reads.session} />
            </>
          )}
          {failure && (
            <p role="alert" className="rounded-control bg-error-light p-4 text-sm font-semibold text-error">
              {failure}
            </p>
          )}
          <button type="submit" className={`${buttons.primary} w-full`}>
            Login
          </button>
          <Link to="/register" className={`inline-block text-sm ${link}`}>
            Create account
          </Link>
          <Link to="/" className={`ml-4 inline-block text-sm ${link}`}>
            Back to WriteSpace
          </Link>
        </form>
      </section>
    </main>
  );
}
LoginPage.propTypes = { onSession: PropTypes.func.isRequired };
