/**
 * Reader origin tracking.
 *
 * The reader family of routes (story/, sparc/, squad-lobby/) lets people hop between episodes,
 * so `history.back()` from inside it lands on the previous EPISODE. Instead we remember the
 * screen the user was on BEFORE they entered the reader family and the back caret returns there.
 *
 * Example: Series Info -> episode 1 -> next -> episode 2 -> back caret  ==> Series Info.
 */
import { navigate } from '../router.ts';
import { originForTransition, resolveLeaveTarget, routeFromUrl } from './reader-routes.ts';

const ORIGIN_KEY = 'drive_reader_origin';

let initialized = false;

/** Call once at startup. Records where the user came from whenever they enter the reader family. */
export function initReaderOrigin(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('hashchange', (e: HashChangeEvent) => {
    const origin = originForTransition(routeFromUrl(e.oldURL), routeFromUrl(e.newURL));
    if (origin !== null) {
      try { sessionStorage.setItem(ORIGIN_KEY, origin); } catch { /* storage unavailable */ }
    }
  });

  // Inline onclick handlers inside reader markup strings call this
  (window as any).__driveLeaveReader = leaveReader;
}

export function getReaderOrigin(): string | null {
  try { return sessionStorage.getItem(ORIGIN_KEY); } catch { return null; }
}

/** Leave the reader family and return to the screen the user entered it from (else Home). */
export function leaveReader(): void {
  navigate(resolveLeaveTarget(getReaderOrigin()));
}
