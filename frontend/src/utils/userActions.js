/** Persist explicit account actions using fresh, successful local reads. */
import { isAdmin, validateNewUser } from './auth.js';
import { getSession, getUsers, saveUsers } from './storage.js';

/** Recognize the designated bootstrap identity without rewriting records.
 * @param {object} user Account identity to inspect.
 * @returns {boolean} Whether deletion must be prohibited.
 */
export function isBootstrapUser(user) {
  return user?.id === 'admin'
    || (typeof user?.username === 'string' && user.username.trim().toLowerCase() === 'admin');
}

/** Read both mutation prerequisites and require a current administrator.
 * Returns:
 *   Fresh session/accounts or an explicit failure; never writes.
 */
function readAccounts() {
  const sessionRead = getSession();
  const usersRead = getUsers();
  if (!sessionRead.ok) return { ok: false, error: sessionRead.error };
  if (!usersRead.ok) return { ok: false, error: usersRead.error };
  if (!isAdmin(sessionRead.value)) return { ok: false, error: 'admin_required' };
  return { ok: true, session: sessionRead.value, users: usersRead.value };
}

/** Create a validated account, retaining entered values and selected role.
 * @param {object} input Display name, username, demo password and role.
 * @returns {object} Persisted account/collection or validation/operation failure.
 * Notes:
 *   No session is changed; failed reads and writes never become success.
 */
export function createUser(input) {
  const latest = readAccounts();
  if (!latest.ok) return latest;
  const values = input && typeof input === 'object' ? input : {};
  const errors = validateNewUser(values, latest.users);
  if (Object.keys(errors).length) return { ok: false, error: 'validation', errors };
  let user;
  try {
    const id = crypto.randomUUID();
    if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      return { ok: false, error: 'identity_unavailable' };
    }
    user = {
      id, displayName: values.displayName, username: values.username,
      password: values.password, role: values.role, createdAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, error: 'identity_unavailable' };
  }
  const users = [...latest.users, user];
  const saved = saveUsers(users);
  return saved.ok ? { ok: true, user, users } : saved;
}

/** Delete an eligible account only after explicit confirmation.
 * @param {string} id Account selected by the activated control.
 * @param {boolean} confirmed Exact confirmation outcome, not a truthy substitute.
 * @returns {object} Persisted next collection or an honest failure/cancellation.
 * Notes:
 *   Reads and protections are repeated after confirmation, not from page cache.
 */
export function deleteUser(id, confirmed = false) {
  if (confirmed !== true) return { ok: false, error: 'canceled' };
  const latest = readAccounts();
  if (!latest.ok) return latest;
  const user = latest.users.find((row) => row.id === id);
  if (id === 'admin' || isBootstrapUser(user)) return { ok: false, error: 'bootstrap_protected' };
  if (id === latest.session.userId) return { ok: false, error: 'self_protected' };
  if (!user) return { ok: false, error: 'not_found' };
  const users = latest.users.filter((row) => row.id !== id);
  const saved = saveUsers(users);
  return saved.ok ? { ok: true, users } : saved;
}
