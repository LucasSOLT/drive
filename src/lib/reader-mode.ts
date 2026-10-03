/**
 * Reader modes.
 *
 * PREVIEW = the story's owner (or an admin) is looking at content that is not a live public release,
 * or opened a story via an explicit "Preview" action. Previewing is a solitary activity:
 * no squad gate, no squad timer, and SPARC checkpoints are shown as a skippable card
 * (nothing is submitted, no squad session, no completion trigger).
 */
import type { Story } from '../types.ts';
import { hasAdminPrivileges } from './db.ts';
import { getUserId } from './auth.ts';
import { getUserStoryById } from '../state.ts';
import { decidePreview, PREVIEW_FLAG_KEY } from './reader-routes.ts';

/** Call right before navigating to `story/ID` from a Preview action (admin dashboard, owner preview). */
export function markPreviewEntry(story: { id: string; storyGroupId?: string }): void {
  try { sessionStorage.setItem(PREVIEW_FLAG_KEY, story.storyGroupId || story.id); } catch { /* storage unavailable */ }
}

export function clearPreviewEntry(): void {
  try { sessionStorage.removeItem(PREVIEW_FLAG_KEY); } catch { /* storage unavailable */ }
}

/**
 * Whether the reader should treat this story as a solo preview.
 * Anyone who is not the owner or an admin never gets preview mode (they always see normal gating).
 */
export function isPreviewStory(story: Story): boolean {
  const userStory = story.isOfficial ? null : getUserStoryById(story.id);
  let flag: string | null = null;
  try { flag = sessionStorage.getItem(PREVIEW_FLAG_KEY); } catch { /* storage unavailable */ }

  return decidePreview({
    isOfficial: !!story.isOfficial,
    officialStatus: story.officialStatus,
    groupKey: story.storyGroupId || story.id,
    flag,
    admin: hasAdminPrivileges(),
    hasUserStory: !!userStory,
    isOwner: !!userStory && !!userStory.user_id && userStory.user_id === getUserId(),
  });
}
