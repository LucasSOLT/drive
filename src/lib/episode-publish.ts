/**
 * Per-episode Go Live / Take Offline rules for official series.
 *
 * Episode order rule: an episode can only go live once every earlier episode in the series is live,
 * so readers and squads never hit a gap (Ep 1 live, Ep 2 offline, Ep 3 live).
 * Taking an episode offline therefore also takes every LATER live episode offline.
 *
 * Pure functions (no DOM, no network) so they can be unit-tested.
 */
import { isEpisodeLive, type EpisodeStatusLike } from './episode-visibility.ts';

export type PublishableEpisode = EpisodeStatusLike & { id: string; episodeNumber?: number | null };

/** True when the episode is archived (archived episodes are not offered Go Live). */
export function isEpisodeArchived(ep: EpisodeStatusLike): boolean {
  return ep.status === 'archived' || ep.officialStatus === 'archived';
}

/** Episodes sorted by episode number (stable; missing numbers keep their list position). */
export function sortEpisodes<T extends PublishableEpisode>(group: T[]): T[] {
  return group
    .map((ep, i) => ({ ep, i, n: ep.episodeNumber || i + 1 }))
    .sort((a, b) => (a.n - b.n) || (a.i - b.i))
    .map(x => x.ep);
}

/** Display number for an episode inside its group. */
export function episodeNumberOf<T extends PublishableEpisode>(ep: T, group: T[]): number {
  if (ep.episodeNumber) return ep.episodeNumber;
  const idx = sortEpisodes(group).findIndex(e => e.id === ep.id);
  return idx >= 0 ? idx + 1 : 1;
}

/** Earlier episodes that are NOT live. Non-empty means `ep` can't go live yet (order rule). */
export function earlierNotLive<T extends PublishableEpisode>(ep: T, group: T[]): T[] {
  const sorted = sortEpisodes(group);
  const idx = sorted.findIndex(e => e.id === ep.id);
  if (idx <= 0) return [];
  return sorted.slice(0, idx).filter(e => !isEpisodeLive(e));
}

/** Later episodes that ARE live. Taking `ep` offline must take these offline too (order rule). */
export function laterLive<T extends PublishableEpisode>(ep: T, group: T[]): T[] {
  const sorted = sortEpisodes(group);
  const idx = sorted.findIndex(e => e.id === ep.id);
  if (idx < 0) return [];
  return sorted.slice(idx + 1).filter(e => isEpisodeLive(e));
}

/** "Episode 1", "Episodes 1 and 2", "Episodes 1, 2 and 4". */
export function listEpisodeNames<T extends PublishableEpisode>(eps: T[], group: T[]): string {
  const nums = eps.map(e => episodeNumberOf(e, group));
  if (nums.length === 0) return '';
  if (nums.length === 1) return `Episode ${nums[0]}`;
  return `Episodes ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`;
}

/** The order-rule checklist line shown in the Go Live checklist for a single episode. */
export function orderRuleCheck<T extends PublishableEpisode>(ep: T, group: T[]): {
  id: string; label: string; status: 'pass' | 'fail'; detail: string;
} {
  const blockers = earlierNotLive(ep, group);
  if (blockers.length === 0) {
    return {
      id: 'episode-order',
      label: 'Episode Order',
      status: 'pass',
      detail: episodeNumberOf(ep, group) === 1 ? 'This is the first episode.' : 'All earlier episodes are live.',
    };
  }
  const names = listEpisodeNames(blockers, group);
  return {
    id: 'episode-order',
    label: 'Episode Order',
    status: 'fail',
    detail: `${names} must be live first. Episodes go live in order so readers never hit a gap.`,
  };
}

// ─── Series-level Go Live / Take Offline ───

export type SeriesRowState = 'live' | 'ready' | 'blocked';

export interface SeriesGoLiveRow<T> {
  ep: T;
  number: number;
  state: SeriesRowState;
  /** Why it can't go live (empty unless blocked). */
  reasons: string[];
}

export interface SeriesGoLivePlan<T> {
  rows: SeriesGoLiveRow<T>[];
  total: number;
  /** Episodes that will be live after confirming (already live + ready). */
  ableCount: number;
  /** Episodes that the Go Live button will publish now. */
  toPublish: T[];
  blocked: T[];
  alreadyLive: number;
}

/**
 * Plan a series-tile Go Live.
 * `requirementFailures(ep)` returns the failing requirement messages for one episode (empty = passes).
 * Order rule: an episode is only ready if every earlier episode is live or ready, so a failing
 * Episode 2 also holds back Episode 3.
 */
export function planSeriesGoLive<T extends PublishableEpisode>(
  group: T[],
  requirementFailures: (ep: T) => string[],
): SeriesGoLivePlan<T> {
  const sorted = sortEpisodes(group);
  const rows: SeriesGoLiveRow<T>[] = [];
  let chainOk = true;
  let firstBroken: number | null = null;
  for (const ep of sorted) {
    const number = episodeNumberOf(ep, sorted);
    if (isEpisodeLive(ep)) {
      rows.push({ ep, number, state: 'live', reasons: [] });
      continue;
    }
    const reasons: string[] = [];
    if (isEpisodeArchived(ep)) reasons.push('Archived. Restore it first.');
    else reasons.push(...requirementFailures(ep));
    if (reasons.length === 0 && !chainOk) {
      reasons.push(`Episode ${firstBroken} has to go live first.`);
    }
    if (reasons.length === 0) {
      rows.push({ ep, number, state: 'ready', reasons });
    } else {
      rows.push({ ep, number, state: 'blocked', reasons });
      if (chainOk) { chainOk = false; firstBroken = number; }
    }
  }
  const toPublish = rows.filter(r => r.state === 'ready').map(r => r.ep);
  const blocked = rows.filter(r => r.state === 'blocked').map(r => r.ep);
  const alreadyLive = rows.filter(r => r.state === 'live').length;
  return { rows, total: rows.length, ableCount: alreadyLive + toPublish.length, toPublish, blocked, alreadyLive };
}

/** Series badge text: AWAITING (none live), LIVE (single episode), ALL LIVE, or LIVE · 1/3 episodes. */
export function seriesBadge<T extends PublishableEpisode>(group: T[]): { label: string; live: boolean } {
  const active = group.filter(e => !isEpisodeArchived(e));
  const liveCount = active.filter(e => isEpisodeLive(e)).length;
  const total = active.length;
  if (liveCount === 0) return { label: '🟡 AWAITING', live: false };
  if (total <= 1) return { label: '🟢 LIVE', live: true };
  if (liveCount === total) return { label: '🟢 ALL LIVE', live: true };
  return { label: `🟢 LIVE · ${liveCount}/${total} episodes`, live: true };
}