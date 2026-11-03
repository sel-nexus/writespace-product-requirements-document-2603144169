/** Provide explicitly activated role navigation and guarded local logout. */
import { startTransition, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { StorageWarning } from './StorageWarning.jsx';
import { isAdmin } from '../utils/auth.js';
import { clearSession, getSession } from '../utils/storage.js';
import { buttons, focus, link } from '../utils/ui.js';

/** Render source links, responsive disclosures, and report logout failures honestly. */
export function Navbar({ session, onSession }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [read, setRead] = useState(null);
  const [failure, setFailure] = useState('');
  const links = [['/blogs', 'All Blogs'], ['/write', 'Write']];
  if (isAdmin(session)) links.push(['/users', 'Users']);

  /** Close transient disclosures only after an explicitly activated navigation. */
  function closeNavigation() {
    setMobileOpen(false);
    setAccountOpen(false);
  }

  /** Gate removal on the latest session read, retaining shell state on any failure. */
  function logout() {
    setFailure('');
    const latest = getSession();
    setRead(latest);
    if (!latest.ok) return;
    if (!clearSession().ok) {
      setFailure('Your local session could not be cleared. Logout did not complete. Please retry.');
      return;
    }
    closeNavigation();
    startTransition(() => {
      onSession(null);
      navigate('/');
    });
  }

  /** Highlight the current route without changing navigation on render. */
  function navClass({ isActive }) {
    return `min-h-11 rounded-full px-4 py-3 font-semibold ${focus} ${isActive
      ? 'bg-surface-raised text-primary-700' : 'text-foreground-muted hover:bg-surface-raised'}`;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
        <Link to="/" onClick={closeNavigation} className={`mr-auto font-display text-2xl font-bold ${link}`}>
          WriteSpace
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          aria-controls="authenticated-navigation"
          onClick={() => setMobileOpen((open) => !open)}
          className={`${buttons.secondary} sm:hidden`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <nav
          id="authenticated-navigation"
          aria-label="Main navigation"
          className={`${mobileOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-2 sm:order-none sm:flex sm:w-auto sm:flex-row`}
        >
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} onClick={closeNavigation} className={navClass}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="relative">
          <button
            type="button"
            aria-label={`Account for ${session.displayName}`}
            aria-expanded={accountOpen}
            aria-controls="account-actions"
            onClick={() => setAccountOpen((open) => !open)}
            className={`flex min-h-11 items-center gap-2 rounded-control p-1 text-foreground hover:bg-surface-raised ${focus}`}
          >
            <Avatar role={session.role} size="sm" />
            <span className="max-w-40 truncate text-sm font-semibold">
              {session.displayName}
            </span>
          </button>
          {accountOpen && (
            <div id="account-actions" className="absolute right-0 mt-2 w-48 rounded-control border border-border bg-surface p-2 shadow-editorial">
              <button type="button" onClick={logout} className={`${buttons.secondary} w-full`}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <StorageWarning result={read} />
        {failure && (
          <StorageWarning>{failure}</StorageWarning>
        )}
      </div>
    </header>
  );
}
Navbar.propTypes = {
  session: PropTypes.shape({ displayName: PropTypes.string.isRequired, role: PropTypes.string.isRequired }).isRequired,
  onSession: PropTypes.func.isRequired,
};
