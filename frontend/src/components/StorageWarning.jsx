/** Surface local persistence failures without exposing private stored values. */
import PropTypes from 'prop-types';

/** Explain a failed read or observed non-persistence without claiming data loss. */
export function StorageWarning({ result, children }) {
  if (!children && (!result || result.ok)) return null;
  const message = result?.error === 'invalid_data'
    ? 'Local data could not be read because it is invalid. Existing data is unchanged; changes are disabled.'
    : 'Local storage is unavailable. Existing data is unchanged; changes are disabled.';
  return (
    <div role="alert" className="rounded-control border border-warning/30 bg-warning-light p-4 text-sm text-warning">
      {children || message}
    </div>
  );
}
StorageWarning.propTypes = {
  result: PropTypes.shape({ ok: PropTypes.bool.isRequired, error: PropTypes.string }),
  children: PropTypes.node,
};
