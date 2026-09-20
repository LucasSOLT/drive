import { navigate, getRouteParam } from '../router.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';
import { getUserId, getUser, isAuthenticated } from '../lib/auth.ts';
import {
  fetchSquadById,
  fetchSquadByCode,
  getSquadMembers,
  setMemberReady,
  createSquadSession,
  getSquadSession,
  updateSquadStatus,
  leaveSquad,
  fetchStoryByIdFromDb,
  fetchStoryByGroupAndEpisode,
} from '../lib/db.ts';
import { supabase } from '../lib/supabase.ts';
import { getStoryById, stories } from '../data/stories.ts';
import type { Story } from '../types.ts';

export interface SquadMember {
  userId: string;
  username: string;
  avatarIndex: number;
  role: 'driver' | 'player';
  isReady: boolean;
}

export interface SquadData {
  id: string;
  name: string;
  driverId: string;
  storyId: string;
  storyTitle?: string;
  storyCoverImage?: string;
  inviteCode: string;
  status: 'forming' | 'in-progress' | 'completed';
  minSize: number;
  maxSize: number;
  members: SquadMember[];
}

// Active squad state
let currentSquad: SquadData = {
  id: 'squad-demo',
  name: 'Speed Demons',
  driverId: 'current-user',
  storyId: 'story-1',
  storyTitle: 'The Echo of Silence',
  inviteCode: 'DRV-7892',
  status: 'forming',
  minSize: 3,
  maxSize: 5,
  members: [
    { userId: 'current-user', username: 'You', avatarIndex: 0, role: 'driver', isReady: false },
    { userId: 'user-2', username: 'Alex', avatarIndex: 3, role: 'player', isReady: true },
  ],
};

let pollingTimer: number | null = null;
let isTogglingReady = false;
let isLaunching = false;

export function setLobbySquadData(data: SquadData): void {
  currentSquad = data;
}

export function getCurrentSquadData(): SquadData {
  return currentSquad;
}

/** Resolve effective squad ID from route param, localStorage, or fallback */
function resolveCurrentSquadId(): string {
  const routeParam = getRouteParam();
  if (routeParam && routeParam !== 'squad-lobby') {
    return routeParam;
  }
  const stored = localStorage.getItem('drive_active_squad_id');
  if (stored) return stored;

  try {
    const pending = localStorage.getItem('drive_pending_squad_join');
    if (pending) {
      const parsed = JSON.parse(pending);
      if (parsed.squadId) return parsed.squadId;
      if (parsed.squadCode) return parsed.squadCode;
    }
  } catch {
    // ignore
  }

  return currentSquad.id || 'squad-demo';
}

/** Fetch live squad details and member ready states from Supabase */
async function loadLiveSquadData(targetIdOrCode: string): Promise<boolean> {
  try {
    let squadRecord = await fetchSquadById(targetIdOrCode);
    if (!squadRecord) {
      squadRecord = await fetchSquadByCode(targetIdOrCode);
    }

    if (!squadRecord) {
      return false;
    }

    // Persist active squad ID
    localStorage.setItem('drive_active_squad_id', squadRecord.id);

    // Fetch members
    const membersData = await getSquadMembers(squadRecord.id);

    // Auto-join if user is authenticated and not currently listed
    const currentUid = getUserId();
    if (currentUid && !membersData.some(m => m.userId === currentUid) && membersData.length < squadRecord.maxSize) {
      try {
        await supabase.from('squad_members').insert({
          squad_id: squadRecord.id,
          user_id: currentUid,
          role: squadRecord.driverId === currentUid ? 'driver' : 'player',
          is_ready: false,
        });
        membersData.push({
          userId: currentUid,
          username: localStorage.getItem('drive_username') || getUser()?.email?.split('@')[0] || 'You',
          avatarIndex: parseInt(localStorage.getItem('drive_selected_avatar') || '0', 10) || 0,
          role: squadRecord.driverId === currentUid ? 'driver' : 'player',
          isReady: false,
        });
      } catch (e) {
        console.warn('[Lobby] Auto-join skipped:', e);
      }
    }

    // Fetch story details
    let storyTitle = '';
    let storyCover = '';
    if (squadRecord.storyId) {
      const staticStory = getStoryById(squadRecord.storyId);
      if (staticStory) {
        storyTitle = staticStory.title;
        storyCover = staticStory.coverImage || '';
      } else {
        const dbStory = await fetchStoryByIdFromDb(squadRecord.storyId);
        if (dbStory) {
          storyTitle = dbStory.title;
          storyCover = dbStory.coverImage || '';
        }
      }
    }

    currentSquad = {
      id: squadRecord.id,
      name: squadRecord.name,
      driverId: squadRecord.driverId,
      storyId: squadRecord.storyId,
      storyTitle: storyTitle || undefined,
      storyCoverImage: storyCover || undefined,
      inviteCode: squadRecord.inviteCode,
      status: squadRecord.status,
      minSize: squadRecord.minSize || 3,
      maxSize: squadRecord.maxSize || 5,
      members: membersData.map(m => ({
        userId: m.userId,
        username: m.username,
        avatarIndex: m.avatarIndex,
        role: m.role,
        isReady: m.isReady,
      })),
    };

    return true;
  } catch (err) {
    console.warn('[Lobby] Error loading live squad data:', err);
    return false;
  }
}

export function render(): string {
  const currentUid = getUserId() || 'current-user';
  const members = currentSquad.members || [];
  const memberCount = members.length;
  const readyMembers = members.filter(m => m.isReady);
  const readyCount = readyMembers.length;

  const minRequired = currentSquad.minSize || 3;
  const maxAllowed = currentSquad.maxSize || 5;

  const hasEnoughPlayers = memberCount >= minRequired;
  const allMembersReady = hasEnoughPlayers && readyCount === memberCount;
  const currentUserMember = members.find(m => m.userId === currentUid);
  const isUserReady = currentUserMember ? currentUserMember.isReady : false;

  const isDriver = currentSquad.driverId === currentUid || currentUserMember?.role === 'driver';

  // Build slots (5 slots max)
  const slotsHtml = Array.from({ length: maxAllowed }).map((_, i) => {
    const member = members[i];
    if (member) {
      const avatarSvg = MONSTER_AVATARS[member.avatarIndex] || MONSTER_AVATARS[0];
      const isYou = member.userId === currentUid;
      const isMemberReady = member.isReady;

      return `
        <div class="squad-slot squad-slot--filled" data-user-id="${member.userId}" style="
          display: flex; align-items: center; justify-content: space-between; gap: var(--space-md);
          background: var(--color-surface);
          border: 2px solid ${isMemberReady ? '#10b981' : 'var(--color-border)'};
          border-radius: var(--radius-xl); padding: 12px 16px;
          box-shadow: ${isMemberReady ? '0 4px 16px rgba(16, 185, 129, 0.15)' : 'var(--shadow-sm)'};
          transition: all 0.25s ease;
        ">
          <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
            <div style="
              width: 50px; height: 50px; border-radius: 50%;
              background: var(--color-eggshell); display: flex; align-items: center; justify-content: center;
              overflow: hidden; padding: 2px; flex-shrink: 0;
              border: 2px solid ${isMemberReady ? '#10b981' : 'var(--color-border)'};
            ">
              ${avatarSvg}
            </div>
            <div style="min-width: 0;">
              <div style="font-family: var(--font-heading); font-weight: 700; font-size: 1rem; color: var(--color-text-primary); display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <span>${escapeHtml(member.username)}</span>
                ${isYou ? '<span style="font-size: 0.72rem; color: var(--color-purple); font-weight: 800;">(You)</span>' : ''}
                ${member.role === 'driver' ? '<span style="font-size: 0.65rem; background: linear-gradient(135deg, var(--color-purple) 0%, #7c3aed 100%); color: white; padding: 2px 7px; border-radius: 9999px; font-weight: 800; letter-spacing: 0.5px;">DRIVER</span>' : ''}
              </div>
              <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">
                ${member.role === 'driver' ? 'Squad Leader' : 'Adventurer'}
              </div>
            </div>
          </div>

          <!-- Ready Badge -->
          <div class="squad-member-ready-badge" style="flex-shrink: 0;">
            ${isMemberReady ? `
              <div style="
                display: inline-flex; align-items: center; gap: 6px;
                background: rgba(16, 185, 129, 0.12); border: 1.5px solid #10b981;
                color: #059669; padding: 6px 12px; border-radius: 9999px;
                font-family: var(--font-heading); font-weight: 800; font-size: 0.8rem;
                letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
              ">
                <span style="font-size: 0.85rem;">●</span> READY
              </div>
            ` : `
              <div style="
                display: inline-flex; align-items: center; gap: 6px;
                background: rgba(156, 163, 175, 0.12); border: 1.5px solid #9ca3af;
                color: var(--color-text-muted); padding: 6px 12px; border-radius: 9999px;
                font-family: var(--font-heading); font-weight: 700; font-size: 0.8rem;
              ">
                <span style="font-size: 0.85rem;">○</span> WAITING
              </div>
            `}
          </div>
        </div>
      `;
    }

    const isSlotRequired = i < minRequired;
    return `
      <div class="squad-slot squad-slot--empty" style="
        display: flex; align-items: center; justify-content: center; gap: 10px;
        border: 2px dashed ${isSlotRequired ? 'rgba(239, 68, 68, 0.35)' : 'var(--color-border)'};
        background: ${isSlotRequired ? 'rgba(239, 68, 68, 0.02)' : 'transparent'};
        border-radius: var(--radius-xl); padding: 16px;
        color: var(--color-text-muted); font-size: 0.88rem;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="opacity: 0.6;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>${isSlotRequired ? `Slot ${i + 1} Required (Need min ${minRequired})` : `Slot ${i + 1} Optional (Max ${maxAllowed})`}</span>
      </div>
    `;
  }).join('');

  // Progress Bar percentage
  const readyPercent = memberCount > 0 ? (readyCount / Math.max(memberCount, minRequired)) * 100 : 0;

  return `
    <div class="view-squad-lobby fade-in" id="squad-lobby-container" style="
      padding: var(--space-md);
      max-width: 680px;
      margin: 0 auto;
      padding-bottom: 180px; /* space for bottom ready dock */
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    ">
      
      <!-- Top Card: Squad Header & Invite Box -->
      <div class="squad-lobby-card slide-up stagger-1" style="
        background: var(--color-surface); border: 1.5px solid var(--color-border);
        border-radius: var(--radius-xl); padding: var(--space-lg); box-shadow: var(--shadow-sm);
        margin-bottom: var(--space-md); text-align: center; position: relative; overflow: hidden;
      ">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #10b981, var(--color-purple), #3b82f6);"></div>
        
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(138, 43, 226, 0.08); border-radius: 9999px; margin-bottom: 8px;">
          <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-purple); font-weight: 800;">
            🛡️ SQUAD MISSION LOBBY
          </span>
        </div>

        <h1 id="squad-name-title" style="font-family: var(--font-heading); font-size: 1.7rem; font-weight: 800; color: var(--color-text-primary); margin: 0 0 6px 0;">
          ${escapeHtml(currentSquad.name)}
        </h1>

        ${currentSquad.storyTitle ? `
          <p style="font-size: 0.88rem; color: var(--color-text-secondary); margin: 0 0 16px 0;">
            Story: <strong>${escapeHtml(currentSquad.storyTitle)}</strong>
          </p>
        ` : `
          <p style="font-size: 0.88rem; color: var(--color-text-secondary); margin: 0 0 16px 0;">
            Assemble 3 to 5 players to embark on the squad-gated episodes!
          </p>
        `}

        <!-- Invite Link Box -->
        <div style="
          display: flex; align-items: center; justify-content: space-between;
          background: var(--color-eggshell); border: 1px solid var(--color-border);
          border-radius: var(--radius-full); padding: 6px 8px 6px 18px; margin: 0 auto; max-width: 380px;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.03);
        ">
          <span style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary);" id="invite-code-text">
            Code: <strong style="color: var(--color-purple); letter-spacing: 1px;">${escapeHtml(currentSquad.inviteCode)}</strong>
          </span>
          <div style="display: flex; gap: 6px;">
            <button id="copy-invite-btn" class="btn btn--primary btn--sm" style="border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 700; padding: 7px 14px;">
              Copy Code
            </button>
            <button id="share-link-btn" class="btn btn--secondary btn--sm" style="border-radius: var(--radius-full); font-size: 0.78rem; padding: 7px 12px;" title="Share Link">
              🔗 Share
            </button>
          </div>
        </div>
      </div>

      <!-- Quorum & Ready Progress Tracker -->
      <div class="slide-up stagger-2" style="
        background: var(--color-surface); border: 1px solid var(--color-border);
        border-radius: var(--radius-xl); padding: 14px 18px; margin-bottom: var(--space-md);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span style="font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; color: var(--color-text-primary);">
              Squad Readiness
            </span>
            <span style="font-size: 0.78rem; color: var(--color-text-muted); margin-left: 6px;">
              (${readyCount}/${memberCount} Ready · Min 3 required)
            </span>
          </div>
          <span style="
            font-family: var(--font-heading); font-weight: 800; font-size: 0.85rem;
            color: ${allMembersReady ? '#10b981' : hasEnoughPlayers ? 'var(--color-purple)' : '#ef4444'};
          ">
            ${allMembersReady ? '✅ ALL PLAYERS READY' : hasEnoughPlayers ? `⏳ ${memberCount - readyCount} MORE READY NEEDED` : `⚠️ NEED ${minRequired - memberCount} MORE PLAYER(S)`}
          </span>
        </div>

        <div style="height: 10px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden; position: relative;">
          <div style="
            height: 100%; width: ${Math.min(100, readyPercent)}%;
            background: ${allMembersReady ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, var(--color-purple) 0%, #3b82f6 100%)'};
            transition: width 0.35s ease;
          "></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.76rem; color: var(--color-text-muted);">
          <span>Min 3 Members</span>
          <span>48-Hour Timer Starts When Launched</span>
          <span>Max 5 Members</span>
        </div>
      </div>

      <!-- Squad Members Slots List -->
      <div class="squad-members-section slide-up stagger-3" style="margin-bottom: var(--space-lg);">
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-left: 4px;">
          Roster (${memberCount}/${maxAllowed})
        </div>
        <div class="squad-members-list" id="squad-members-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${slotsHtml}
        </div>
      </div>

      <!-- Footer Help Note -->
      <div style="text-align: center; margin-top: auto; padding: 12px; color: var(--color-text-muted); font-size: 0.8rem;">
        <p style="margin: 0;">Once all members click the green <strong>"I'M READY"</strong> button, the 48-hour clock begins and the squad advances into the story.</p>
        <button id="lobby-leave-btn" style="background: none; border: none; color: #ef4444; font-size: 0.82rem; font-weight: 600; cursor: pointer; margin-top: 10px; text-decoration: underline;">
          Leave Squad
        </button>
      </div>

      <!-- ============================================== -->
      <!-- FIXED BOTTOM ACTION DOCK (PROMINENT GREEN READY) -->
      <!-- ============================================== -->
      <div class="squad-lobby-bottom-dock" style="
        position: fixed; bottom: 0; left: 0; right: 0;
        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px);
        border-top: 1.5px solid var(--color-border);
        box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.08);
        padding: 14px 20px; z-index: 100;
        display: flex; flex-direction: column; gap: 10px;
        max-width: 680px; margin: 0 auto;
      ">
        
        <!-- PROMINENT GREEN "I'M READY" BUTTON -->
        <button id="btn-toggle-ready" class="btn-ready-toggle" style="
          width: 100%;
          padding: 16px 24px;
          border-radius: var(--radius-full);
          font-family: var(--font-heading);
          font-size: 1.12rem;
          font-weight: 800;
          letter-spacing: 0.6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
          ${isUserReady ? `
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: #ffffff;
            border: 2.5px solid #34d399;
            box-shadow: 0 0 24px rgba(16, 185, 129, 0.5), 0 4px 12px rgba(5, 150, 105, 0.3);
          ` : `
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            border: 2.5px solid rgba(255, 255, 255, 0.4);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
          `}
        ">
          <span style="font-size: 1.35rem; line-height: 1;">${isUserReady ? '✅' : '🟢'}</span>
          <span>${isUserReady ? "YOU ARE READY! · CLICK TO UNREADY" : "I'M READY"}</span>
        </button>

        <!-- LAUNCH BUTTON (Active only when >=3 members AND all ready) -->
        <button id="start-story-btn" class="btn btn--primary" ${!allMembersReady ? 'disabled' : ''} style="
          width: 100%;
          padding: 13px 20px;
          font-family: var(--font-heading);
          font-size: 0.98rem;
          font-weight: 700;
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.25s ease;
          ${!allMembersReady ? `
            opacity: 0.55;
            background: var(--color-surface);
            color: var(--color-text-muted);
            border: 1px solid var(--color-border);
            cursor: not-allowed;
          ` : `
            background: linear-gradient(135deg, var(--color-purple) 0%, #7c3aed 100%);
            color: #ffffff;
            border: none;
            box-shadow: 0 4px 20px rgba(138, 43, 226, 0.45);
            cursor: pointer;
          `}
        ">
          ${!hasEnoughPlayers
            ? `🚀 Need ${minRequired - memberCount} More Player${(minRequired - memberCount) > 1 ? 's' : ''} to Launch (Min 3)`
            : !allMembersReady
              ? `⏳ Waiting on ${memberCount - readyCount} Player${(memberCount - readyCount) > 1 ? 's' : ''} to Press "I'M READY"`
              : `🚀 Launch Episode Now (48h Clock Starts!)`}
        </button>

      </div>

    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('squad-lobby-container');
  if (!container) return;

  const currentSquadId = resolveCurrentSquadId();

  // 1. Initial async fetch from Supabase
  loadLiveSquadData(currentSquadId).then(loaded => {
    if (loaded) {
      rerenderLobbyView();
    }
  });

  // 2. Start live polling (every 3 seconds)
  startLobbyPolling(currentSquadId);

  // 3. Attach UI event listeners
  attachLobbyEventListeners(currentSquadId);
}

/** Attach listeners for Ready button, Launch button, Copy code, and Leave */
function attachLobbyEventListeners(squadId: string): void {
  // ─── Prominent Green "I'M READY" Button ───
  const readyBtn = document.getElementById('btn-toggle-ready');
  if (readyBtn) {
    readyBtn.addEventListener('click', async () => {
      if (isTogglingReady) return;
      isTogglingReady = true;

      try {
        const currentUid = getUserId() || 'current-user';
        const userMember = currentSquad.members.find(m => m.userId === currentUid);
        const newReadyState = userMember ? !userMember.isReady : true;

        // Optimistic UI update
        if (userMember) {
          userMember.isReady = newReadyState;
        }
        rerenderLobbyView();

        // Write to Supabase
        if (getUserId()) {
          await setMemberReady(currentSquad.id, currentUid, newReadyState);
        }
      } catch (err) {
        console.error('[Lobby] Error setting ready state:', err);
      } finally {
        isTogglingReady = false;
      }
    });
  }

  // ─── Launch Episode Button ───
  const launchBtn = document.getElementById('start-story-btn');
  if (launchBtn) {
    launchBtn.addEventListener('click', async () => {
      if (launchBtn.hasAttribute('disabled') || isLaunching) return;

      const memberCount = currentSquad.members.length;
      const minRequired = currentSquad.minSize || 3;
      const allReady = currentSquad.members.every(m => m.isReady);

      if (memberCount < minRequired) {
        alert(`⚠️ Not enough players!\n\nYou need at least ${minRequired} squad members to start. Currently: ${memberCount}.`);
        return;
      }

      if (!allReady) {
        alert('⚠️ Waiting for all squad members to click the green "I\'M READY" button before launching!');
        return;
      }

      isLaunching = true;
      
      // ─── Launch Countdown ───
      const countdownOverlay = document.createElement('div');
      countdownOverlay.id = 'launch-countdown-overlay';
      countdownOverlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; flex-direction:column; gap:16px;';
      countdownOverlay.innerHTML = `
        <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:2px; color:var(--color-purple); font-weight:700;">SQUAD MISSION LAUNCHING</div>
        <div id="countdown-number" style="font-family:var(--font-heading); font-size:5rem; font-weight:900; color:white; line-height:1;">5</div>
        <div style="font-size:0.82rem; color:var(--color-text-muted);">Get ready to read together!</div>
      `;
      document.body.appendChild(countdownOverlay);

      // Animate countdown 5→1
      const countdownEl = document.getElementById('countdown-number');
      for (let i = 4; i >= 1; i--) {
        await new Promise(r => setTimeout(r, 1000));
        if (countdownEl) countdownEl.textContent = String(i);
      }
      await new Promise(r => setTimeout(r, 1000));
      if (countdownEl) countdownEl.textContent = '🚀';
      await new Promise(r => setTimeout(r, 500));

      try {
        // 1. Mark squad in-progress
        await updateSquadStatus(currentSquad.id, 'in-progress');

        // 2. Determine storyGroupId from the story data
        const storyData = getStoryById(currentSquad.storyId);
        const storyGroupId = storyData?.storyGroupId || currentSquad.storyId || 'story-group-1';

        // 3. Get soloEpisodeCount to know which episode is the first post-gate one
        const soloEpCount = storyData?.soloEpisodeCount || 1;
        const firstSquadEpisode = soloEpCount + 1;

        // 4. Create or get squad session (starts at the first post-gate episode)
        let session = await getSquadSession(currentSquad.id);
        if (!session) {
          session = await createSquadSession(currentSquad.id, storyGroupId, firstSquadEpisode);
        }

        console.log('[Lobby] Squad session started:', session?.id, 'Episode:', session?.currentEpisodeNumber);

        // 5. Find the actual story ID for the target episode
        const targetEpisode = session?.currentEpisodeNumber || firstSquadEpisode;
        const episodeData = await fetchStoryByGroupAndEpisode(storyGroupId, targetEpisode);

        // 6. Navigate to the correct episode
        countdownOverlay.remove();
        if (episodeData) {
          navigate('story/' + episodeData.id);
        } else {
          // Fallback: navigate to the squad's story (Episode 1)
          console.warn('[Lobby] Could not find post-gate episode, falling back to story ID');
          navigate('story/' + currentSquad.storyId);
        }
      } catch (err) {
        console.error('[Lobby] Error launching episode:', err);
        countdownOverlay.remove();
        navigate('story/' + (currentSquad.storyId || 'story-1'));
      } finally {
        isLaunching = false;
      }
    });
  }

  // ─── Copy Invite Code ───
  const copyBtn = document.getElementById('copy-invite-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentSquad.inviteCode).then(() => {
        copyBtn.textContent = 'Copied! ✨';
        setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 2000);
      });
    });
  }

  // ─── Share Link ───
  const shareBtn = document.getElementById('share-link-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}/#squad-lobby/${currentSquad.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        shareBtn.textContent = 'Link Copied!';
        setTimeout(() => { shareBtn.textContent = '🔗 Share'; }, 2000);
      });
    });
  }

  // ─── Leave Squad ───
  const leaveBtn = document.getElementById('lobby-leave-btn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to leave this squad?')) {
        stopLobbyPolling();
        const currentUid = getUserId();
        if (currentUid && currentSquad.id) {
          try {
            await leaveSquad(currentSquad.id, currentUid);
          } catch (e) {
            console.warn('[Lobby] Error on leave squad:', e);
          }
        }
        localStorage.removeItem('drive_active_squad_id');
        navigate('explore');
      }
    });
  }
}

/** Start polling Supabase every 3 seconds for member status changes */
function startLobbyPolling(squadId: string): void {
  stopLobbyPolling();

  pollingTimer = window.setInterval(async () => {
    // Stop polling if user left the lobby
    if (!document.getElementById('squad-lobby-container')) {
      stopLobbyPolling();
      return;
    }

    try {
      const updated = await loadLiveSquadData(squadId);
      if (updated) {
        // If squad was launched by another member, auto-navigate to story
        if (currentSquad.status === 'in-progress') {
          stopLobbyPolling();
          const currentUid = getUserId();
          const isDriver = currentUid === currentSquad.driverId;
          
          if (isDriver) {
            // DRiVER: navigate to the post-gate episode
            try {
              const storyData = getStoryById(currentSquad.storyId);
              const storyGroupId = storyData?.storyGroupId || currentSquad.storyId;
              const session = await getSquadSession(currentSquad.id);
              const targetEp = session?.currentEpisodeNumber || 2;
              const epData = await fetchStoryByGroupAndEpisode(storyGroupId, targetEp);
              if (epData) {
                navigate('story/' + epData.id);
                return;
              }
            } catch (e) {
              console.warn('[Lobby] Could not fetch post-gate episode for DRiVER:', e);
            }
          }
          // Non-DRiVER or fallback: go to Episode 1 to read solo content first
          navigate('story/' + (currentSquad.storyId || 'story-1'));
          return;
        }

        rerenderLobbyView();
      }
    } catch (err) {
      console.warn('[Lobby] Polling error:', err);
    }
  }, 3000);
}

function stopLobbyPolling(): void {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

/** Lightweight DOM update to keep scroll position and button states fluid */
function rerenderLobbyView(): void {
  const container = document.getElementById('squad-lobby-container');
  if (!container) return;

  const scrollY = window.scrollY;
  container.outerHTML = render();
  window.scrollTo(0, scrollY);

  attachLobbyEventListeners(currentSquad.id);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
