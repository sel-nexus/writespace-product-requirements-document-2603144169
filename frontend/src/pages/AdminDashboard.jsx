/** Show browser-local publication counts and explicitly activated administration controls. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard.jsx';
import { sessionType } from '../components/BlogCard.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { getPosts, getUsers, getSession } from '../utils/storage.js';
import { deletePost } from '../utils/postActions.js';
import { isAdmin } from '../utils/auth.js';
import { newestFirst, formatPostDate } from '../utils/posts.js';
import { buttons } from '../utils/ui.js';

/** Render successful collection counts and safe, read-only fallbacks.
 * @param {object} props Dashboard presentation inputs.
 * @param {object|null} [props.session] Shell identity for initial admin action availability.
 * @returns {JSX.Element} Four statistics, quick actions and at most five recent posts.
 * Notes:
 *   Total Users counts stored accounts plus the bootstrap admin once. Stored bootstrap rows
 *   identified by id admin or reserved username admin are excluded before adding that identity.
 *   Total Admins uses the same policy and recognizes admin and Admin without rewriting roles.
 *   Failed reads never become invented zero counts or trigger storage repair.
 */
export default function AdminDashboard({ session = null }) {
  const [postsRead, setPostsRead] = useState(null);
  const [usersRead, setUsersRead] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setPostsRead(getPosts());
    setUsersRead(getUsers());
    setDenied(false);
    setError('');
    setStatus('');
  }, [session]);

  const ready = Boolean(postsRead?.ok && usersRead?.ok && isAdmin(session) && !denied);
  const posts = postsRead?.ok ? postsRead.value : [];
  const accounts = usersRead?.ok ? usersRead.value.filter((user) => (
    user.id !== 'admin' && user.username.trim().toLowerCase() !== 'admin'
  )) : [];
  const recent = newestFirst(posts).slice(0, 5);

  /** Recheck all collection and role prerequisites before any activated mutation path.
   * @returns {boolean} Whether the latest reads permit administration; failed bytes stay intact.
   */
  function checkLatest() {
    const currentPosts = getPosts();
    const currentUsers = getUsers();
    const currentSession = getSession();
    setPostsRead(currentPosts);
    setUsersRead(currentUsers);
    setStatus('');
    if (!currentPosts.ok || !currentUsers.ok || !currentSession.ok) {
      setDenied(true);
      setError('Local data could not be read. Existing data is unchanged; changes are disabled.');
      return false;
    }
    if (!isAdmin(currentSession.value)) {
      setDenied(true);
      setError('You no longer have permission to administer this publication.');
      return false;
    }
    return true;
  }

  /** Keep navigation semantic while rejecting late failed reads or changed roles.
   * @param {object} event Activated link event; default navigation is canceled on failure.
   * @returns {void}
   */
  function activateLink(event) {
    if (!ready || !checkLatest()) event.preventDefault();
  }

  /** Confirm an activated deletion and use the existing helper's latest session/posts checks.
   * @param {string} id Post identity, not a stale display record.
   * @returns {void} Update counts only after persistence; otherwise disclose the failure.
   */
  function removePost(id) {
    if (!ready || !checkLatest() || !window.confirm('Delete this post?')) return;
    if (!checkLatest()) return;
    const result = deletePost(id);
    if (!result.ok) {
      const messages = {
        read_failed: 'Local data could not be read. Existing data is unchanged; changes are disabled.',
        not_found: 'Post not found',
        permission_denied: 'You no longer have permission to delete this post.',
        write_failed: 'Post could not be deleted. Local storage is unavailable. Please try again.',
      };
      setError(messages[result.error]);
      if (result.error === 'read_failed' || result.error === 'permission_denied') setDenied(true);
      return;
    }
    setPostsRead(getPosts());
    setError('');
    setStatus('Post deleted.');
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <h1 className="font-display text-display font-bold text-secondary-700">
        Admin Dashboard
      </h1>
      {(!postsRead || !usersRead) && (
        <p role="status" className="mt-6">
          Loading publication overview…
        </p>
      )}
      <div className="mt-6 space-y-3">
        <StorageWarning result={postsRead} />
        <StorageWarning result={usersRead} />
        {error && (
          <p role="alert" className="rounded-control border border-error/30 bg-error-light p-4 text-error">
            {error}
          </p>
        )}
        <p role="status" className="text-sm text-foreground-muted">
          {status}
        </p>
      </div>
      <section aria-label="Publication statistics" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={postsRead?.ok ? posts.length : '?'} />
        <StatCard label="Total Users" value={usersRead?.ok ? accounts.length + 1 : '?'} accent="violet" />
        <StatCard label="Total Admins" value={usersRead?.ok ? accounts.filter(isAdmin).length + 1 : '?'} accent="pink" />
        <StatCard
          label="Total users"
          value="?"
          accent="teal"
          note="Source ambiguity: Total Users and Total users duplicate the label; the fourth measure is unresolved."
        />
      </section>
      <p className="mt-4 text-sm text-foreground-muted">
        Total Users and Total Admins include the bootstrap admin once, even if it is also stored.
      </p>
      <section aria-labelledby="quick-actions" className="mt-10">
        <h2 id="quick-actions" className="font-display text-2xl font-bold">
          Quick actions
        </h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {ready ? (
            <Link to="/write" onClick={activateLink} className={buttons.primary}>
              Write New Post
            </Link>
          ) : (
            <button type="button" disabled className={buttons.primary}>
              Write New Post
            </button>
          )}
          {ready ? (
            <Link to="/users" onClick={activateLink} className={buttons.secondary}>
              Manage Users
            </Link>
          ) : (
            <button type="button" disabled className={buttons.secondary}>
              Manage Users
            </button>
          )}
        </div>
      </section>
      <section aria-labelledby="recent-posts" className="mt-10">
        <h2 id="recent-posts" className="font-display text-2xl font-bold">
          Recent posts
        </h2>
        {recent.length ? (
          <ul className="mt-4 space-y-4">
            {recent.map((post) => (
              <li key={post.id} className="rounded-card border border-border bg-surface p-5">
                <article className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-display text-xl font-bold">
                      {post.title}
                    </h3>
                    <p className="mt-2 break-words text-sm text-foreground-muted">
                      {post.authorName}
                    </p>
                    <time dateTime={post.createdAt} className="text-sm text-foreground-muted">
                      {formatPostDate(post.createdAt)}
                    </time>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-3">
                    {ready ? (
                      <Link to={`/edit/${post.id}`} onClick={activateLink} className={buttons.secondary}>
                        Edit
                      </Link>
                    ) : (
                      <button type="button" disabled className={buttons.secondary}>
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => removePost(post.id)}
                      className={`${buttons.secondary} text-error`}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-card border border-border bg-surface p-6 text-foreground-muted">
            No posts yet — check back soon!
          </p>
        )}
      </section>
    </main>
  );
}

AdminDashboard.propTypes = {
  session: sessionType,
};
