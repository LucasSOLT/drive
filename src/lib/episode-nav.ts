/**
 * Episode navigation helpers for the story editor.
 *
 * Pure functions (no DOM, no network) so they can be unit-tested.
 * The editor uses these to decide which "Previous Episode" / "Next Episode"
 * buttons are enabled and which story id they open.
 */

export interface EpisodeLike {
  id: string;
  storyGroupId?: string | null;
  episodeNumber?: number | null;
  episodeTitle?: string | null;
  title?: string;
}

export interface EpisodeRef {
  id: string;
  episodeNumber: number;
  title: string;
}

export interface EpisodeNeighbors {
  prev: EpisodeRef | null;
  next: EpisodeRef | null;
}

export const NO_NEIGHBORS: EpisodeNeighbors = { prev: null, next: null };

function epNum(s: EpisodeLike): number {
  return s.episodeNumber || 1;
}

/**
 * Find the episode right before and right after the one being edited.
 *
 * - Only stories in the same group count.
 * - The episode being edited (currentId) is never its own neighbor.
 * - Works for a brand-new, unsaved episode too (currentId = null): the
 *   neighbors are chosen purely from its episode number.
 * - Gaps are fine (1, 2, 4 -> next of 2 is 4).
 */
export function findEpisodeNeighbors(
  stories: EpisodeLike[],
  groupId: string | null | undefined,
  currentEpisodeNumber: number,
  currentId: string | null | undefined,
): EpisodeNeighbors {
  if (!groupId) return { prev: null, next: null };

  const siblings = stories
    .filter(s => (s.storyGroupId || s.id) === groupId)
    .filter(s => s.id !== currentId)
    .sort((a, b) => epNum(a) - epNum(b));

  let prev: EpisodeLike | null = null;
  let next: EpisodeLike | null = null;
  for (const s of siblings) {
    const n = epNum(s);
    if (n < currentEpisodeNumber) prev = s;               // keeps the highest below
    else if (n > currentEpisodeNumber && !next) next = s;  // first one above
  }

  const toRef = (s: EpisodeLike | null): EpisodeRef | null =>
    s ? { id: s.id, episodeNumber: epNum(s), title: s.episodeTitle || s.title || `Episode ${epNum(s)}` } : null;

  return { prev: toRef(prev), next: toRef(next) };
}

/** Label shown on the menu button, e.g. "Next Episode (Ep. 3)". */
export function episodeNavLabel(kind: 'prev' | 'next', ref: EpisodeRef | null): string {
  const base = kind === 'prev' ? 'Previous Episode' : 'Next Episode';
  return ref ? `${base} (Ep. ${ref.episodeNumber})` : base;
}
