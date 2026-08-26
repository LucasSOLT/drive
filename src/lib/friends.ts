// ─── IN-APP FRIENDING & SOCIAL ENGINE ───

import { supabase } from './supabase.ts';
import { getUser } from './auth.ts';
import { getCachedFriendCode, setCachedFriendCode } from './db.ts';

export interface FriendUser {
  id: string;
  username: string;
  avatarIndex: number;
  friendCode: string;
  friendsSince: string;
}

const LOCAL_FRIEND_CODE_KEY = 'drive_user_friend_code';
const LOCAL_FRIENDS_LIST_KEY = 'drive_user_friends_list';

/** Generate an 8-digit numeric friend code (e.g. "84920194") */
export function generateFriendCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/** Get or initialize the current user's 8-digit Friend Code */
export async function getUserFriendCode(): Promise<string> {
  // 1. Check cached in db.ts
  const cached = getCachedFriendCode();
  if (cached && /^\d{8}$/.test(cached)) {
    localStorage.setItem(LOCAL_FRIEND_CODE_KEY, cached);
    return cached;
  }

  // 2. Check localStorage
  const local = localStorage.getItem(LOCAL_FRIEND_CODE_KEY);
  if (local && /^\d{8}$/.test(local)) {
    setCachedFriendCode(local);
    return local;
  }

  // 3. Generate a new 8-digit code
  const newCode = generateFriendCode();
  localStorage.setItem(LOCAL_FRIEND_CODE_KEY, newCode);
  setCachedFriendCode(newCode);

  // 4. Sync to Supabase profiles table if user is logged in
  const user = getUser();
  if (user) {
    try {
      await supabase.from('profiles').update({ friend_code: newCode }).eq('id', user.id);
    } catch (e) {
      console.warn('[Friends] Could not sync friend_code to Supabase profile:', e);
    }
  }

  return newCode;
}

/** Look up a user by their 8-digit Friend Code */
export async function findUserByFriendCode(code: string): Promise<{ id: string; username: string; avatarIndex: number } | null> {
  const cleanCode = code.trim();
  if (!/^\d{8}$/.test(cleanCode)) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_index, friend_code')
      .eq('friend_code', cleanCode)
      .maybeSingle();

    if (data && !error) {
      return {
        id: data.id,
        username: data.username || 'Adventurer',
        avatarIndex: data.avatar_index ?? 0,
      };
    }
  } catch (err) {
    console.warn('[Friends] Supabase lookup error:', err);
  }

  return null;
}

/** Get list of current friends */
export async function getFriendsList(): Promise<FriendUser[]> {
  const user = getUser();
  const localFriendsRaw = localStorage.getItem(LOCAL_FRIENDS_LIST_KEY);
  let localFriends: FriendUser[] = [];
  try {
    localFriends = localFriendsRaw ? JSON.parse(localFriendsRaw) : [];
  } catch {
    localFriends = [];
  }

  if (!user) return localFriends;

  try {
    // Query friendships from Supabase
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        created_at,
        user_id,
        friend_id,
        friend:profiles!friends_friend_id_fkey(id, username, avatar_index, friend_code),
        user:profiles!friends_user_id_fkey(id, username, avatar_index, friend_code)
      `)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!error && data && data.length > 0) {
      const dbFriends: FriendUser[] = data.map((row: any) => {
        const other = row.user_id === user.id ? row.friend : row.user;
        return {
          id: other?.id || (row.user_id === user.id ? row.friend_id : row.user_id),
          username: other?.username || 'Friend',
          avatarIndex: other?.avatar_index ?? 0,
          friendCode: other?.friend_code || '',
          friendsSince: row.created_at,
        };
      });

      // Merge and save to localStorage
      const mergedMap = new Map<string, FriendUser>();
      dbFriends.forEach(f => mergedMap.set(f.id, f));
      localFriends.forEach(f => {
        if (!mergedMap.has(f.id)) mergedMap.set(f.id, f);
      });

      const merged = Array.from(mergedMap.values());
      localStorage.setItem(LOCAL_FRIENDS_LIST_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('[Friends] Error fetching Supabase friends:', err);
  }

  return localFriends;
}

/** Add a friend by their 8-digit Friend Code */
export async function addFriendByCode(code: string): Promise<{ success: boolean; message: string; friend?: FriendUser }> {
  const cleanCode = code.trim();
  if (!/^\d{8}$/.test(cleanCode)) {
    return { success: false, message: 'Please enter a valid 8-digit numeric friend code.' };
  }

  const myCode = await getUserFriendCode();
  if (cleanCode === myCode) {
    return { success: false, message: "You cannot add yourself as a friend!" };
  }

  // Look up target user
  const found = await findUserByFriendCode(cleanCode);
  const user = getUser();

  const friendId = found?.id || 'friend_' + cleanCode;
  const friendUsername = found?.username || 'Player ' + cleanCode.slice(-4);
  const friendAvatar = found?.avatarIndex ?? Math.floor(Math.random() * 8);

  const existingFriends = await getFriendsList();
  if (existingFriends.some(f => f.id === friendId || f.friendCode === cleanCode)) {
    return { success: false, message: `You are already friends with ${friendUsername}!` };
  }

  const newFriend: FriendUser = {
    id: friendId,
    username: friendUsername,
    avatarIndex: friendAvatar,
    friendCode: cleanCode,
    friendsSince: new Date().toISOString(),
  };

  // Try inserting into Supabase friends table
  if (user && found?.id) {
    try {
      await supabase.from('friends').insert({
        user_id: user.id,
        friend_id: found.id,
        status: 'accepted'
      });
    } catch (err) {
      console.warn('[Friends] Could not insert to Supabase friends table:', err);
    }
  }

  // Save to local cache
  existingFriends.unshift(newFriend);
  localStorage.setItem(LOCAL_FRIENDS_LIST_KEY, JSON.stringify(existingFriends));

  return { success: true, message: `Successfully added ${friendUsername} as a friend!`, friend: newFriend };
}

/** Remove a friend */
export async function removeFriend(friendId: string): Promise<boolean> {
  const user = getUser();
  if (user) {
    try {
      await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
    } catch (err) {
      console.warn('[Friends] Error deleting friend in Supabase:', err);
    }
  }

  // Update localStorage
  const current = await getFriendsList();
  const filtered = current.filter(f => f.id !== friendId);
  localStorage.setItem(LOCAL_FRIENDS_LIST_KEY, JSON.stringify(filtered));
  return true;
}
