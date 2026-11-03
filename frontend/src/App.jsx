/** Compose only implemented routes and keep a browser-local session view. */
import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Navbar } from './components/Navbar.jsx';
import { homeFor } from './utils/auth.js';
import { StorageWarning } from './components/StorageWarning.jsx';
import { getSession } from './utils/storage.js';
import { buttons } from './utils/ui.js';

/** Wire implemented identity pages and guards; retain entry content for future slices. */
export default function App() {
  const [sessionRead, setSessionRead] = useState(null);
  useEffect(() => {
    setSessionRead(getSession());
  }, []);

  /** Refresh the shell only after a confirmed persisted session. */
  function onSession(session) {
    setSessionRead({ ok: true, value: session });
  }

  const session = sessionRead?.ok ? sessionRead.value : null;
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
      {session ? (
        <Link to={homeFor(session)} className={`${buttons.primary} mt-6`}>
          Go to Dashboard
        </Link>
      ) : (
        <div className="flex flex-wrap gap-4">
          <Link to="/register" className={buttons.primary}>
            Create account
          </Link>
          <Link to="/login" className={buttons.secondary}>
            Login
          </Link>
        </div>
      )}
    </main>
  );
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {session && (
        <Navbar session={session} onSession={onSession} />
      )}
      <StorageWarning result={sessionRead} />
      {sessionRead && (
        <Routes>
          <Route path="/" element={entry} />
          <Route
            path="/register"
            element={
              <ProtectedRoute session={session} guestOnly>
                <RegisterPage onSession={onSession} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <ProtectedRoute session={session} guestOnly>
                <LoginPage onSession={onSession} />
              </ProtectedRoute>
            }
          />
          {['/blogs', '/blog/:id', '/write', '/edit/:id', '/admin', '/users'].map((path) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute session={session} adminOnly={path === '/admin' || path === '/users'}>
                  {entry}
                </ProtectedRoute>
              }
            />
          ))}
          <Route path="*" element={entry} />
        </Routes>
      )}
    </div>
  );
}
