/**
 * Which episodes the PUBLIC is allowed to see.
 *
 * Rule: an official episode is public only while it is LIVE. Drafts, archived and
 * under-review episodes are visible only to admins (in previews / the dashboard).
 * Pure functions (no DOM, no network) so they can be unit-tested.
 */

export interface EpisodeStatusLike {
  officialStatus?: string | null;
  status?: string | null;
}

/** True when the episode is published (Live). */
export function isEpisodeLive(ep: EpisodeStatusLike): boolean {
  return ep.officialStatus === 'live' || ep.status === 'live';
}

/**
 * Keep only the episodes a viewer should see.
 * `alwaysInclude` lets the episode currently being read stay in the list (so "which one am I on?" still works).
 */
export function visibleEpisodes<T extends EpisodeStatusLike & { id: string }>(
  episodes: T[],
  includeNonLive: boolean,
  alwaysInclude?: string | null,
): T[] {
  if (includeNonLive) return episodes;
  return episodes.filter(e => isEpisodeLive(e) || (!!alwaysInclude && e.id === alwaysInclude));
}

/**
 * Can this viewer open this episode in the reader?
 * - Non-official stories (user stories) and legacy items with no status are not handled here: allowed.
 * - Official episodes that are not Live: admins only.
 */
export function canViewerOpenEpisode(
  ep: EpisodeStatusLike & { isOfficial?: boolean },
  isAdmin: boolean,
): boolean {
  if (!ep.isOfficial) return true;
  if (!ep.officialStatus && !ep.status) return true;
  return isEpisodeLive(ep) || isAdmin;
}

/**
 * Which episode "Continue" should open, given saved reading progress and the LIVE episodes.
 * - The saved episode, if it is still live.
 * - Otherwise the last live episode at or before the saved episode number (progress pointed at an
 *   episode that has since gone offline).
 * - Otherwise the first live episode. Null if nothing is live.
 */
export function pickResumeEpisode<T extends { id: string; episodeNumber?: number | null }>(
  liveEpisodes: T[],
  lastEpisodeId: string | null | undefined,
  lastEpisodeNumber: number | null | undefined,
): T | null {
  if (liveEpisodes.length === 0) return null;
  const exact = liveEpisodes.find(e => e.id === lastEpisodeId);
  if (exact) return exact;
  const sorted = [...liveEpisodes].sort((a, b) => (a.episodeNumber || 1) - (b.episodeNumber || 1));
  if (lastEpisodeNumber) {
    let best: T | null = null;
    for (const e of sorted) if ((e.episodeNumber || 1) <= lastEpisodeNumber) best = e;
    if (best) return best;
  }
  return sorted[0];
}
