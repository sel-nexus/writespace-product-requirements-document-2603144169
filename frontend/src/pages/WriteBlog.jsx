/** Author plain-text local posts with fresh authorization on every save. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Field } from '../components/Field.jsx';
import { StorageWarning } from '../components/StorageWarning.jsx';
import { postType, sessionType } from '../components/BlogCard.jsx';
import { canManagePost } from '../utils/auth.js';
import { getPosts, getSession } from '../utils/storage.js';
import { createPost, updatePost } from '../utils/postActions.js';
import { buttons, input } from '../utils/ui.js';

const failures = {
  read_failed: 'Post could not be saved because local data could not be read. Existing data is unchanged.',
  permission_denied: 'You no longer have permission to save this post. Nothing was saved.',
  not_found: 'Post not found. Nothing was saved.',
  generation_failed: 'Post could not be prepared. Nothing was saved. Please try again.',
  write_failed: 'Post could not be saved. Local storage is unavailable. Please try again.',
};

/** Hydrate create/edit mode without exposing unauthorized edit fields.
 * Args:
 *   session: Shell display identity, never trusted for persistence.
 *   posts: Optional display collection; actual storage governs hydration and saves.
 *   mode: Create or edit workflow selected by the route.
 * Returns:
 *   An accessible draft form, a safe warning, or a redirect without a form.
 */
export default function WriteBlog({ session = null, posts, mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState({ title: '', content: '' });
  const [errors, setErrors] = useState({});
  const [reads, setReads] = useState(null);
  const [failure, setFailure] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const current = { session: getSession(), posts: getPosts() };
    setReads(current);
    setReady(false);
    setErrors({});
    setFailure('');
    setBlocked(false);
    setValues({ title: '', content: '' });
    if (!current.session.ok || !current.posts.ok) return;
    const post = current.posts.value.find((row) => row.id === id);
    if (!current.session.value || (mode === 'edit' && !canManagePost(current.session.value, post))) {
      navigate('/blogs', { replace: true });
      return;
    }
    if (mode === 'edit') setValues({ title: post.title, content: post.content });
    setReady(true);
  }, [id, mode, navigate, session, posts]);

  /** Keep exact draft text and stable native control identity. */
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Save only after helper success; retain drafts and focus inline invalid fields. */
  function submit(event) {
    event.preventDefault();
    if (!ready || blocked) return;
    setFailure('');
    const result = mode === 'edit' ? updatePost(id, values) : createPost(values);
    setErrors(result.errors || {});
    if (!result.ok) {
      if (result.errors) document.getElementById(Object.keys(result.errors)[0])?.focus();
      else setFailure(failures[result.error]);
      if (result.error === 'read_failed') setBlocked(true);
      return;
    }
    navigate(`/blog/${result.post.id}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <h1 className="font-display text-display font-bold">
        {mode === 'edit' ? 'Edit post' : 'Write a post'}
      </h1>
      {reads && (
        <>
          <StorageWarning result={reads.session} />
          <StorageWarning result={reads.posts} />
        </>
      )}
      {ready && (
        <form
          aria-label={mode === 'edit' ? 'Edit post' : 'Create post'}
          onSubmit={submit}
          noValidate
          className="mt-8 space-y-6 rounded-card border border-border bg-surface p-6 shadow-editorial sm:p-9"
        >
          <p className="text-sm text-foreground-muted">
            Title and content are required. Posts are saved only in this browser.
          </p>
          <Field id="title" label="Title" value={values.title} onChange={change} error={errors.title} />
          <div className="space-y-2">
            <label htmlFor="content" className="block text-sm font-semibold">
              Content
            </label>
            <textarea
              id="content"
              name="content"
              value={values.content}
              onChange={change}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.content)}
              aria-describedby={errors.content ? 'content-counter content-error' : 'content-counter'}
              className={`${input} min-h-64 resize-y leading-relaxed`}
              disabled={blocked}
            />
            <p id="content-counter" aria-live="polite" className="text-sm tabular-nums text-foreground-muted">
              {values.content.length} characters
            </p>
            {errors.content && (
              <p id="content-error" role="alert" className="text-sm font-semibold text-error">
                {errors.content}
              </p>
            )}
          </div>
          {failure && (
            <p role="alert" className="rounded-control border border-error/30 bg-error-light p-4 text-error">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            <button type="submit" disabled={blocked} className={buttons.primary}>
              {mode === 'edit' ? 'Save changes' : 'Publish post'}
            </button>
            <Link to={mode === 'edit' ? `/blog/${id}` : '/blogs'} className={buttons.secondary}>
              Cancel
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
WriteBlog.propTypes = {
  session: sessionType,
  posts: PropTypes.arrayOf(postType),
  mode: PropTypes.oneOf(['create', 'edit']),
};
