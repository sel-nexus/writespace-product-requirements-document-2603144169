/** Order complete local posts and format their browser-local publication dates. */

/** Return newest posts first without changing the collection or equal-date order.
 * Args:
 *   posts: Successfully validated post collection.
 * Returns:
 *   A new array retaining source order for equal creation timestamps.
 */
export function newestFirst(posts) {
  return posts.map((post, index) => ({ post, index }))
    .sort((a, b) => Date.parse(b.post.createdAt) - Date.parse(a.post.createdAt) || a.index - b.index)
    .map(({ post }) => post);
}

/** Format a canonical timestamp in the current browser's local calendar.
 * Args:
 *   timestamp: Validated creation timestamp.
 * Returns:
 *   An English abbreviated month, two-digit day and full year.
 */
export function formatPostDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  });
}
