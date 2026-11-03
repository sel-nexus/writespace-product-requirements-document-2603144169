/** Apply browser-local route boundaries without claiming trusted authorization. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { homeFor, isAdmin } from '../utils/auth.js';

/** Render children or redirect guests and incompatible roles to their entry/home. */
export function ProtectedRoute({ session, adminOnly = false, guestOnly = false, children }) {
  if (guestOnly) return session ? <Navigate to={homeFor(session)} replace /> : children;
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin(session)) return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = {
  session: PropTypes.shape({ role: PropTypes.string.isRequired }),
  adminOnly: PropTypes.bool,
  guestOnly: PropTypes.bool,
  children: PropTypes.node.isRequired,
};
