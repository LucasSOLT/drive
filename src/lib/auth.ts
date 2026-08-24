import { supabase } from './supabase.ts';
import type { User } from '@supabase/supabase-js';

// ─── Auth State ───
let _currentUser: User | null = null;
let _authReady = false;
const _authCallbacks: ((user: User | null) => void)[] = [];

// ─── Initialize Auth Listener ───
// Call this once on app startup (in main.ts)
export function initAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    // Listen for auth state changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange((_event, session) => {
      _currentUser = session?.user ?? null;
      _authReady = true;
      _authCallbacks.forEach(cb => cb(_currentUser));
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      _currentUser = session?.user ?? null;
      _authReady = true;
      resolve(_currentUser);
    });
  });
}

// ─── Getters ───
export function getUser(): User | null {
  return _currentUser;
}

export function isAuthenticated(): boolean {
  return _currentUser !== null;
}

export function isAuthReady(): boolean {
  return _authReady;
}

export function getUserId(): string | null {
  return _currentUser?.id ?? null;
}

/**
 * Check if user has admin privileges (admin or game_master).
 * NOTE: For the actual check, use hasAdminPrivileges() from db.ts instead.
 * This function cannot import db.ts due to circular dependency.
 * It is kept for backwards compatibility but always returns false.
 * The router guard and UI already use hasAdminPrivileges() from db.ts directly.
 */
export function isAdmin(): boolean {
  if (!_currentUser) return false;
  return false; // Use hasAdminPrivileges() from db.ts for the real check
}

export function isBetaTester(): boolean {
  if (!_currentUser) return false;
  return _currentUser.user_metadata?.beta_tester === true;
}

// ─── Auth Actions ───
export async function signUp(email: string, password: string, username: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) return { error: error.message };

  // If email confirmation is disabled, user is immediately logged in
  if (data.user && data.session) {
    _currentUser = data.user;

    // Update profile with the chosen username
    await supabase.from('profiles').update({ username }).eq('id', data.user.id);
  }

  return {};
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  _currentUser = data.user;
  return {};
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  _currentUser = null;
}

export async function resetPassword(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/#/login',
  });
  if (error) return { error: error.message };
  return {};
}

// ─── Auth Callbacks ───
export function onAuthChange(callback: (user: User | null) => void): () => void {
  _authCallbacks.push(callback);
  // Return unsubscribe function
  return () => {
    const idx = _authCallbacks.indexOf(callback);
    if (idx >= 0) _authCallbacks.splice(idx, 1);
  };
}
