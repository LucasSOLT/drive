import type { UserStory, UserPlan, UserSubscription } from './types.ts';
import { generateUsername } from './data/usernames.ts';
import { isAuthenticated, isBetaTester } from './lib/auth.ts';
import {
  getCachedSubscription, getCachedPlan, getCachedCredits, getCachedTokens,
  isCachedLibraryUnlocked, getCachedStories, getCachedStoryById,
  getCachedUsername, getCachedAvatarIndex, getCachedSocialLinks,
  isCachedBookmarked, hasUserLikedCached, getCachedLikeCount,
  saveUserStory, removeUserStory, updateProfile,
  consumeTokenServer, deductCreditsServer,
  toggleBookmarkServer, toggleLikeServer,
} from './lib/db.ts';

// ═══════════════════════════════════════════════════════════
// DRiVE State Layer
// 
// When authenticated → reads from Supabase cache (db.ts)
// When not authenticated → reads from localStorage (legacy)
//
// All sync functions work immediately from cache/localStorage.
// Writes dispatch async Supabase calls in the background.
// ═══════════════════════════════════════════════════════════

const LIBRARY_UNLOCKED_KEY = 'drive_library_unlocked';
const USER_STORIES_KEY = 'drive_user_stories';
const SELECTED_AVATAR_KEY = 'drive_selected_avatar';
const USERNAME_KEY = 'drive_username';
const SUBSCRIPTION_KEY = 'drive_subscription';

// ─── Subscription / Plan Management ───

function getDefaultSubscription(): UserSubscription {
  return { plan: 'free', tokensRemaining: 0, creditsBalance: 0, selectedTier: '', purchasedAt: '' };
}

export function getUserSubscription(): UserSubscription {
  if (isAuthenticated()) return getCachedSubscription();
  const data = localStorage.getItem(SUBSCRIPTION_KEY);
  if (!data) return getDefaultSubscription();
  try {
    return { ...getDefaultSubscription(), ...JSON.parse(data) };
  } catch {
    return getDefaultSubscription();
  }
}

export function getUserPlan(): UserPlan {
  if (isAuthenticated()) return getCachedPlan();
  return getUserSubscription().plan;
}

export function isLibraryUnlocked(): boolean {
  if (isBetaTester()) return true;
  if (isAuthenticated()) return isCachedLibraryUnlocked();
  return getUserPlan() !== 'free';
}

export function canCreateStory(): boolean {
  if (isBetaTester()) return true;
  const sub = getUserSubscription();
  if (sub.plan === 'free') return false;
  if (sub.plan === 'creator') return true;
  return sub.tokensRemaining > 0;
}

export function getTokensRemaining(): number {
  if (isAuthenticated()) return getCachedTokens();
  return getUserSubscription().tokensRemaining;
}

export function getCreditsBalance(): number {
  if (isAuthenticated()) return getCachedCredits();
  return getUserSubscription().creditsBalance;
}

export function consumeToken(): boolean {
  if (isAuthenticated()) {
    // Fire async server call, return optimistic result
    consumeTokenServer().catch(console.error);
    const sub = getCachedSubscription();
    if (sub.plan === 'creator') return true;
    return sub.tokensRemaining > 0;
  }
  // Legacy localStorage path
  const sub = getUserSubscription();
  if (sub.plan === 'creator') return true;
  if (sub.tokensRemaining <= 0) return false;
  sub.tokensRemaining--;
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub));
  return true;
}

export function deductCredits(amount: number): boolean {
  if (isAuthenticated()) {
    const sub = getCachedSubscription();
    if (sub.creditsBalance < amount) return false;
    deductCreditsServer(amount).catch(console.error);
    return true;
  }
  const sub = getUserSubscription();
  if (sub.creditsBalance < amount) return false;
  sub.creditsBalance -= amount;
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub));
  return true;
}

export function addCredits(amount: number): void {
  const sub = getUserSubscription();
  sub.creditsBalance += amount;
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub));
}

export function unlockLibrary(tier?: string): void {
  localStorage.setItem(LIBRARY_UNLOCKED_KEY, 'true');
  if (isAuthenticated()) {
    updateProfile({ library_unlocked: true }).catch(console.error);
  }
  if (tier) {
    activatePlan(tier);
  }
}

export function activatePlan(tier: string): void {
  const now = new Date().toISOString();
  let sub = getUserSubscription();

  if (tier.startsWith('credits_')) {
    let creditAmount = 0;
    switch (tier) {
      case 'credits_5': creditAmount = 4000; break;
      case 'credits_10': creditAmount = 8000; break;
      case 'credits_20': creditAmount = 16000; break;
      case 'credits_50': creditAmount = 42000; break;
      case 'credits_100': creditAmount = 88000; break;
    }
    sub.creditsBalance += creditAmount;
  } else {
    switch (tier) {
      case 'single':
        sub = { plan: 'starter', tokensRemaining: 1, creditsBalance: 800, selectedTier: tier, purchasedAt: now };
        break;
      case 'pack':
        sub = { plan: 'starter', tokensRemaining: 10, creditsBalance: 8000, selectedTier: tier, purchasedAt: now };
        break;
      case 'monthly': {
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        sub = { plan: 'creator', tokensRemaining: 999, creditsBalance: 4000, selectedTier: tier, purchasedAt: now, expiresAt: exp.toISOString() };
        break;
      }
      default:
        sub = { plan: 'starter', tokensRemaining: 1, creditsBalance: 800, selectedTier: tier, purchasedAt: now };
    }
  }

  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub));
  localStorage.setItem(LIBRARY_UNLOCKED_KEY, 'true');

  if (isAuthenticated()) {
    updateProfile({ library_unlocked: true }).catch(console.error);
  }
}

// ─── User Stories ───

export function getUserStories(): UserStory[] {
  if (isAuthenticated()) return getCachedStories();
  const data = localStorage.getItem(USER_STORIES_KEY);
  if (!data) return [];
  try { return JSON.parse(data) as UserStory[]; } catch { return []; }
}

export async function addUserStory(story: UserStory): Promise<void> {
  if (isAuthenticated()) {
    await saveUserStory(story);
    return;
  }
  const stories = getUserStories();
  stories.push(story);
  try {
    localStorage.setItem(USER_STORIES_KEY, JSON.stringify(stories));
  } catch (e) {
    console.warn('localStorage quota exceeded when saving user story:', e);
  }
}

export function deleteUserStory(id: string): void {
  if (isAuthenticated()) {
    removeUserStory(id).catch(console.error);
    return;
  }
  const stories = getUserStories().filter(s => s.id !== id);
  try {
    localStorage.setItem(USER_STORIES_KEY, JSON.stringify(stories));
  } catch (e) {
    console.warn('localStorage error on deleteUserStory:', e);
  }
}

export function getUserStoryById(id: string): UserStory | null {
  if (isAuthenticated()) return getCachedStoryById(id);
  return getUserStories().find(s => s.id === id) || null;
}

// ─── Avatar & Username ───

export function getSelectedAvatar(): number {
  if (isAuthenticated()) return getCachedAvatarIndex();
  const val = localStorage.getItem(SELECTED_AVATAR_KEY);
  const parsed = val ? parseInt(val, 10) : 0;
  return isNaN(parsed) ? 0 : Math.max(0, Math.min(19, parsed));
}

export function setSelectedAvatar(index: number): void {
  const clamped = Math.max(0, Math.min(19, index));
  localStorage.setItem(SELECTED_AVATAR_KEY, String(clamped));
  if (isAuthenticated()) {
    updateProfile({ avatar_index: clamped }).catch(console.error);
  }
}

export function getUsername(): string {
  if (isAuthenticated()) return getCachedUsername();
  let name = localStorage.getItem(USERNAME_KEY);
  if (!name) {
    name = generateUsername();
    localStorage.setItem(USERNAME_KEY, name);
  }
  return name;
}

// ─── Social Links ───
const SOCIAL_LINKS_KEY = 'drive_social_links';

export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'x' | 'bluesky';

export function getSocialLinks(): Record<SocialPlatform, string> {
  if (isAuthenticated()) {
    const links = getCachedSocialLinks();
    return {
      instagram: links.instagram || '',
      facebook: links.facebook || '',
      youtube: links.youtube || '',
      x: links.x || '',
      bluesky: links.bluesky || '',
    };
  }
  const data = localStorage.getItem(SOCIAL_LINKS_KEY);
  const defaults: Record<SocialPlatform, string> = {
    instagram: '', facebook: '', youtube: '', x: '', bluesky: ''
  };
  if (!data) return defaults;
  try { return { ...defaults, ...JSON.parse(data) }; } catch { return defaults; }
}

export function setSocialLinks(links: Record<SocialPlatform, string>): void {
  localStorage.setItem(SOCIAL_LINKS_KEY, JSON.stringify(links));
  if (isAuthenticated()) {
    updateProfile({ social_links: links as Record<string, string> }).catch(console.error);
  }
}

export function setSocialLink(platform: SocialPlatform, handle: string): void {
  const links = getSocialLinks();
  links[platform] = handle.trim();
  setSocialLinks(links);
}

// ─── Story Likes ───
const LIKES_KEY = 'drive_story_likes';
const USER_LIKED_KEY = 'drive_user_liked';

function getLikesMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch { return {}; }
}

function getUserLikedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(USER_LIKED_KEY) || '[]')); } catch { return new Set(); }
}

export function getStoryLikes(storyId: string): number {
  if (isAuthenticated()) return getCachedLikeCount(storyId);
  return getLikesMap()[storyId] || 0;
}

export function hasUserLiked(storyId: string): boolean {
  if (isAuthenticated()) return hasUserLikedCached(storyId);
  return getUserLikedSet().has(storyId);
}

export function toggleStoryLike(storyId: string): { liked: boolean; count: number } {
  if (isAuthenticated()) {
    // Fire async, return optimistic result
    const wasLiked = hasUserLikedCached(storyId);
    const currentCount = getCachedLikeCount(storyId);
    toggleLikeServer(storyId).catch(console.error);
    return { liked: !wasLiked, count: wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1 };
  }
  // Legacy localStorage path
  const map = getLikesMap();
  const set = getUserLikedSet();
  if (set.has(storyId)) {
    set.delete(storyId);
    map[storyId] = Math.max(0, (map[storyId] || 1) - 1);
  } else {
    set.add(storyId);
    map[storyId] = (map[storyId] || 0) + 1;
  }
  localStorage.setItem(LIKES_KEY, JSON.stringify(map));
  localStorage.setItem(USER_LIKED_KEY, JSON.stringify([...set]));
  return { liked: set.has(storyId), count: map[storyId] || 0 };
}

// ─── Story Bookmarks ───
const BOOKMARKS_KEY = 'drive_bookmarks';

function getBookmarkSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]')); } catch { return new Set(); }
}

export function isBookmarked(storyId: string): boolean {
  if (isAuthenticated()) return isCachedBookmarked(storyId);
  return getBookmarkSet().has(storyId);
}

export function toggleBookmark(storyId: string): boolean {
  if (isAuthenticated()) {
    const was = isCachedBookmarked(storyId);
    toggleBookmarkServer(storyId).catch(console.error);
    return !was;
  }
  const set = getBookmarkSet();
  if (set.has(storyId)) { set.delete(storyId); } else { set.add(storyId); }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...set]));
  return set.has(storyId);
}

// ─── Content Management View Mode ───
const CONTENT_MGMT_MODE_KEY = 'drive_content_mgmt_mode';

export function isContentManagementMode(): boolean {
  try {
    return sessionStorage.getItem(CONTENT_MGMT_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setContentManagementMode(active: boolean): void {
  try {
    if (active) {
      sessionStorage.setItem(CONTENT_MGMT_MODE_KEY, 'true');
    } else {
      sessionStorage.removeItem(CONTENT_MGMT_MODE_KEY);
    }
  } catch {}
}
