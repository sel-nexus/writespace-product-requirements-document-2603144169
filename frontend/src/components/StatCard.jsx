/** Present a sourced count or an explicitly unresolved statistic without inventing a measure. */
import PropTypes from 'prop-types';

const accents = {
  indigo: 'border-t-primary-600',
  violet: 'border-t-secondary-600',
  pink: 'border-t-accent-pink',
  teal: 'border-t-accent-teal',
};

/** Render a labeled statistic and optional visible explanation.
 * @param {object} props Statistic presentation values.
 * @param {string} props.label Exact source label, including its casing.
 * @param {number|string} props.value Successful count or an unresolved question mark.
 * @param {string} [props.note] Visible ambiguity or counting-policy explanation.
 * @param {string} [props.accent] Supplied brand accent for the card edge.
 * @returns {JSX.Element} A semantic description list with no action or storage effects.
 */
export function StatCard({ label, value, note = '', accent = 'indigo' }) {
  return (
    <div className={`min-w-0 rounded-card border border-border border-t-4 bg-surface p-6 ${accents[accent]}`}>
      <dl>
        <dt className="font-semibold text-foreground-muted">
          {label}
        </dt>
        <dd className="mt-3 text-4xl font-bold tabular-nums">
          {value}
        </dd>
      </dl>
      {note && (
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          {note}
        </p>
      )}
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  note: PropTypes.string,
  accent: PropTypes.oneOf(Object.keys(accents)),
};
