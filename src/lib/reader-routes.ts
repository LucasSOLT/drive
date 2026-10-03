/** Pure route helpers for reader-origin tracking (no browser or router dependencies). */

/** Routes that belong to the reader family (hopping between them never changes the origin). */
export const READER_ROUTES = new Set(['story', 'sparc', 'squad-lobby']);

/** Screens that make no sense to "go back" to from the reader. */
const NON_RETURN_ROUTES = new Set(['login', 'signup', 'beta', 'join', 'add-friend', '']);

export function baseOf(route: string): string {
  return route.split('?')[0].split('/')[0];
}

export function routeFromUrl(url: string): string {
  const i = url.indexOf('#');
  return i === -1 ? '' : url.substring(i + 1);
}

/**
 * Given a route transition, return the new reader origin to remember, or null to keep the current one.
 * Only a transition INTO the reader family from OUTSIDE it (and from a screen worth returning to) counts.
 */
export function originForTransition(oldRoute: string, newRoute: string): string | null {
  const oldBase = baseOf(oldRoute);
  const newBase = baseOf(newRoute);
  if (READER_ROUTES.has(newBase) && !READER_ROUTES.has(oldBase) && !NON_RETURN_ROUTES.has(oldBase)) {
    return oldRoute;
  }
  return null;
}

/** Where the back caret should go for a stored origin (null/invalid -> home). */
export function resolveLeaveTarget(origin: string | null): string {
  return origin && !READER_ROUTES.has(baseOf(origin)) ? origin : 'home';
}
