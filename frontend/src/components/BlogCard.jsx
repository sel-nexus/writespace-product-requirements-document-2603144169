/** Present plain-text post previews with semantic navigation and owner controls. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { canManagePost } from '../utils/auth.js';
import { formatPostDate } from '../utils/posts.js';
import { focus, link } from '../utils/ui.js';

const accents = ['border-t-primary-600', 'border-t-secondary-600', 'border-t-accent-pink', 'border-t-accent-teal'];
export const postType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  authorId: PropTypes.string.isRequired,
  authorName: PropTypes.string.isRequired,
  authorRole: PropTypes.string.isRequired,
  createdAt: PropTypes.string.isRequired,
  updatedAt: PropTypes.string.isRequired,
});
export const sessionType = PropTypes.shape({
  userId: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  displayName: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired,
});

/** Render a reader link and a separate permitted edit link without render effects.
 * Args:
 *   post: Complete validated local post.
 *   session: Current shell identity for presentation permissions.
 *   index: Position in the sorted collection, selecting the repeating accent.
 * Returns:
 *   A post article with its exact first 120 content characters and metadata.
 */
export function BlogCard({ post, session = null, index = 0 }) {
  return (
    <article className={`flex h-full min-w-0 flex-col rounded-card border border-border border-t-4 bg-surface p-6 ${accents[index % 4]}`}>
      <Link to={`/blog/${post.id}`} className={`block rounded-control hover:text-primary-700 ${focus}`}>
        <h2 className="break-words font-display text-2xl font-bold">
          {post.title}
        </h2>
        <p className="mt-4 break-words leading-relaxed text-foreground-muted">
          {post.content.slice(0, 120)}
        </p>
      </Link>
      <div className="mt-auto flex items-center gap-3 pt-6">
        <Avatar role={post.authorRole} size="sm" />
        <div className="min-w-0 text-sm">
          <p className="break-words font-semibold">
            {post.authorName}
          </p>
          <time dateTime={post.createdAt} className="text-foreground-muted">
            {formatPostDate(post.createdAt)}
          </time>
        </div>
      </div>
      {canManagePost(session, post) && (
        <Link to={`/edit/${post.id}`} className={`${link} mt-5 self-start`}>
          Edit
        </Link>
      )}
    </article>
  );
}
BlogCard.propTypes = { post: postType.isRequired, session: sessionType, index: PropTypes.number };
