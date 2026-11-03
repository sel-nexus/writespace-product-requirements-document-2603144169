/** Offer an explicitly activated, transient appearance change. */
import PropTypes from 'prop-types';

/** Render a native button naming the destination appearance.
 * Args:
 *   theme: Current App-owned appearance.
 *   onToggle: Transition callback invoked only on activation.
 * Returns:
 *   A visible, keyboard-operable appearance control.
 */
export function ThemeToggle({ theme, onToggle }) {
  const destination = theme === 'light' ? 'Dark' : 'Light';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${destination} appearance`}
      className="min-h-11 rounded-control border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {destination} appearance
    </button>
  );
}
ThemeToggle.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  onToggle: PropTypes.func.isRequired,
};
