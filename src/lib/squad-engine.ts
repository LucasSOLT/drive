// ═══════════════════════════════════════════════════════════
// DRiVE Squad Engine
// Central orchestration for squad episode progression,
// 48-hour timer logic, and SPARC checkpoint gating.
// ═══════════════════════════════════════════════════════════

import type { SquadSession } from '../types.ts';
import {
  getSquadSession,
  advanceSquadToNextEpisode,
  checkAllSparcCompleted,
  hasUserCompletedSparc,
  updateSquadSessionStatus,
} from './db.ts';

/** 48 hours in milliseconds */
const EPISODE_TIMER_MS = 48 * 60 * 60 * 1000;

// ─── Timer Utilities ───

/** Check if the 48-hour episode timer has expired */
export function isEpisodeTimerExpired(session: SquadSession): boolean {
  const startTime = new Date(session.episodeStartedAt).getTime();
  return Date.now() - startTime >= EPISODE_TIMER_MS;
}

/** Get remaining time in milliseconds for the current episode */
export function getEpisodeTimeRemaining(session: SquadSession): number {
  const startTime = new Date(session.episodeStartedAt).getTime();
  const elapsed = Date.now() - startTime;
  return Math.max(0, EPISODE_TIMER_MS - elapsed);
}

/** Format remaining time as human-readable string (e.g., "23h 14m") */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ─── Advancement Logic ───

/**
 * Determine if a squad can advance to the next episode:
 * - All members completed SPARC, OR
 * - 48h timer expired (auto-advance)
 */
export async function canSquadAdvance(
  squadId: string,
  episodeNumber: number,
  session: SquadSession
): Promise<{ canAdvance: boolean; reason: 'all_completed' | 'timer_expired' | 'waiting' }> {
  // Check if timer has expired — auto-advance
  if (isEpisodeTimerExpired(session)) {
    return { canAdvance: true, reason: 'timer_expired' };
  }

  // Check if all squad members have completed their SPARC
  const allCompleted = await checkAllSparcCompleted(squadId, episodeNumber);
  if (allCompleted) {
    return { canAdvance: true, reason: 'all_completed' };
  }

  return { canAdvance: false, reason: 'waiting' };
}

/**
 * Check if a user is "greenlit" — has submitted at least 1 SPARC response
 * for the current episode.
 */
export async function isUserGreenlit(
  squadId: string,
  userId: string,
  episodeNumber: number
): Promise<boolean> {
  return hasUserCompletedSparc(squadId, userId, episodeNumber);
}

/**
 * Attempt to advance the squad. Called when:
 * 1. A user submits a SPARC response (check if all done)
 * 2. Timer check fires (auto-advance)
 *
 * Returns the result of the advancement attempt.
 */
export async function tryAdvanceSquad(
  sessionId: string,
  squadId: string,
  episodeNumber: number
): Promise<{ advanced: boolean; nextEpisode?: number; completed?: boolean; reason?: string }> {
  const session = await getSquadSession(squadId);
  if (!session) {
    return { advanced: false, reason: 'No active session' };
  }

  // Idempotency: only advance if session is still on the expected episode
  if (session.currentEpisodeNumber !== episodeNumber) {
    console.log('Session already advanced to episode', session.currentEpisodeNumber);
    const { supabase } = await import('./supabase.ts');
    const { data } = await supabase
      .from('official_stories')
      .select('id')
      .eq('story_group_id', session.storyGroupId)
      .eq('episode_number', session.currentEpisodeNumber)
      .single();
    if (data) {
      const { navigate } = await import('../router.ts');
      navigate('story/' + data.id);
    }
    return { advanced: false, reason: 'already_advanced' };
  }

  const { canAdvance, reason } = await canSquadAdvance(squadId, episodeNumber, session);

  if (!canAdvance) {
    return { advanced: false, reason: 'waiting' };
  }

  // Advance to next episode
  const result = await advanceSquadToNextEpisode(sessionId);

  console.log(`[SquadEngine] Squad advanced: reason=${reason}, nextEpisode=${result.nextEpisode}, completed=${result.completed}`);

  return {
    advanced: true,
    nextEpisode: result.nextEpisode,
    completed: result.completed,
    reason,
  };
}

/**
 * Get the total episode count for a story group by querying official_stories.
 */
export async function getStoryGroupEpisodeCount(storyGroupId: string): Promise<number> {
  // Import supabase directly to avoid circular dependency issues
  const { supabase } = await import('./supabase.ts');

  const { count, error } = await supabase
    .from('official_stories')
    .select('id', { count: 'exact', head: true })
    .eq('story_group_id', storyGroupId);

  if (error) {
    console.error('[SquadEngine] Error counting episodes:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Get the soloEpisodeCount for a story group
 * (reads from Episode 1 of the group, which is where this setting lives).
 */
export async function getSoloEpisodeCount(storyGroupId: string): Promise<number> {
  const { supabase } = await import('./supabase.ts');

  const { data, error } = await supabase
    .from('official_stories')
    .select('solo_episode_count')
    .eq('story_group_id', storyGroupId)
    .eq('episode_number', 1)
    .single();

  if (error) {
    console.warn('[SquadEngine] Could not fetch soloEpisodeCount, defaulting to 1:', error);
    return 1;
  }

  return data?.solo_episode_count || 1;
}
