/** Present the same account identity as a semantic table row or mobile card. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar.jsx';
import { formatPostDate } from '../utils/posts.js';
import { isBootstrapUser } from '../utils/userActions.js';
import { buttons } from '../utils/ui.js';

/** Render identity and an inert-until-activated eligible delete control.
 * Args:
 *   props: Account, current identity, read-only flag, layout and delete callback.
 * Returns:
 *   A desktop table row or a mobile article; never displays credentials.
 */
export function UserRow({ user, session, disabled = false, mobile = false, onDelete }) {
  const protectedAccount = isBootstrapUser(user) || user.id === session?.userId;
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={user.role} />
      <div className="min-w-0">
        <p className="break-words font-semibold">
          {user.displayName}
        </p>
        <p className="break-words text-sm text-foreground-muted">
          {user.username}
        </p>
      </div>
    </div>
  );
  const date = user.createdAt ? (
    <time dateTime={user.createdAt}>
      {formatPostDate(user.createdAt)}
    </time>
  ) : '—';
  const action = (
    <button
      type="button"
      aria-label={`Delete ${user.username}`}
      disabled={disabled || protectedAccount}
      onClick={() => onDelete(user.id)}
      className={`${buttons.secondary} text-error`}
    >
      Delete
    </button>
  );
  if (mobile) {
    return (
      <article aria-label={`Account ${user.username}`} className="rounded-card border border-border bg-surface p-5">
        {identity}
        <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-foreground-muted">
              Role
            </dt>
            <dd className="font-semibold">
              {user.role}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">
              Created
            </dt>
            <dd className="tabular-nums">
              {date}
            </dd>
          </div>
        </dl>
        {action}
      </article>
    );
  }
  return (
    <tr className="border-t border-border">
      <th scope="row" className="p-4 text-left font-normal">
        {identity}
      </th>
      <td className="p-4">
        {user.role}
      </td>
      <td className="p-4 tabular-nums">
        {date}
      </td>
      <td className="p-4 text-right">
        {action}
      </td>
    </tr>
  );
}
UserRow.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string.isRequired }),
  disabled: PropTypes.bool,
  mobile: PropTypes.bool,
  onDelete: PropTypes.func.isRequired,
};
