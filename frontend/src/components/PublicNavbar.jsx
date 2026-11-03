/** Present sticky discovery navigation without mutating local identity. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { homeFor } from '../utils/auth.js';
import { buttons, link } from '../utils/ui.js';

/** Render guest entry or the supplied session's role destination.
 * Args:
 *   session: App-owned local identity; null represents a guest.
 * Returns:
 *   A sticky header with keyboard-operable mobile disclosure.
 */
export function PublicNavbar({ session = null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  /** Close the disclosure after an explicitly activated link. */
  function closeNavigation() {
    setMobileOpen(false);
  }

  /** Toggle only the disclosure, leaving location and storage untouched. */
  function toggleNavigation() {
    setMobileOpen((open) => !open);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface font-sans text-foreground shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
        <Link to="/" onClick={closeNavigation} className={`mr-auto font-display text-2xl font-bold ${link}`}>
          WriteSpace
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          aria-controls="public-navigation"
          onClick={toggleNavigation}
          className={`${buttons.secondary} sm:hidden`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <nav
          id="public-navigation"
          aria-label="Public navigation"
          className={`${mobileOpen ? 'flex' : 'hidden'} w-full flex-col gap-3 sm:flex sm:w-auto sm:flex-row sm:items-center`}
        >
          {session ? (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <Avatar role={session.role} size="sm" />
                <span className="max-w-40 truncate font-semibold">
                  {session.displayName}
                </span>
              </div>
              <Link to={homeFor(session)} onClick={closeNavigation} className={buttons.primary}>
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeNavigation} className={buttons.secondary}>
                Login
              </Link>
              <Link to="/register" onClick={closeNavigation} className={buttons.primary}>
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
  }),
};
