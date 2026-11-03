/** Read plain-text local posts and delete only after fresh, confirmed authorization. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { postType, sessionType } from '../components/BlogCard.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { getPosts } from '../utils/storage.js';
import { deletePost as removePost } from '../utils/postActions.js';
import { canManagePost } from '../utils/auth.js';
import { formatPostDate } from '../utils/posts.js';
import { buttons, link } from '../utils/ui.js';

/** Resolve the URL identity and retain the reader on observed mutation failures.
 * Args:
 *   session: Shell identity used only for initial action visibility.
 *   posts: Optional validated display collection; deletion always reads storage.
 * Returns:
 *   Full plain text, metadata and permitted actions, or an exact missing state.
 */
export default function ReadBlog({ session = null, posts }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [postsRead, setPostsRead] = useState(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (posts === undefined) setPostsRead(getPosts());
    setError('');
    setBlocked(false);
  }, [id, posts]);
  const collection = posts === undefined ? (postsRead?.value || []) : posts;
  const post = collection.find((row) => row.id === id);
  const manageable = !blocked && canManagePost(session, post) && (posts !== undefined || postsRead?.ok);

  /** Confirm, then re-read both trust inputs and persist one immutable removal.
   * Returns:
   *   Nothing; navigate only on success, preserving bytes and view on failure.
   * Notes:
   *   The latest record must still exist and belong to the latest session.
   */
  function deletePost() {
    if (!manageable || !window.confirm('Delete this post?')) return;
    const result = removePost(id);
    if (result.error === 'read_failed') {
      setBlocked(true);
      setError('Post could not be deleted because local data could not be read. Existing data is unchanged.');
      return;
    }
    if (result.error === 'not_found') {
      setError('Post not found');
      return;
    }
    if (result.error === 'permission_denied') {
      setError('You no longer have permission to delete this post.');
      return;
    }
    if (!result.ok) {
      setError('Post could not be deleted. Local storage is unavailable. Please try again.');
      return;
    }
    navigate('/blogs');
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <Link to="/blogs" className={link}>
        Back to blogs
      </Link>
      {posts === undefined && (
        <StorageWarning result={postsRead} />
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-control border border-error/30 bg-error-light p-4 text-error">
          {error}
        </p>
      )}
      {post ? (
        <article className="mt-8 rounded-card border border-border bg-surface p-6 sm:p-10">
          <h1 className="break-words font-display text-display font-bold">
            {post.title}
          </h1>
          <div className="mt-6 flex items-center gap-3">
            <Avatar role={post.authorRole} />
            <div className="min-w-0">
              <p className="break-words font-semibold">
                {post.authorName}
              </p>
              <time dateTime={post.createdAt} className="text-sm text-foreground-muted">
                {formatPostDate(post.createdAt)}
              </time>
            </div>
          </div>
          <p className="mt-8 whitespace-pre-wrap break-words text-lg leading-relaxed">
            {post.content}
          </p>
          {manageable && (
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to={`/edit/${post.id}`} className={buttons.secondary}>
                Edit
              </Link>
              <button type="button" onClick={deletePost} className={`${buttons.secondary} text-error`}>
                Delete
              </button>
            </div>
          )}
        </article>
      ) : (
        <h1 className="mt-8 font-display text-3xl font-bold">
          Post not found
        </h1>
      )}
    </main>
  );
}
ReadBlog.propTypes = { session: sessionType, posts: PropTypes.arrayOf(postType) };
