/** Display the source-prescribed crown/book role avatars. */
import PropTypes from 'prop-types';
import { isAdmin } from '../utils/auth.js';

const sizes = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-lg', lg: 'h-12 w-12 text-xl' };
const colors = { admin: 'bg-secondary-600', user: 'bg-primary-500' };

/** Preserve both admin spellings and safely display other roles as ordinary avatars. */
export function Avatar({ role, size = 'md' }) {
  const admin = isAdmin({ role });
  return (
    <span
      role="img"
      aria-label={admin ? 'Admin avatar' : 'User avatar'}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-surface ${sizes[size] || sizes.md} ${colors[admin ? 'admin' : 'user']}`}
    >
      {admin ? '👑' : '📚'}
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.string, size: PropTypes.oneOf(['sm', 'md', 'lg']) };
