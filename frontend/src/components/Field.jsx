/** Render a labelled control with stable error and helper associations. */
import PropTypes from 'prop-types';
import { input } from '../utils/ui.js';

/** Associate a required field with its current inline feedback.
 * Args:
 *   props: Label, controlled value and input behavior from the owning form.
 * Returns:
 *   A native input with accessible error feedback.
 */
export function Field({ id, label, error, hint, type = 'text', required = true, ...props }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        {...props}
        id={id}
        name={id}
        type={type}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-foreground-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
Field.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  error: PropTypes.string,
  hint: PropTypes.string,
  type: PropTypes.string,
  required: PropTypes.bool,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
