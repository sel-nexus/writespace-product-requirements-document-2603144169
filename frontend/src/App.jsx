/** Compose only implemented routes and keep a browser-local session view. */
import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage.jsx';
import { StorageWarning } from './components/StorageWarning.jsx';
import { getSession } from './utils/storage.js';
import { buttons } from './utils/ui.js';

/** Render a functional entry and registration, without future-page imports. */
export default function App() {
  const [sessionRead, setSessionRead] = useState(null);
  useEffect(() => {
    setSessionRead(getSession());
  }, []);

  /** Refresh the shell only after a confirmed persisted session. */
  function onSession(session) {
    setSessionRead({ ok: true, value: session });
  }

  const session = sessionRead?.value;
  const entry = (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-primary-700">
        Browser-local writing demo
      </p>
      <h1 className="mt-4 font-display text-display font-bold">
        WriteSpace
      </h1>
      {session && (
        <p role="status" className="mt-6 text-lg">
          Signed in locally as {session.displayName}.
        </p>
      )}
      <p className="my-6 leading-relaxed text-foreground-muted">
        Local-only demo: data and authentication are client-side. Credentials are stored in plain text.
        There is no backend, database, or network service. Do not use real or sensitive credentials.
      </p>
      <StorageWarning result={sessionRead} />
      <Link to="/register" className={`${buttons.primary} mt-6`}>
        Create account
      </Link>
    </main>
  );
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Routes>
        <Route path="/" element={entry} />
        <Route path="/register" element={<RegisterPage onSession={onSession} />} />
        <Route path="*" element={entry} />
      </Routes>
    </div>
  );
}
