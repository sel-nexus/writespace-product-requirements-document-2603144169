/** Display the authenticated local collection with safe empty and failed-read states. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BlogCard, postType, sessionType } from '../components/BlogCard.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { getPosts } from '../utils/storage.js';
import { newestFirst } from '../utils/posts.js';
import { buttons } from '../utils/ui.js';

/** Hydrate current storage on entry unless a complete collection is supplied.
 * Args:
 *   session: Shell identity for owner/admin edit affordances.
 *   posts: Optional validated collection for prop-driven composition.
 * Returns:
 *   A responsive newest-first list or the exact empty message and Write action.
 */
export default function Home({ session = null, posts }) {
  const [postsRead, setPostsRead] = useState(null);
  useEffect(() => {
    if (posts === undefined) setPostsRead(getPosts());
  }, [posts]);
  const ordered = newestFirst(posts === undefined ? (postsRead?.value || []) : posts);
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <h1 className="font-display text-display font-bold">
          All Blogs
        </h1>
        <Link to="/write" className={buttons.primary}>
          Write
        </Link>
      </header>
      {posts === undefined && (
        <StorageWarning result={postsRead} />
      )}
      {ordered.length > 0 ? (
        <section aria-label="Blog posts" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ordered.map((post, index) => (
            <BlogCard key={post.id} post={post} session={session} index={index} />
          ))}
        </section>
      ) : (
        <p className="rounded-card border border-border bg-surface p-8 text-foreground-muted">
          No blogs yet. Be the first to write one!
        </p>
      )}
    </main>
  );
}
Home.propTypes = { session: sessionType, posts: PropTypes.arrayOf(postType) };
