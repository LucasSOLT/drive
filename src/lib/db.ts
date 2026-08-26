import { supabase } from './supabase.ts';
import { getUser, isAuthenticated, getUserId } from './auth.ts';
import type { Story, UserStory, UserSubscription, UserPlan } from '../types.ts';

// ═══════════════════════════════════════════════════════════
// DRiVE Database Service Layer
// Async Supabase operations with in-memory cache
// Falls back to localStorage for unauthenticated users
// ═══════════════════════════════════════════════════════════

// ─── In-Memory Cache ───
export type UserRole = 'user' | 'admin' | 'game_master';

interface CachedProfile {
  id: string;
  username: string;
  avatar_index: number;
  bio: string;
  social_links: Record<string, string>;
  library_unlocked: boolean;
  role: UserRole;
}

let _profile: CachedProfile | null = null;
let _subscription: UserSubscription | null = null;
let _stories: UserStory[] = [];
let _bookmarks: Set<string> = new Set();
let _likedStories: Set<string> = new Set();
let _likeCounts: Record<string, number> = {};
let _dataLoaded = false;

// ─── Load All User Data (call after login) ───
export async function loadUserData(): Promise<void> {
  const userId = getUserId();
  console.log('[DB] loadUserData called. userId:', userId);
  if (!userId) {
    console.warn('[DB] No userId available, skipping loadUserData');
    return;
  }

  try {
    const [profileRes, subRes, storiesRes, bookmarksRes, likesRes] = await Promise.all([
      supabase.from('profiles').select('*, is_admin').eq('id', userId).single(),
      supabase.from('user_subscriptions').select('*').eq('user_id', userId).single(),
      supabase.from('user_stories').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bookmarks').select('story_id').eq('user_id', userId),
      supabase.from('story_likes').select('story_id').eq('user_id', userId),
    ]);

    // Debug: log each query result
    if (profileRes.error) console.error('[DB] profiles query error:', profileRes.error.message, profileRes.error.code, profileRes.error.details);
    if (subRes.error) console.warn('[DB] subscriptions query error:', subRes.error.message);
    if (storiesRes.error) console.error('[DB] user_stories query error:', storiesRes.error.message, storiesRes.error.code);
    if (bookmarksRes.error) console.warn('[DB] bookmarks query error:', bookmarksRes.error.message);
    if (likesRes.error) console.warn('[DB] story_likes query error:', likesRes.error.message);

    _profile = profileRes.data ? {
      id: profileRes.data.id,
      username: profileRes.data.username || '',
      avatar_index: profileRes.data.avatar_index || 0,
      bio: profileRes.data.bio || '',
      social_links: profileRes.data.social_links || {},
      library_unlocked: profileRes.data.library_unlocked || false,
      // Support new 'role' column; fallback: if old is_admin boolean exists, map it
      role: (profileRes.data.role as UserRole) || (profileRes.data.is_admin === true ? 'admin' : 'user'),
    } : null;

    // HARDCODED ADMIN EMAIL FALLBACK — guarantees admin access regardless of DB column state
    const ADMIN_EMAILS = ['lucas@soltheory.com', 'steve@soltheory.com', 'gerard@soltheory.com'];
    const currentUser = getUser();
    const userEmail = currentUser?.email || '';
    if (_profile && ADMIN_EMAILS.includes(userEmail) && _profile.role !== 'admin' && _profile.role !== 'game_master') {
      console.log('[DB] Admin email whitelist override! Email:', userEmail, '| Was:', _profile.role, '→ Now: admin');
      _profile.role = 'admin';
    }
    
    // Debug: log what Supabase returned for role and admin status
    console.log('[DB] Profile loaded. is_admin:', profileRes.data?.is_admin, '| role column:', profileRes.data?.role, '| Mapped role:', _profile?.role, '| email:', userEmail);
    _subscription = subRes.data ? {
      plan: (subRes.data.plan || 'free') as UserPlan,
      tokensRemaining: subRes.data.tokens_remaining || 0,
      creditsBalance: subRes.data.credits_balance || 0,
      selectedTier: subRes.data.plan || '',
      purchasedAt: subRes.data.created_at || '',
      expiresAt: subRes.data.monthly_credits_reset_at || undefined,
    } : null;
    _stories = (storiesRes.data || []).map(s => ({
      id: s.id,
      user_id: s.user_id,
      title: s.title,
      genre: s.genre,
      format: s.format,
      synopsis: s.synopsis || '',
      status: s.status || 'draft',
      createdAt: s.created_at,
      pages: s.pages || [],
      coverImage: s.cover_image || '',
      live_pages: s.live_pages || undefined,
      rejectionReason: s.rejection_reason || undefined,
      contentRating: s.content_rating || 'All Ages',
      isFeatured: s.is_featured || false,
      isEditorsPick: s.is_editors_pick || false,
      readCount: s.read_count || 0,
      reviewedBy: s.reviewed_by || undefined,
      reviewedAt: s.reviewed_at || undefined,
    }));
    _bookmarks = new Set((bookmarksRes.data || []).map((b: any) => b.story_id));
    _likedStories = new Set((likesRes.data || []).map((l: any) => l.story_id));
    _dataLoaded = true;

    // Also sync to localStorage as fallback cache
    syncToLocalStorage();
  } catch (err) {
    console.error('Failed to load user data:', err);
  }
}

export function isDataLoaded(): boolean {
  return _dataLoaded;
}

export function clearCache(): void {
  _profile = null;
  _subscription = null;
  _stories = [];
  _bookmarks = new Set();
  _likedStories = new Set();
  _likeCounts = {};
  _dataLoaded = false;
}

// ─── Sync cache to localStorage (offline fallback) ───
function syncToLocalStorage(): void {
  if (_subscription) {
    localStorage.setItem('drive_subscription', JSON.stringify(_subscription));
  }
  if (_stories.length > 0) {
    localStorage.setItem('drive_user_stories', JSON.stringify(_stories));
  }
  if (_profile) {
    localStorage.setItem('drive_username', _profile.username);
    localStorage.setItem('drive_selected_avatar', String(_profile.avatar_index));
    localStorage.setItem('drive_social_links', JSON.stringify(_profile.social_links));
    if (_profile.library_unlocked) {
      localStorage.setItem('drive_library_unlocked', 'true');
    }
  }
  localStorage.setItem('drive_bookmarks', JSON.stringify([..._bookmarks]));
  localStorage.setItem('drive_user_liked', JSON.stringify([..._likedStories]));
}

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════

export function getCachedProfile(): CachedProfile | null {
  return _profile;
}

export function getCachedUsername(): string {
  return _profile?.username || localStorage.getItem('drive_username') || 'Guest';
}

export function getCachedAvatarIndex(): number {
  if (_profile) return _profile.avatar_index;
  const val = localStorage.getItem('drive_selected_avatar');
  return val ? parseInt(val, 10) || 0 : 0;
}

export function getCachedSocialLinks(): Record<string, string> {
  if (_profile) return _profile.social_links || {};
  try { return JSON.parse(localStorage.getItem('drive_social_links') || '{}'); } catch { return {}; }
}

export async function updateProfile(updates: Partial<CachedProfile>): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const dbUpdates: Record<string, any> = {};
  if (updates.username !== undefined) dbUpdates.username = updates.username;
  if (updates.avatar_index !== undefined) dbUpdates.avatar_index = updates.avatar_index;
  if (updates.social_links !== undefined) dbUpdates.social_links = updates.social_links;
  if (updates.library_unlocked !== undefined) dbUpdates.library_unlocked = updates.library_unlocked;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  dbUpdates.updated_at = new Date().toISOString();

  await supabase.from('profiles').update(dbUpdates).eq('id', userId);

  // Update cache
  if (_profile) {
    Object.assign(_profile, updates);
  }

  // Sync localStorage
  if (updates.username !== undefined) localStorage.setItem('drive_username', updates.username);
  if (updates.avatar_index !== undefined) localStorage.setItem('drive_selected_avatar', String(updates.avatar_index));
  if (updates.social_links !== undefined) localStorage.setItem('drive_social_links', JSON.stringify(updates.social_links));
  if (updates.library_unlocked) localStorage.setItem('drive_library_unlocked', 'true');
}

// ═══════════════════════════════════════════════
// SUBSCRIPTION
// ═══════════════════════════════════════════════

export function getCachedSubscription(): UserSubscription {
  if (_subscription) return _subscription;
  // Fallback to localStorage
  const data = localStorage.getItem('drive_subscription');
  if (!data) return { plan: 'free', tokensRemaining: 0, creditsBalance: 0, selectedTier: '', purchasedAt: '' };
  try { return JSON.parse(data); } catch { return { plan: 'free', tokensRemaining: 0, creditsBalance: 0, selectedTier: '', purchasedAt: '' }; }
}

export function getCachedPlan(): UserPlan {
  return getCachedSubscription().plan;
}

export function getCachedCredits(): number {
  return getCachedSubscription().creditsBalance;
}

export function getCachedTokens(): number {
  return getCachedSubscription().tokensRemaining;
}

export function isCachedLibraryUnlocked(): boolean {
  if (_profile) return _profile.library_unlocked;
  if (_subscription && _subscription.plan !== 'free') return true;
  return localStorage.getItem('drive_library_unlocked') === 'true';
}

export async function refreshSubscription(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const { data } = await supabase.from('user_subscriptions').select('*').eq('user_id', userId).single();
  if (data) {
    _subscription = {
      plan: (data.plan || 'free') as UserPlan,
      tokensRemaining: data.tokens_remaining || 0,
      creditsBalance: data.credits_balance || 0,
      selectedTier: data.plan || '',
      purchasedAt: data.created_at || '',
      expiresAt: data.monthly_credits_reset_at || undefined,
    };
    localStorage.setItem('drive_subscription', JSON.stringify(_subscription));
  }
}

// Server-side token consumption (deducts via Supabase, not just localStorage)
export async function consumeTokenServer(): Promise<boolean> {
  const sub = getCachedSubscription();
  if (sub.plan === 'creator') return true; // Unlimited
  if (sub.tokensRemaining <= 0) return false;

  const userId = getUserId();
  if (userId) {
    await supabase.from('user_subscriptions')
      .update({ tokens_remaining: sub.tokensRemaining - 1 })
      .eq('user_id', userId);
  }

  // Update cache
  if (_subscription) _subscription.tokensRemaining--;
  sub.tokensRemaining--;
  localStorage.setItem('drive_subscription', JSON.stringify(sub));
  return true;
}

// Server-side credit deduction
export async function deductCreditsServer(amount: number): Promise<boolean> {
  const sub = getCachedSubscription();
  if (sub.creditsBalance < amount) return false;

  const userId = getUserId();
  if (userId) {
    await supabase.from('user_subscriptions')
      .update({ credits_balance: sub.creditsBalance - amount })
      .eq('user_id', userId);

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: -amount,
      type: 'generation',
      description: 'AI image generation',
    });
  }

  // Update cache
  if (_subscription) _subscription.creditsBalance -= amount;
  sub.creditsBalance -= amount;
  localStorage.setItem('drive_subscription', JSON.stringify(sub));
  return true;
}

// ═══════════════════════════════════════════════
// USER STORIES
// ═══════════════════════════════════════════════

export function getCachedStories(): UserStory[] {
  if (_dataLoaded) return _stories;
  // Fallback to localStorage
  try { return JSON.parse(localStorage.getItem('drive_user_stories') || '[]'); } catch { return []; }
}

export function getCachedStoryById(id: string): UserStory | null {
  return getCachedStories().find(s => s.id === id) || null;
}

export async function saveUserStory(story: UserStory): Promise<void> {
  const userId = getUserId();

  if (userId) {
    const { data, error } = await supabase
      .from('user_stories')
      .insert({
        user_id: userId,
        title: story.title,
        genre: story.genre,
        format: story.format,
        synopsis: story.synopsis || '',
        status: story.status || 'draft',
        pages: story.pages || [],
        cover_image: story.coverImage || '',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save user story to Supabase:', error);
      throw error;
    }

    if (data?.id) {
      story.id = data.id;
    }
  }

  // Update cache
  _stories.unshift(story);
  try {
    localStorage.setItem('drive_user_stories', JSON.stringify(_stories));
  } catch (e) {
    console.warn('localStorage quota exceeded when caching user stories:', e);
  }
}

export async function removeUserStory(id: string): Promise<void> {
  const userId = getUserId();

  if (userId) {
    await supabase.from('user_stories').delete().eq('id', id).eq('user_id', userId);
  }

  // Update cache
  _stories = _stories.filter(s => s.id !== id);
  try {
    localStorage.setItem('drive_user_stories', JSON.stringify(_stories));
  } catch (e) {
    console.warn('localStorage error on removeUserStory:', e);
  }
}

// ═══════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════

export function isCachedBookmarked(storyId: string): boolean {
  if (_dataLoaded) return _bookmarks.has(storyId);
  try {
    const set = new Set(JSON.parse(localStorage.getItem('drive_bookmarks') || '[]'));
    return set.has(storyId);
  } catch { return false; }
}

export async function toggleBookmarkServer(storyId: string): Promise<boolean> {
  const userId = getUserId();
  const wasBookmarked = _bookmarks.has(storyId);

  if (wasBookmarked) {
    _bookmarks.delete(storyId);
    if (userId) {
      await supabase.from('bookmarks').delete().eq('user_id', userId).eq('story_id', storyId);
    }
  } else {
    _bookmarks.add(storyId);
    if (userId) {
      await supabase.from('bookmarks').insert({ user_id: userId, story_id: storyId });
    }
  }

  localStorage.setItem('drive_bookmarks', JSON.stringify([..._bookmarks]));
  return !wasBookmarked;
}

// ═══════════════════════════════════════════════
// LIKES
// ═══════════════════════════════════════════════

export function hasUserLikedCached(storyId: string): boolean {
  if (_dataLoaded) return _likedStories.has(storyId);
  try {
    const set = new Set(JSON.parse(localStorage.getItem('drive_user_liked') || '[]'));
    return set.has(storyId);
  } catch { return false; }
}

export function getCachedLikeCount(storyId: string): number {
  return _likeCounts[storyId] || 0;
}

export async function toggleLikeServer(storyId: string): Promise<{ liked: boolean; count: number }> {
  const userId = getUserId();
  const wasLiked = _likedStories.has(storyId);

  if (wasLiked) {
    _likedStories.delete(storyId);
    _likeCounts[storyId] = Math.max(0, (_likeCounts[storyId] || 1) - 1);
    if (userId) {
      await supabase.from('story_likes').delete().eq('user_id', userId).eq('story_id', storyId);
    }
  } else {
    _likedStories.add(storyId);
    _likeCounts[storyId] = (_likeCounts[storyId] || 0) + 1;
    if (userId) {
      await supabase.from('story_likes').insert({ user_id: userId, story_id: storyId });
    }
  }

  localStorage.setItem('drive_user_liked', JSON.stringify([..._likedStories]));
  return { liked: !wasLiked, count: _likeCounts[storyId] || 0 };
}

// Fetch like count for a specific story (from DB)
export async function fetchLikeCount(storyId: string): Promise<number> {
  const { count } = await supabase.from('story_likes').select('*', { count: 'exact', head: true }).eq('story_id', storyId);
  const c = count || 0;
  _likeCounts[storyId] = c;
  return c;
}

// ═══════════════════════════════════════════════
// ONE-TIME MIGRATION (localStorage → Supabase)
// ═══════════════════════════════════════════════

export async function migrateLocalData(): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  // Check if already migrated
  if (localStorage.getItem('drive_migrated') === 'true') return;

  // Check if user already has server-side stories
  const { data: existing } = await supabase.from('user_stories').select('id').eq('user_id', userId).limit(1);
  if (existing && existing.length > 0) {
    localStorage.setItem('drive_migrated', 'true');
    return;
  }

  try {
    // Migrate stories
    const localStories: UserStory[] = JSON.parse(localStorage.getItem('drive_user_stories') || '[]');
    for (const story of localStories) {
      await supabase.from('user_stories').insert({
        user_id: userId,
        title: story.title,
        genre: story.genre,
        format: story.format,
        synopsis: story.synopsis || '',
        status: story.status || 'draft',
        pages: story.pages || [],
        created_at: story.createdAt || new Date().toISOString(),
      });
    }

    // Migrate subscription
    const localSub = JSON.parse(localStorage.getItem('drive_subscription') || 'null');
    if (localSub && localSub.plan !== 'free') {
      await supabase.rpc('add_user_credits', {
        target_user_id: userId,
        credit_amount: localSub.creditsBalance || 0,
        token_amount: localSub.tokensRemaining || 0,
        new_plan: localSub.plan || 'starter',
      });
    }

    // Migrate profile data
    const avatar = parseInt(localStorage.getItem('drive_selected_avatar') || '0', 10);
    const username = localStorage.getItem('drive_username') || '';
    const socialLinks = JSON.parse(localStorage.getItem('drive_social_links') || '{}');
    const unlocked = localStorage.getItem('drive_library_unlocked') === 'true';

    await supabase.from('profiles').upsert({
      id: userId,
      username: username || ('User_' + userId.substring(0, 8)),
      avatar_index: isNaN(avatar) ? 0 : avatar,
      social_links: socialLinks,
      library_unlocked: unlocked,
    });

    localStorage.setItem('drive_migrated', 'true');
    console.log('✅ Local data migrated to Supabase successfully');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// ═══════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL (RBAC)
// ═══════════════════════════════════════════════

/** Get the current user's role from the cached profile. Defaults to 'user'. */
export function getUserRole(): UserRole {
  return _profile?.role || 'user';
}

/** Returns true if the current user has admin or game_master role. */
export function checkIsAdmin(): boolean {
  const role = getUserRole();
  return role === 'admin' || role === 'game_master';
}

/** Returns true if the current user has the game_master role. */
export function checkIsGameMaster(): boolean {
  return getUserRole() === 'game_master';
}

/** Alias: returns true if user can access the admin dashboard (admin OR game_master). */
export function hasAdminPrivileges(): boolean {
  const result = checkIsAdmin();
  console.log('[DB] hasAdminPrivileges() called. _profile exists:', !!_profile, '| role:', _profile?.role, '| result:', result);
  return result;
}

export interface AdminMetrics {
  pendingCount: number;
  approvedCount: number;
  deniedCount: number;
  totalReads: number;
  totalLikes: number;
  topGenre: string;
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  const [storiesRes, likesRes] = await Promise.all([
    supabase.from('user_stories').select('status, read_count, genre'),
    supabase.from('story_likes').select('id', { count: 'exact', head: true }),
  ]);

  const stories = storiesRes.data || [];
  let pendingCount = 0;
  let approvedCount = 0;
  let deniedCount = 0;
  let totalReads = 0;
  const genreCounts: Record<string, number> = {};

  for (const s of stories) {
    if (s.status === 'under-review') pendingCount++;
    else if (s.status === 'published') approvedCount++;
    else if (s.status === 'denied') deniedCount++;

    totalReads += s.read_count || 0;
    if (s.genre) {
      genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1;
    }
  }

  let topGenre = 'N/A';
  let maxCount = 0;
  for (const [g, count] of Object.entries(genreCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topGenre = g;
    }
  }

  return {
    pendingCount,
    approvedCount,
    deniedCount,
    totalReads,
    totalLikes: likesRes.count || 0,
    topGenre,
  };
}

export async function fetchAdminStories(
  statusFilter: 'under-review' | 'published' | 'denied',
  genreFilter?: string,
  formatFilter?: string
): Promise<UserStory[]> {
  let query = supabase.from('user_stories').select('*, profiles(username)').eq('status', statusFilter);

  if (genreFilter && genreFilter !== 'all') {
    query = query.eq('genre', genreFilter);
  }
  if (formatFilter && formatFilter !== 'all') {
    query = query.eq('format', formatFilter);
  }

  // FIFO order: oldest first for pending reviews; newest first for approved/denied
  if (statusFilter === 'under-review') {
    query = query.order('created_at', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching admin stories:', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    user_id: s.user_id,
    author_name: s.profiles?.username || 'Unknown Author',
    title: s.title,
    genre: s.genre,
    format: s.format,
    synopsis: s.synopsis || '',
    status: s.status || 'draft',
    createdAt: s.created_at,
    pages: s.pages || [],
    coverImage: s.cover_image || '',
    live_pages: s.live_pages || undefined,
    rejectionReason: s.rejection_reason || undefined,
    contentRating: s.content_rating || 'All Ages',
    isFeatured: s.is_featured || false,
    isEditorsPick: s.is_editors_pick || false,
    readCount: s.read_count || 0,
    reviewedBy: s.reviewed_by || undefined,
    reviewedAt: s.reviewed_at || undefined,
  }));
}

export async function approveStoryAdmin(
  storyId: string,
  options: { contentRating: string; isFeatured: boolean; isEditorsPick: boolean }
): Promise<void> {
  const adminId = getUserId();
  
  // First fetch current story pages
  const { data: story } = await supabase.from('user_stories').select('pages').eq('id', storyId).single();
  const pages = story?.pages || [];

  await supabase.from('user_stories').update({
    status: 'published',
    content_rating: options.contentRating,
    is_featured: options.isFeatured,
    is_editors_pick: options.isEditorsPick,
    live_pages: pages, // Copy current draft pages to live_pages
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: null,
  }).eq('id', storyId);
}

export async function denyStoryAdmin(storyId: string, rejectionReason: string): Promise<void> {
  const adminId = getUserId();

  await supabase.from('user_stories').update({
    status: 'denied',
    rejection_reason: rejectionReason,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', storyId);
}

export async function revertStoryAdmin(storyId: string): Promise<void> {
  await supabase.from('user_stories').update({
    status: 'under-review',
  }).eq('id', storyId);
}

export async function deleteStoryAdmin(storyId: string): Promise<void> {
  await supabase.from('user_stories').delete().eq('id', storyId);
}

export async function resubmitStoryUser(storyId: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  await supabase.from('user_stories').update({
    status: 'under-review',
    rejection_reason: null,
  }).eq('id', storyId).eq('user_id', userId);

  // Update in-memory cache
  const cached = _stories.find(s => s.id === storyId);
  if (cached) {
    cached.status = 'under-review';
    cached.rejectionReason = undefined;
  }
}

export async function fetchPublishedExploreStories(): Promise<UserStory[]> {
  const { data, error } = await supabase
    .from('user_stories')
    .select('*, profiles(username)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching published explore stories:', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    user_id: s.user_id,
    author_name: s.profiles?.username || 'DRiVE Author',
    title: s.title,
    genre: s.genre,
    format: s.format,
    synopsis: s.synopsis || '',
    status: 'published',
    createdAt: s.created_at,
    pages: s.live_pages || s.pages || [],
    coverImage: s.cover_image || '',
    page_audio: s.page_audio || {},
    contentRating: s.content_rating || 'All Ages',
    isFeatured: s.is_featured || false,
    isEditorsPick: s.is_editors_pick || false,
    readCount: s.read_count || 0,
    sortOrder: s.sort_order || 0,
  }));
}

export async function fetchFeaturedStories(): Promise<Story[]> {
  return fetchUnifiedExploreStories({ featuredOnly: true });
}

// ═══════════════════════════════════════════════
// OFFICIAL STORIES (DRiVE ORIGINALS) SERVICES
// ═══════════════════════════════════════════════

/** Fetch all official stories sorted by sort_order ASC, then created_at DESC */
export async function fetchOfficialStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from('official_stories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[DB] Error fetching official stories from Supabase (fallback to static):', error);
    // Fallback to static stories from stories.ts if table not yet migrated or offline
    return [];
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    author: s.author || 'DRiVE Studios',
    genre: s.genre,
    format: s.format,
    synopsis: s.synopsis || '',
    coverImage: s.cover_image || '',
    coverVideo: s.cover_video || undefined,
    readCount: s.read_count || 0,
    isFeatured: s.is_featured || false,
    isEditorPick: s.is_editor_pick || false,
    sortOrder: s.sort_order || 0,
    panels: Array.isArray(s.panels) ? s.panels : [],
    pageVideos: s.page_videos || {},
    pageScripts: s.page_scripts || {},
    pageAudio: s.page_audio || {},
    contentRating: s.content_rating || 'All Ages',
    isOfficial: true,
    officialStatus: s.status || 'draft',
    storyGroupId: s.story_group_id || s.id,
    episodeNumber: s.episode_number || 1,
  }));
}

/** Create or update an official story */
export async function saveOfficialStory(story: Partial<Story> & { id: string }): Promise<void> {
  const userId = getUserId();
  const payload: any = {
    id: story.id,
    title: story.title,
    author: story.author || 'DRiVE Studios',
    genre: story.genre || 'Drama',
    format: story.format || 'book',
    synopsis: story.synopsis || '',
    cover_image: story.coverImage || '',
    cover_video: story.coverVideo || null,
    is_featured: story.isFeatured ?? false,
    is_editor_pick: story.isEditorPick ?? false,
    sort_order: story.sortOrder ?? 0,
    panels: story.panels || [],
    page_videos: story.pageVideos || {},
    page_scripts: story.pageScripts || {},
    page_audio: story.pageAudio || {},
    content_rating: story.contentRating || 'All Ages',
    status: story.officialStatus || 'draft',
    created_by: userId,
    updated_at: new Date().toISOString(),
    story_group_id: story.storyGroupId || story.id,
    episode_number: story.episodeNumber || 1,
  };

  const { error } = await supabase
    .from('official_stories')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[DB] Error saving official story:', error);
    throw error;
  }
}

/** Delete an official story */
export async function deleteOfficialStory(storyId: string): Promise<void> {
  const { error } = await supabase
    .from('official_stories')
    .delete()
    .eq('id', storyId);

  if (error) {
    console.error('[DB] Error deleting official story:', error);
    throw error;
  }
}

/** Reorder official stories by updating their sort_order values */
export async function reorderOfficialStories(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    sort_order: index + 1,
    updated_at: new Date().toISOString(),
  }));

  for (const item of updates) {
    await supabase
      .from('official_stories')
      .update({ sort_order: item.sort_order, updated_at: item.updated_at })
      .eq('id', item.id);
  }
}

/** Fetch only LIVE official stories (for public feeds: Featured, Explore, Home) */
export async function fetchLiveOfficialStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from('official_stories')
    .select('*')
    .eq('status', 'live')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[DB] Error fetching live official stories:', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    author: s.author || 'DRiVE Studios',
    genre: s.genre,
    format: s.format,
    synopsis: s.synopsis || '',
    coverImage: s.cover_image || '',
    coverVideo: s.cover_video || undefined,
    readCount: s.read_count || 0,
    isFeatured: s.is_featured || false,
    isEditorPick: s.is_editor_pick || false,
    sortOrder: s.sort_order || 0,
    panels: Array.isArray(s.panels) ? s.panels : [],
    pageVideos: s.page_videos || {},
    pageScripts: s.page_scripts || {},
    pageAudio: s.page_audio || {},
    contentRating: s.content_rating || 'All Ages',
    isOfficial: true,
    officialStatus: 'live' as const,
    storyGroupId: s.story_group_id || s.id,
    episodeNumber: s.episode_number || 1,
  }));
}

/** Set an official story to LIVE */
export async function goOfficialStoryLive(storyId: string, options?: { isFeatured?: boolean; isEditorPick?: boolean }): Promise<void> {
  const update: any = {
    status: 'live',
    updated_at: new Date().toISOString(),
  };
  if (options?.isFeatured !== undefined) update.is_featured = options.isFeatured;
  if (options?.isEditorPick !== undefined) update.is_editor_pick = options.isEditorPick;

  const { error } = await supabase
    .from('official_stories')
    .update(update)
    .eq('id', storyId);

  if (error) throw error;
}

/** Take an official story OFFLINE (back to draft) */
export async function takeOfficialStoryOffline(storyId: string): Promise<void> {
  const { error } = await supabase
    .from('official_stories')
    .update({ status: 'draft', is_featured: false, is_editor_pick: false, updated_at: new Date().toISOString() })
    .eq('id', storyId);

  if (error) throw error;
}

/** Toggle Featured status on an official story */
export async function toggleOfficialStoryFeatured(storyId: string, isFeatured: boolean): Promise<void> {
  const { error } = await supabase
    .from('official_stories')
    .update({ is_featured: isFeatured, updated_at: new Date().toISOString() })
    .eq('id', storyId);

  if (error) throw error;
}

/** Toggle Editor Pick status on an official story */
export async function toggleOfficialStoryEditorPick(storyId: string, isEditorPick: boolean): Promise<void> {
  const { error } = await supabase
    .from('official_stories')
    .update({ is_editor_pick: isEditorPick, updated_at: new Date().toISOString() })
    .eq('id', storyId);

  if (error) throw error;
}

/** Toggle Featured / Editor Pick on a published user story */
export async function toggleUserStoryFeatured(storyId: string, isFeatured: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_stories')
    .update({ is_featured: isFeatured })
    .eq('id', storyId);

  if (error) throw error;
}

export async function toggleUserStoryEditorPick(storyId: string, isEditorsPick: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_stories')
    .update({ is_editors_pick: isEditorsPick })
    .eq('id', storyId);

  if (error) throw error;
}

/**
 * Unified Explore & Featured Feed Engine.
 * Merges official stories with published community stories.
 * Calculates popularity score: Score = (likes * 3) + (reads * 1)
 */
export async function fetchUnifiedExploreStories(options?: {
  genre?: string;
  format?: string;
  featuredOnly?: boolean;
}): Promise<Story[]> {
  const [officialStories, userStories, likesCounts] = await Promise.all([
    fetchLiveOfficialStories(),
    fetchPublishedExploreStories(),
    supabase.from('story_likes').select('story_id'),
  ]);

  // Aggregate likes per story
  const likeMap: Record<string, number> = {};
  if (likesCounts.data) {
    for (const row of likesCounts.data) {
      likeMap[row.story_id] = (likeMap[row.story_id] || 0) + 1;
    }
  }

  // Convert published user stories to Story interface with popularity score
  const mappedUserStories: Story[] = userStories.map(us => {
    const pages = us.live_pages || us.pages || [];
    const likes = likeMap[us.id] || 0;
    const reads = us.readCount || 0;
    const popularityScore = (likes * 3) + reads;

    return {
      id: us.id,
      title: us.title,
      author: us.author_name || 'Community Creator',
      genre: us.genre,
      format: us.format,
      synopsis: us.synopsis || '',
      coverImage: pages[0]?.image || '',
      readCount: reads,
      isFeatured: us.isFeatured || false,
      isEditorPick: us.isEditorsPick || false,
      sortOrder: us.sortOrder || 999,
      panels: pages.map((p: any) => p.image).filter(Boolean),
      pageAudio: us.page_audio || {},
      contentRating: us.contentRating || 'All Ages',
      isOfficial: false,
    };
  });

  // Attach like metrics to official stories
  const enrichedOfficialStories = officialStories.map(os => ({
    ...os,
    isOfficial: true,
  }));

  // Combine feeds: Official stories prioritized by sort_order, followed by trending community stories
  let combined = [...enrichedOfficialStories, ...mappedUserStories];

  // Apply filters
  if (options?.genre && options.genre !== 'all') {
    combined = combined.filter(s => s.genre.toLowerCase() === options.genre!.toLowerCase());
  }
  if (options?.format && options.format !== 'all') {
    combined = combined.filter(s => s.format === options.format);
  }
  if (options?.featuredOnly) {
    combined = combined.filter(s => s.isFeatured || s.isEditorPick);
  }

  // Sort: Official stories first by sort_order, then high popularity community stories
  combined.sort((a, b) => {
    // Both official: sort by sortOrder
    if (a.isOfficial && b.isOfficial) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    }
    // Official always precedes non-official if sortOrder is active
    if (a.isOfficial && !b.isOfficial) return -1;
    if (!a.isOfficial && b.isOfficial) return 1;

    // Both community stories: sort by Popularity Score (likes * 3 + reads)
    const scoreA = ((likeMap[a.id] || 0) * 3) + (a.readCount || 0);
    const scoreB = ((likeMap[b.id] || 0) * 3) + (b.readCount || 0);
    return scoreB - scoreA;
  });

  return combined;
}

// ═══════════════════════════════════════════════
// SQUAD DATABASE OPERATIONS
// ═══════════════════════════════════════════════

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'DRV-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createSquad(storyId: string, squadName: string): Promise<{ squadId: string; inviteCode: string } | null> {
  const userId = getUserId();
  if (!userId) throw new Error('Must be logged in to create a squad');

  const inviteCode = generateInviteCode();

  const { data: squad, error: squadError } = await supabase
    .from('squads')
    .insert({
      driver_id: userId,
      story_id: storyId,
      name: squadName || 'DRiVE Squad',
      invite_code: inviteCode,
      status: 'forming',
      min_size: 3,
      max_size: 5,
    })
    .select('id, invite_code')
    .single();

  if (squadError || !squad) {
    console.error('Error creating squad:', squadError);
    throw squadError;
  }

  // Add DRIVER as first squad member
  const { error: memberError } = await supabase
    .from('squad_members')
    .insert({
      squad_id: squad.id,
      user_id: userId,
      role: 'driver',
    });

  if (memberError) {
    console.error('Error adding DRIVER to squad_members:', memberError);
  }

  return { squadId: squad.id, inviteCode: squad.invite_code };
}

export async function joinSquadByCode(code: string): Promise<{ squadId: string; name: string } | null> {
  const userId = getUserId();
  if (!userId) throw new Error('Must be logged in to join a squad');

  const cleanCode = code.trim().toUpperCase();

  // Find squad by invite code
  const { data: squad, error: fetchError } = await supabase
    .from('squads')
    .select('id, name, status, max_size')
    .eq('invite_code', cleanCode)
    .single();

  if (fetchError || !squad) {
    throw new Error('Invalid invite code. Squad not found.');
  }

  if (squad.status !== 'forming') {
    throw new Error('This squad is no longer accepting new members.');
  }

  // Check current member count
  const { count, error: countError } = await supabase
    .from('squad_members')
    .select('*', { count: 'exact', head: true })
    .eq('squad_id', squad.id);

  if (!countError && count !== null && count >= squad.max_size) {
    throw new Error('Squad is full! (Maximum 5 players allowed)');
  }

  // Insert current user as member
  const { error: joinError } = await supabase
    .from('squad_members')
    .insert({
      squad_id: squad.id,
      user_id: userId,
      role: 'player',
    });

  if (joinError && !joinError.message.includes('unique constraint')) {
    console.error('Error joining squad:', joinError);
    throw joinError;
  }

  return { squadId: squad.id, name: squad.name };
}

export async function getSquadMembers(squadId: string): Promise<Array<{ userId: string; username: string; avatarIndex: number; role: 'driver' | 'player' }>> {
  const { data, error } = await supabase
    .from('squad_members')
    .select('user_id, role, profiles(username, avatar_index)')
    .eq('squad_id', squadId);

  if (error) {
    console.error('Error fetching squad members:', error);
    return [];
  }

  return (data || []).map((m: any) => ({
    userId: m.user_id,
    username: m.profiles?.username || 'Player',
    avatarIndex: m.profiles?.avatar_index ?? 0,
    role: m.role as 'driver' | 'player',
  }));
}

// ═══════════════════════════════════════════════
// AUTO-MATCH ENGINE
// ═══════════════════════════════════════════════

function getTimezoneOffset(tz?: string | null): number {
  if (!tz) return 0;
  const str = tz.toLowerCase();
  if (str.includes('pacific') || str.includes('pst') || str.includes('pdt')) return -7;
  if (str.includes('mountain') || str.includes('mst') || str.includes('mdt')) return -6;
  if (str.includes('central') || str.includes('cst') || str.includes('cdt')) return -5;
  if (str.includes('eastern') || str.includes('est') || str.includes('edt')) return -4;
  if (str.includes('europe') || str.includes('gmt') || str.includes('cet') || str.includes('utc')) return 1;
  if (str.includes('asia') || str.includes('japan') || str.includes('jst') || str.includes('aest')) return 9;

  const match = str.match(/([+-]?\d+)/);
  if (match) return parseInt(match[1], 10);
  return 0;
}

function isTimezoneProximate(tz1?: string | null, tz2?: string | null): boolean {
  const off1 = getTimezoneOffset(tz1);
  const off2 = getTimezoneOffset(tz2);
  return Math.abs(off1 - off2) <= 3;
}

function parseAvailability(avail?: string | null): string[] {
  if (!avail) return [];
  return avail.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function hasAvailabilityOverlap(avail1?: string | null, avail2?: string | null): boolean {
  const slots1 = parseAvailability(avail1);
  const slots2 = parseAvailability(avail2);
  if (slots1.length === 0 || slots2.length === 0) return true;
  return slots1.some(slot => slots2.includes(slot));
}

export async function runAutoMatch(): Promise<string | null> {
  try {
    // 1. Query matchmaking_queue for entries with status = 'searching'
    const { data: queueEntries, error: queueError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'searching');

    if (queueError || !queueEntries || queueEntries.length < 3) {
      return null;
    }

    // 2. Group results by timezone proximity and availability overlap
    let matchedGroup: typeof queueEntries = [];

    for (const seed of queueEntries) {
      const compatible = queueEntries.filter(item =>
        isTimezoneProximate(seed.timezone, item.timezone) &&
        hasAvailabilityOverlap(seed.availability, item.availability)
      );

      if (compatible.length >= 3) {
        matchedGroup = compatible.slice(0, 5);
        break;
      }
    }

    if (matchedGroup.length < 3) {
      return null;
    }

    // 3. Create a new Squad using existing createSquad()
    let squadResult: { squadId: string; inviteCode: string } | null = null;
    try {
      squadResult = await createSquad('', 'Auto-Matched Squad');
    } catch (err) {
      console.error('Error calling createSquad in runAutoMatch:', err);
      return null;
    }

    if (!squadResult || !squadResult.squadId) {
      return null;
    }

    const squadId = squadResult.squadId;

    // Insert each matched player into squad_members with role: 'player'
    for (const player of matchedGroup) {
      const { error: memberError } = await supabase
        .from('squad_members')
        .insert({
          squad_id: squadId,
          user_id: player.user_id,
          role: 'player',
        });

      if (memberError && !memberError.message?.includes('unique constraint')) {
        console.error(`Error adding player ${player.user_id} to squad_members:`, memberError);
      }
    }

    // Update each matched player's matchmaking_queue entry to status: 'matched'
    const userIds = matchedGroup.map(p => p.user_id);
    const { error: updateError } = await supabase
      .from('matchmaking_queue')
      .update({ status: 'matched' })
      .in('user_id', userIds);

    if (updateError) {
      console.error('Error updating matchmaking queue status:', updateError);
    }

    return squadId;
  } catch (err) {
    console.error('Unexpected error in runAutoMatch:', err);
    return null;
  }
}



