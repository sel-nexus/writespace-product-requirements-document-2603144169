/** Apply pure local demo identity rules without treating them as security. */

/** Build the shared comparison key while retaining original display values. */
function usernameKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Detect blank or non-text form values without coercion. */
function blank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

/** Recognize both explicit admin spellings without rewriting stored roles. */
export function isAdmin(session) {
  return session?.role === 'admin' || session?.role === 'Admin';
}

/** Choose the role destination, returning the public root for a guest. */
export function homeFor(session) {
  return session ? (isAdmin(session) ? '/admin' : '/blogs') : '/';
}

/** Validate account fields and reserve the bootstrap username.
 * Args:
 *   input: Entered account values, including the selected role.
 *   users: Successfully read complete account collection.
 * Returns:
 *   Field errors; an empty object permits creation.
 * Notes:
 *   Uniqueness is case-insensitive, but no value is changed for storage.
 */
export function validateNewUser(input, users) {
  const errors = {};
  for (const field of ['displayName', 'username', 'password', 'role']) {
    if (blank(input[field])) errors[field] = 'Required';
  }
  if (!errors.username) {
    const key = usernameKey(input.username);
    if (key === 'admin' || users.some((user) => usernameKey(user.username) === key)) {
      errors.username = 'Already exists';
    }
  }
  if (!errors.role && !['user', 'admin', 'Admin'].includes(input.role)) errors.role = 'Invalid role';
  return errors;
}

/** Require every registration field and matching exact passwords. */
export function validateRegistration(input, users) {
  const errors = validateNewUser({ ...input, role: 'user' }, users);
  if (blank(input.confirmPassword)) errors.confirmPassword = 'Required';
  else if (input.password !== input.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

/** Authenticate a normalized username and exact password using synthetic local data.
 * Args:
 *   username: Entered identity; surrounding spaces and case are ignored for lookup.
 *   password: Exact plaintext demo password; never trim or log it.
 *   users: Successfully read account records for non-bootstrap lookup.
 * Returns:
 *   A complete source-preserving session or invalid_credentials.
 */
export function authenticate(username, password, users) {
  const key = usernameKey(username);
  if (key === 'admin' && password === 'admin') {
    return { ok: true, session: { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' } };
  }
  const user = key && users.find((row) => usernameKey(row.username) === key && row.password === password);
  if (!user) return { ok: false, error: 'invalid_credentials' };
  return {
    ok: true,
    session: { userId: user.id, username: user.username, displayName: user.displayName, role: user.role },
  };
}

/** Permit a present post's owner or an admin; reject missing identities/resources. */
export function canManagePost(session, post) {
  return Boolean(session && post && (isAdmin(session) || post.authorId === session.userId));
}
