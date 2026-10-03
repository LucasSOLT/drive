/**
 * Admin skip helpers shared by the reader, squad gate modal, SPARC checkpoint and squad lobby.
 * Admins see every barrier exactly as users do, plus an "Admin skip" button that lets them read the
 * story solo. Nothing here touches squads, sessions, credits or SPARC responses.
 */
import { supabase } from './supabase.ts';
import { navigate } from '../router.ts';
import { hasAdminPrivileges } from './db.ts';
import { activateAdminSkip } from './reader-mode.ts';
import { leaveReader } from './reader-origin.ts';

/** Shared markup for the amber, dashed "Admin skip" button used on every barrier. */
export function adminSkipButtonHtml(id: string, label = 'Admin skip'): string {
  if (!hasAdminPrivileges()) return '';
  return `<button id="${id}" type="button" class="admin-skip-btn" style="width:100%; margin-top:10px; padding:10px 14px; background:none; border:1.5px dashed #f59e0b; color:#f59e0b; border-radius:12px; font-size:0.82rem; font-weight:700; cursor:pointer;">🛡️ ${label}</button>`;
}

/** Id of the next episode of a story group after `afterEpisode` (drafts included), or null if none. */
export async function findNextEpisodeId(storyGroupId: string, afterEpisode: number): Promise<string | null> {
  const { data } = await supabase
    .from('official_stories')
    .select('id')
    .eq('story_group_id', storyGroupId)
    .gt('episode_number', afterEpisode)
    .is('deleted_at', null)
    .order('episode_number', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Turn on admin skip for this story and continue solo: the next episode if there is one,
 * otherwise leave the reader back to where the admin came from.
 * Returns 'denied' for non-admins (nothing happens).
 */
export async function adminSkipToNextEpisode(
  storyGroupId: string,
  currentEpisode: number,
): Promise<'next' | 'finished' | 'denied'> {
  if (!hasAdminPrivileges()) return 'denied';
  activateAdminSkip(storyGroupId);
  const nextId = await findNextEpisodeId(storyGroupId, currentEpisode);
  if (nextId) {
    navigate('story/' + nextId);
    return 'next';
  }
  leaveReader();
  return 'finished';
}
