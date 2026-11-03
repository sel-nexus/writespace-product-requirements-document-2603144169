/** Validate plain-text drafts and mutate only freshly read local records. */
import { canManagePost } from './auth.js';
import { getPosts, getSession, savePosts } from './storage.js';

/** Validate required draft text without coercing or changing entered whitespace.
 * @param {object} input Entered title and content; author fields are ignored.
 * @returns {object} Field errors, empty when the draft is valid.
 */
export function validatePost(input) {
  const errors = {};
  for (const field of ['title', 'content']) {
    if (typeof input?.[field] !== 'string' || !input[field].trim()) errors[field] = 'Required';
  }
  return errors;
}

/** Read both mutation prerequisites without replacing failed fallback values.
 * @returns {object} Latest session and posts, or a fail-closed operation error.
 */
function latest() {
  const session = getSession();
  const posts = getPosts();
  if (!session.ok || !posts.ok) return { ok: false, error: 'read_failed' };
  return { ok: true, session: session.value, posts: posts.value };
}

/** Create a UUID post with authorship taken exclusively from the latest session.
 * @param {object} input Required title and content, preserved exactly.
 * @returns {object} Persisted post or validation, read, permission, generation or write error.
 * Notes:
 *   A missing posts key is a valid empty collection; a missing session is not authorization.
 */
export function createPost(input) {
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { ok: false, error: 'validation', errors };
  let id;
  let timestamp;
  try {
    id = crypto.randomUUID();
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { ok: false, error: 'generation_failed' };
    }
    timestamp = new Date().toISOString();
  } catch {
    return { ok: false, error: 'generation_failed' };
  }
  const current = latest();
  if (!current.ok) return current;
  if (!current.session) return { ok: false, error: 'permission_denied' };
  if (current.posts.some((post) => post.id === id)) return { ok: false, error: 'generation_failed' };
  const post = {
    id, title: input.title, content: input.content,
    authorId: current.session.userId,
    authorName: current.session.displayName,
    authorRole: current.session.role,
    createdAt: timestamp, updatedAt: timestamp,
  };
  if (!savePosts([post, ...current.posts]).ok) return { ok: false, error: 'write_failed' };
  return { ok: true, post };
}

/** Update only draft text and modification time on the latest authorized record.
 * @param {string} id Route identity to resolve in current storage.
 * @param {object} input Required title and content; supplied metadata is ignored.
 * @returns {object} Persisted post or an explicit failure without writes.
 */
export function updatePost(id, input) {
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { ok: false, error: 'validation', errors };
  let timestamp;
  try {
    timestamp = new Date().toISOString();
  } catch {
    return { ok: false, error: 'generation_failed' };
  }
  const current = latest();
  if (!current.ok) return current;
  const original = current.posts.find((post) => post.id === id);
  if (!original) return { ok: false, error: 'not_found' };
  if (!canManagePost(current.session, original)) return { ok: false, error: 'permission_denied' };
  const post = { ...original, title: input.title, content: input.content, updatedAt: timestamp };
  const posts = current.posts.map((row) => row.id === id ? post : row);
  if (!savePosts(posts).ok) return { ok: false, error: 'write_failed' };
  return { ok: true, post };
}

/** Remove a latest authorized record only after the caller obtains UI confirmation.
 * @param {string} id Target identity, never a stale display record.
 * @returns {object} Success or read, missing, permission or write failure.
 * Notes:
 *   This helper does not prompt; canceled UI confirmations must never call it.
 */
export function deletePost(id) {
  const current = latest();
  if (!current.ok) return current;
  const post = current.posts.find((row) => row.id === id);
  if (!post) return { ok: false, error: 'not_found' };
  if (!canManagePost(current.session, post)) return { ok: false, error: 'permission_denied' };
  if (!savePosts(current.posts.filter((row) => row.id !== id)).ok) return { ok: false, error: 'write_failed' };
  return { ok: true };
}
