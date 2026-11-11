/**
 * Completeness marker for the Worker edge cache (`lib/cloudflare/edge-cache.ts`,
 * `EDGE_CACHE_MARKER`). Render it only when the page was built entirely from data
 * fetched in this request: the edge cache stores HTML only when it finds this
 * element, so fallbacks, error boundaries and loading states stay uncached.
 * Hidden and empty, it carries no data and is inert for readers and crawlers.
 */
export function EdgeCacheable(): React.JSX.Element {
  return <div hidden data-edge-cache="complete" />;
}
