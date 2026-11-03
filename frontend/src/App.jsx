/** Compose only implemented routes and keep a browser-local session view. */
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import Home from './pages/Home.jsx';
import ReadBlog from './pages/ReadBlog.jsx';
import WriteBlog from './pages/WriteBlog.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import UserManagement from './pages/UserManagement.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Navbar } from './components/Navbar.jsx';
import { homeFor } from './utils/auth.js';
import { StorageWarning } from './components/StorageWarning.jsx';
import { getSession } from './utils/storage.js';
import { buttons } from './utils/ui.js';

/** Wire identity, discovery, posts, overview and account management. */
export default function App() {
  const { pathname } = useLocation();
  const [sessionRead, setSessionRead] = useState(null);
  const [theme, setTheme] = useState('light');

  /** Change presentation only after the appearance button is activated. */
  function toggleTheme() {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  }
  useEffect(() => {
    const titles = { '/': 'WriteSpace', '/login': 'Login', '/register': 'Register', '/blogs': 'All Blogs',
      '/write': 'Write a post', '/admin': 'Publication overview', '/users': 'Account management' };
    document.title = `${titles[pathname] || (pathname.startsWith('/edit/') ? 'Edit post' : 'Read post')} | WriteSpace`;
  }, [pathname]);
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
    <div data-theme={theme} className="min-h-screen bg-background font-sans text-foreground">
      {pathname === '/' || !session ? (
        <PublicNavbar session={session} theme={theme} onToggle={toggleTheme} />
      ) : (
        <Navbar session={session} onSession={onSession} theme={theme} onToggle={toggleTheme} />
      )}
      <StorageWarning result={sessionRead} />
      {sessionRead && (
        <Routes>
          <Route path="/" element={<LandingPage session={session} />} />
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
          <Route
            path="/blogs"
            element={
              <ProtectedRoute session={session}>
                <Home session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/blog/:id"
            element={
              <ProtectedRoute session={session}>
                <ReadBlog session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/write"
            element={
              <ProtectedRoute session={session}>
                <WriteBlog session={session} mode="create" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute session={session}>
                <WriteBlog session={session} mode="edit" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute session={session} adminOnly>
                <AdminDashboard session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute session={session} adminOnly>
                <UserManagement session={session} />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={entry} />
        </Routes>
      )}
    </div>
  );
}
