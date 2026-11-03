/** Guard browser-local persistence without repairing or logging stored values. */
export const STORAGE_KEYS = {
  posts: 'writespace_posts',
  users: 'writespace_users',
  session: 'writespace_session',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Check required textual values without coercion. */
function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Accept complete objects while preserving unrecognized role spellings. */
function fields(record, names) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && names.every((name) => text(record[name]));
}

/** Require an exact finite round-trip timestamp rather than a parseable date. */
function canonicalDate(value) {
  const epoch = Date.parse(value);
  return typeof value === 'string' && Number.isFinite(epoch)
    && new Date(epoch).toISOString() === value;
}

/** Permit a UUID or the designated local bootstrap identity. */
function identity(value) {
  return value === 'admin' || (typeof value === 'string' && uuid.test(value));
}

/** Validate every persisted account field without normalizing its contents. */
function validUser(user) {
  return fields(user, ['id', 'displayName', 'username', 'password', 'role', 'createdAt'])
    && identity(user.id) && canonicalDate(user.createdAt);
}

/** Validate post identity, authorship and both canonical timestamps. */
function validPost(post) {
  return fields(post, ['id', 'title', 'content', 'authorId', 'authorName', 'authorRole', 'createdAt', 'updatedAt'])
    && uuid.test(post.id) && identity(post.authorId)
    && canonicalDate(post.createdAt) && canonicalDate(post.updatedAt);
}

/** Validate a complete session including its account identity. */
function validSession(session) {
  return fields(session, ['userId', 'username', 'displayName', 'role']) && identity(session.userId);
}

/** Read one key with exact envelopes and non-destructive safe fallbacks.
 * Args:
 *   key: Browser persistence key.
 *   fallback: Safe display value for missing or failed data.
 *   validate: Complete decoded-value predicate.
 * Returns:
 *   A successful value or an explicit failure with the safe fallback.
 * Notes:
 *   Never mutate bytes or expose storage exceptions to callers.
 */
function read(key, fallback, validate) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { ok: false, value: fallback, error: 'storage_unavailable' };
  }
  if (raw === null) return { ok: true, value: fallback };
  try {
    const value = JSON.parse(raw);
    return validate(value)
      ? { ok: true, value }
      : { ok: false, value: fallback, error: 'invalid_data' };
  } catch {
    return { ok: false, value: fallback, error: 'invalid_data' };
  }
}

/** Serialize once and report observed write failure without leaking content. */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return { ok: false, error: 'storage_unavailable' };
  }
}

/** Read the complete post collection, rejecting any invalid row. */
export function getPosts() {
  return read(STORAGE_KEYS.posts, [], (rows) => Array.isArray(rows) && rows.every(validPost));
}

/** Persist the complete next post collection after the caller's successful read. */
export function savePosts(posts) {
  return write(STORAGE_KEYS.posts, posts);
}

/** Read the complete account collection, rejecting any invalid row. */
export function getUsers() {
  return read(STORAGE_KEYS.users, [], (rows) => Array.isArray(rows) && rows.every(validUser));
}

/** Persist the complete next account collection after the caller's successful read. */
export function saveUsers(users) {
  return write(STORAGE_KEYS.users, users);
}

/** Read the current complete session or a safe signed-out fallback. */
export function getSession() {
  return read(STORAGE_KEYS.session, null, validSession);
}

/** Persist a session only after successful prerequisite reads and validation. */
export function setSession(session) {
  return write(STORAGE_KEYS.session, session);
}

/** Remove only the session and never claim logout on an observed exception. */
export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.session);
    return { ok: true };
  } catch {
    return { ok: false, error: 'storage_unavailable' };
  }
}
