// ─── SQUAD SERVICE & STATE ENGINE (Engine A - Module 2) ───

import { getUser } from './auth.ts';

export interface SquadMember {
  id: string;
  username: string;
  avatarUrl?: string;
  isHost: boolean;
  joinedAt: string;
  sparkCompleted?: boolean;
}

export interface Squad {
  id: string;
  roomCode: string;
  storyId: string;
  storyTitle: string;
  storyCoverImage?: string;
  currentEpisode: number;
  members: SquadMember[];
  minMembers: number;
  maxMembers: number;
  status: 'forming' | 'in-progress' | 'completed';
  isGlobalMatch: boolean;
  createdAt: string;
}

const SQUADS_STORAGE_KEY = 'drive_squads';
const ACTIVE_SQUAD_KEY = 'drive_active_squad_id';

/** Generate a readable 6-character room code (e.g. DRV-824 or SQUAD-99) */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'DRV-';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Get all squads from storage */
export function getAllSquads(): Squad[] {
  try {
    const raw = localStorage.getItem(SQUADS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[Squad] Failed to parse squads', err);
    return [];
  }
}

/** Save squads array to storage */
function saveSquads(squads: Squad[]): void {
  try {
    localStorage.setItem(SQUADS_STORAGE_KEY, JSON.stringify(squads));
  } catch (err) {
    console.warn('[Squad] Failed to save squads', err);
  }
}

/** Get a squad by ID */
export function getSquadById(id: string): Squad | null {
  const squads = getAllSquads();
  return squads.find(s => s.id === id) || null;
}

/** Get a squad by Room Code */
export function getSquadByCode(code: string): Squad | null {
  const cleanCode = code.trim().toUpperCase();
  const squads = getAllSquads();
  return squads.find(s => s.roomCode.toUpperCase() === cleanCode) || null;
}

/** Get currently active squad for a story */
export function getActiveSquadForStory(storyId: string): Squad | null {
  const squads = getAllSquads();
  return squads.find(s => s.storyId === storyId && s.status !== 'completed') || null;
}

/** Create a new Squad (Host) */
export function createSquad(options: {
  storyId: string;
  storyTitle: string;
  storyCoverImage?: string;
  isGlobalMatch?: boolean;
}): Squad {
  const user = getUser();
  const currentUsername = localStorage.getItem('drive_username') || user?.email?.split('@')[0] || 'Leader';
  const currentUserId = user?.id || 'unauthed_' + Date.now();

  const hostMember: SquadMember = {
    id: currentUserId,
    username: currentUsername,
    isHost: true,
    joinedAt: new Date().toISOString(),
    sparkCompleted: false,
  };

  const newSquad: Squad = {
    id: 'squad_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    roomCode: generateRoomCode(),
    storyId: options.storyId,
    storyTitle: options.storyTitle,
    storyCoverImage: options.storyCoverImage,
    currentEpisode: 2, // Episode 1 was finished solo, squad unlocks Ep 2+
    members: [hostMember],
    minMembers: 3,
    maxMembers: 5,
    status: 'forming',
    isGlobalMatch: options.isGlobalMatch ?? false,
    createdAt: new Date().toISOString(),
  };

  const squads = getAllSquads();
  squads.push(newSquad);
  saveSquads(squads);
  localStorage.setItem(ACTIVE_SQUAD_KEY, newSquad.id);

  console.log('[Squad] Created squad:', newSquad.roomCode, 'for story:', options.storyTitle);
  return newSquad;
}

/** Join an existing squad using a 6-char Room Code */
export function joinSquadByCode(code: string): { success: boolean; message: string; squad?: Squad } {
  const squad = getSquadByCode(code);
  if (!squad) {
    return { success: false, message: 'Squad room not found. Please check the code.' };
  }

  if (squad.members.length >= squad.maxMembers) {
    return { success: false, message: 'This squad is already full (max 5 players).' };
  }

  const user = getUser();
  const currentUsername = localStorage.getItem('drive_username') || user?.email?.split('@')[0] || 'Player ' + (squad.members.length + 1);
  const currentUserId = user?.id || 'user_' + Date.now();

  // Check if already in squad
  const alreadyMember = squad.members.some(m => m.id === currentUserId || m.username === currentUsername);
  if (alreadyMember) {
    localStorage.setItem(ACTIVE_SQUAD_KEY, squad.id);
    return { success: true, message: 'Welcome back to the squad!', squad };
  }

  const newMember: SquadMember = {
    id: currentUserId,
    username: currentUsername,
    isHost: false,
    joinedAt: new Date().toISOString(),
    sparkCompleted: false,
  };

  squad.members.push(newMember);
  if (squad.members.length >= squad.minMembers && squad.status === 'forming') {
    // Reached minimum quorum
    squad.status = 'in-progress';
  }

  const allSquads = getAllSquads().map(s => s.id === squad.id ? squad : s);
  saveSquads(allSquads);
  localStorage.setItem(ACTIVE_SQUAD_KEY, squad.id);

  return { success: true, message: `Joined squad ${squad.roomCode}!`, squad };
}

/** Simulate Global Matchmaking Pool */
export function joinGlobalMatchmaking(storyId: string, storyTitle: string, storyCoverImage?: string): Squad {
  const existingGlobal = getAllSquads().find(
    s => s.storyId === storyId && s.isGlobalMatch && s.status === 'forming' && s.members.length < s.maxMembers
  );

  if (existingGlobal) {
    const user = getUser();
    const currentUsername = localStorage.getItem('drive_username') || user?.email?.split('@')[0] || 'Adventurer';
    const currentUserId = user?.id || 'user_' + Date.now();

    if (!existingGlobal.members.some(m => m.id === currentUserId)) {
      existingGlobal.members.push({
        id: currentUserId,
        username: currentUsername,
        isHost: false,
        joinedAt: new Date().toISOString(),
        sparkCompleted: false,
      });

      if (existingGlobal.members.length >= existingGlobal.minMembers) {
        existingGlobal.status = 'in-progress';
      }

      const all = getAllSquads().map(s => s.id === existingGlobal.id ? existingGlobal : s);
      saveSquads(all);
      localStorage.setItem(ACTIVE_SQUAD_KEY, existingGlobal.id);
    }
    return existingGlobal;
  }

  // Create new global squad room
  return createSquad({
    storyId,
    storyTitle,
    storyCoverImage,
    isGlobalMatch: true,
  });
}
