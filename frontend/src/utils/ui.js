/** Share control states without introducing a component catalogue. */
export const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
export const buttons = {
  primary: `inline-flex min-h-11 items-center justify-center rounded-control bg-primary-600 px-5 py-3 font-semibold text-surface shadow-sm hover:bg-primary-700 active:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors motion-safe:duration-gentle ${focus}`,
  secondary: `inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-5 py-3 font-semibold text-primary-700 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
};
export const input = `w-full min-w-0 rounded-control border border-border bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
export const link = `rounded text-primary-700 underline decoration-primary-300 underline-offset-4 hover:text-primary-900 ${focus}`;
