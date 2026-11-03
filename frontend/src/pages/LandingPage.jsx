/** Introduce browser-local writing with read-only, real post previews. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getPosts } from '../utils/storage.js';
import { homeFor } from '../utils/auth.js';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { buttons, focus } from '../utils/ui.js';

const notice = 'Local-only demo: data and authentication are client-side. Credentials are stored in plain text. '
  + 'There is no backend, database, or network service. Do not use real or sensitive credentials.';
const features = [
  { title: 'Write Freely', body: 'Plain-text writing, no distractions.', accent: 'border-primary-600' },
  { title: 'Private & Local', body: 'Data lives in your browser.', accent: 'border-accent-pink' },
  { title: 'Instant & Fast', body: 'No server, no lag.', accent: 'border-accent-teal' },
];
const postType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  authorId: PropTypes.string.isRequired,
  authorName: PropTypes.string.isRequired,
  authorRole: PropTypes.string.isRequired,
  createdAt: PropTypes.string.isRequired,
  updatedAt: PropTypes.string.isRequired,
});

/** Select three newest complete posts without changing the source order.
 * Args:
 *   posts: Successfully read complete collection.
 * Returns:
 *   A copied preview preserving input order for equal timestamps.
 */
function recentPosts(posts) {
  return posts.map((post, index) => ({ post, index }))
    .sort((a, b) => Date.parse(b.post.createdAt) - Date.parse(a.post.createdAt) || a.index - b.index)
    .slice(0, 3).map(({ post }) => post);
}

/** Render the same real post card in the hero and latest collection.
 * Args:
 *   post: Complete local post to preview as plain text.
 * Returns:
 *   A reader link with capped excerpt and local browser date.
 */
function PostPreview({ post }) {
  const date = new Date(post.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  });
  return (
    <article className="h-full rounded-card border border-border border-t-4 border-t-secondary-600 bg-surface p-6">
      <Link to={`/blog/${post.id}`} className={`block rounded-control hover:text-primary-700 ${focus}`}>
        <h3 className="break-words font-display text-2xl font-bold">
          {post.title}
        </h3>
        <p className="mt-4 break-words leading-relaxed text-foreground-muted">
          {post.content.slice(0, 120)}
        </p>
        <time dateTime={post.createdAt} className="mt-6 block text-sm text-foreground-muted">
          {date}
        </time>
      </Link>
    </article>
  );
}
PostPreview.propTypes = { post: postType.isRequired };

/** Present discovery copy and hydrate posts when no collection is supplied.
 * Args:
 *   session: App-owned identity used solely for activated navigation.
 *   posts: Optional complete collection; otherwise read guarded storage.
 * Returns:
 *   Public content, failed-read feedback, safety notice and footer.
 */
export default function LandingPage({ session = null, posts }) {
  const [postsRead, setPostsRead] = useState(null);
  useEffect(() => {
    if (posts === undefined) setPostsRead(getPosts());
  }, [posts]);
  const recent = recentPosts(posts === undefined ? (postsRead?.value || []) : posts);
  return (
    <>
      <main id="main-content" className="bg-background font-sans text-foreground">
        <section aria-labelledby="landing-title" className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div className="self-center">
            <h1 id="landing-title" className="font-display text-display font-bold">
              WriteSpace
            </h1>
            <p className="mt-6 max-w-lg text-2xl leading-relaxed text-foreground-muted">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {session ? (
                <Link to={homeFor(session)} className={buttons.primary}>
                  Dashboard
                </Link>
              ) : (
                <Link to="/register" className={buttons.primary}>
                  Get Started Free
                </Link>
              )}
              <Link to={session ? '/blogs' : '/login'} className={buttons.secondary}>
                Start Reading
              </Link>
            </div>
          </div>
          {recent.length > 0 && (
            <aside
              aria-label="Featured post preview"
              className="self-center rounded-card shadow-editorial motion-safe:animate-float hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none"
            >
              <PostPreview post={recent[0]} />
            </aside>
          )}
        </section>
        <section aria-label="Features" className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-5 pb-16 sm:px-8 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className={`rounded-card border-l-4 bg-surface p-7 ${feature.accent}`}>
              <h2 className="font-display text-2xl font-bold">
                {feature.title}
              </h2>
              <p className="mt-3 leading-relaxed text-foreground-muted">
                {feature.body}
              </p>
            </article>
          ))}
        </section>
        <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <h2 id="latest-title" className="mb-8 font-display text-3xl font-bold">
            Latest from the Blog
          </h2>
          {posts === undefined && (
            <StorageWarning result={postsRead} />
          )}
          {recent.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recent.map((post) => (
                <PostPreview key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="rounded-card border border-border bg-surface p-8 text-foreground-muted">
              No posts yet — check back soon!
            </p>
          )}
        </section>
        <aside aria-label="Demo safety notice" className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
          <p className="rounded-control border border-warning/30 bg-warning-light p-5 leading-relaxed text-warning">
            {notice}
          </p>
        </aside>
      </main>
      <footer className="bg-foreground font-sans text-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-10 sm:px-8">
          <p>
            © {new Date().getFullYear()} WriteSpace
          </p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
            {[['/', 'Home'], ['/blogs', 'All Blogs'], ['/login', 'Login'], ['/register', 'Register']].map(([to, label]) => (
              <Link key={to} to={to} className={`rounded underline underline-offset-4 hover:text-primary-200 ${focus}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
LandingPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
  }),
  posts: PropTypes.arrayOf(postType),
};
