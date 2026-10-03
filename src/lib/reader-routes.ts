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

/** sessionStorage key: storyGroupId (or story id) the user explicitly opened in Preview mode. */
export const PREVIEW_FLAG_KEY = 'drive_reader_preview';

/** True when a transition moves OUT of the reader family to a regular screen (preview flag should reset). */
export function leavesReaderFamily(oldRoute: string, newRoute: string): boolean {
  return READER_ROUTES.has(baseOf(oldRoute)) && !READER_ROUTES.has(baseOf(newRoute));
}

export interface PreviewInputs {
  isOfficial: boolean;
  officialStatus?: string;
  groupKey: string;          // storyGroupId || id
  flag: string | null;       // explicit preview flag from sessionStorage
  admin: boolean;
  hasUserStory: boolean;     // story exists in the user's own stories
  isOwner: boolean;
}

/** Pure decision: should the reader treat this story as a solo preview? */
export function decidePreview(i: PreviewInputs): boolean {
  // Explicit preview action (admin dashboard "Preview", even on a live episode)
  if (i.flag && i.flag === i.groupKey && (i.admin || i.isOwner)) return true;
  // Official episode that is not live yet: only admins reach it, always a preview
  if (i.isOfficial) return i.officialStatus !== 'live' && i.admin;
  // A story created by the user (draft / under review / their own published story)
  return i.isOwner || (i.hasUserStory && i.admin);
}
/** sessionStorage key: storyGroupId an admin chose to "Admin skip" (read solo past squad/SPARC barriers). */
export const ADMIN_SKIP_KEY = 'drive_admin_skip';

/** Pure: admin skip applies only when the stored group matches AND the user is currently an admin. */
export function adminSkipHonored(stored: string | null, groupKey: string, admin: boolean): boolean {
  return admin && !!stored && stored === groupKey;
}