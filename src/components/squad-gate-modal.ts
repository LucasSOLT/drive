// ─── SQUAD GATE MODAL COMPONENT (Engine A - Module 2) ───

import { navigate } from '../router.ts';
import { getStoryById } from '../data/stories.ts';
import { isAuthenticated, getUser, getUserId } from '../lib/auth.ts';
import {
  createSquad as dbCreateSquad,
  joinSquadByCode as dbJoinSquadByCode,
  fetchSquadById,
  fetchSquadByCode,
  getSquadMembers,
} from '../lib/db.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';

export interface SquadGateOptions {
  storyId: string;
  storyTitle: string;
  storyCoverImage?: string;
  storyGroupId?: string;
  episodeNumber?: number;
  soloEpisodeCount?: number;
  onReplay?: () => void;
  onClose?: () => void;
}

let currentSquadId: string | null = null;
let currentInviteCode: string | null = null;
let currentSquadName: string | null = null;
let currentMembers: Array<{ userId: string; username: string; avatarIndex: number; role: string; isReady: boolean }> = [];

export async function openSquadGateModal(options: SquadGateOptions): Promise<void> {
  if (!isAuthenticated()) {
    // Show Auth Required Overlay
    const authOverlay = document.createElement('div');
    authOverlay.id = 'squad-auth-overlay';
    authOverlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px;';
    authOverlay.innerHTML = `
      <div style="background:var(--color-surface); border-radius:var(--radius-xl); max-width:420px; width:100%; padding:32px; text-align:center; border:1.5px solid var(--color-border);">
        <div style="font-size:2.5rem; margin-bottom:12px;">🔒</div>
        <h2 style="font-family:var(--font-heading); font-size:1.3rem; margin:0 0 8px;">Account Required</h2>
        <p style="color:var(--color-text-secondary); font-size:0.9rem; line-height:1.6; margin:0 0 24px;">
          To join or create a DRiVE squad, you need a free account. We don't sell your data or show ads — it's just to save your reading progress.
        </p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button id="squad-auth-signup" style="padding:14px; background:linear-gradient(135deg, var(--color-purple), #7c3aed); color:white; border:none; border-radius:var(--radius-lg); font-weight:700; font-size:0.95rem; cursor:pointer;">Create Free Account</button>
          <button id="squad-auth-login" style="padding:12px; background:var(--color-eggshell); color:var(--color-text-primary); border:1px solid var(--color-border); border-radius:var(--radius-lg); font-weight:600; font-size:0.9rem; cursor:pointer;">Log In</button>
        </div>
      </div>
    `;
    document.body.appendChild(authOverlay);

    const saveAndNavigate = (route: string) => {
      localStorage.setItem('drive_pending_squad_join', JSON.stringify({
        storyId: options.storyId,
        storyTitle: options.storyTitle,
        squadCode: currentInviteCode || 'auto-create',
        timestamp: Date.now()
      }));
      authOverlay.remove();
      navigate(route);
    };

    document.getElementById('squad-auth-signup')?.addEventListener('click', () => saveAndNavigate('signup'));
    document.getElementById('squad-auth-login')?.addEventListener('click', () => saveAndNavigate('login'));
    return;
  }

  // Show loading spinner
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'squad-gate-loading';
  loadingOverlay.className = 'squad-gate-overlay open';
  loadingOverlay.innerHTML = `
    <div class="squad-gate-card" style="display:flex; align-items:center; justify-content:center; min-height:300px;">
      <div style="text-align:center;">
        <div class="spinner" style="margin-bottom:16px;"></div>
        <p style="color:var(--color-text-secondary);">Initializing Squad...</p>
      </div>
    </div>
  `;
  document.body.appendChild(loadingOverlay);

  // Check if user already has an active squad for this story
  const userId = getUserId();
  if (userId) {
    try {
      // Import getUserSquads dynamically to check existing squads
      const { getUserSquads } = await import('../lib/db.ts');
      const userSquads = await getUserSquads();
      const existingSquad = userSquads.find(s => 
        s.squad.storyId === options.storyId && s.squad.status !== 'completed'
      );

      if (existingSquad) {
        // Remove loading overlay
        loadingOverlay.remove();

        // Show "Your squad is waiting!" overlay
        const waitingOverlay = document.createElement('div');
        waitingOverlay.className = 'squad-gate-overlay open';
        waitingOverlay.id = 'squad-gate-modal';
        document.body.style.overflow = 'hidden';

        const memberAvatars = existingSquad.members.slice(0, 5).map((m: any, i: number) => {
          const avatar = MONSTER_AVATARS[m.avatarIndex % MONSTER_AVATARS.length] || MONSTER_AVATARS[0];
          return `<div style="width:40px; height:40px; border-radius:50%; background:var(--color-eggshell); display:flex; align-items:center; justify-content:center; overflow:hidden; border:2px solid ${m.isReady ? '#10b981' : 'var(--color-border)'}; margin-left:${i > 0 ? '-10px' : '0'}; position:relative; z-index:${5-i};">${avatar}</div>`;
        }).join('');

        const sessionEp = existingSquad.session?.currentEpisodeNumber || 2;

        waitingOverlay.innerHTML = `
          <div class="squad-gate-card" style="text-align:center;">
            <div class="squad-gate-glow"></div>
            <div style="padding:32px 24px;">
              <div style="font-size:2.5rem; margin-bottom:12px;">🛡️</div>
              <h2 style="font-family:var(--font-heading); font-size:1.3rem; font-weight:700; color:var(--color-text-primary); margin:0 0 8px;">Your Squad Is Waiting!</h2>
              <p style="color:var(--color-text-secondary); font-size:0.9rem; line-height:1.5; margin:0 0 20px;">
                You're already part of <strong>${existingSquad.squad.name}</strong>. 
                ${existingSquad.squad.status === 'forming' 
                  ? 'Head to the lobby to ready up with your team!'
                  : `Your squad is on Episode ${sessionEp}. Jump in!`
                }
              </p>

              <div style="display:flex; align-items:center; justify-content:center; margin-bottom:20px;">
                ${memberAvatars}
                <span style="font-size:0.78rem; color:var(--color-text-muted); margin-left:8px;">${existingSquad.members.length}/5 members</span>
              </div>

              ${existingSquad.squad.status === 'forming' ? `
                <button id="sg-existing-lobby" style="width:100%; padding:14px; background:linear-gradient(135deg, var(--color-purple), #7c3aed); color:white; border:none; border-radius:var(--radius-lg); font-weight:700; font-size:0.95rem; cursor:pointer; margin-bottom:10px;">🛡️ Enter Squad Lobby</button>
              ` : `
                <button id="sg-existing-read" style="width:100%; padding:14px; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:var(--radius-lg); font-weight:700; font-size:0.95rem; cursor:pointer; margin-bottom:10px;">📚 Resume Episode ${sessionEp}</button>
              `}
              <button id="sg-existing-close" style="width:100%; padding:10px; background:var(--color-eggshell); color:var(--color-text-secondary); border:1px solid var(--color-border); border-radius:var(--radius-lg); font-size:0.85rem; cursor:pointer;">Close</button>
            </div>
          </div>
        `;

        document.body.appendChild(waitingOverlay);

        const closeExisting = () => {
          waitingOverlay.classList.remove('open');
          document.body.style.overflow = '';
          setTimeout(() => waitingOverlay.remove(), 300);
        };

        document.getElementById('sg-existing-lobby')?.addEventListener('click', () => {
          closeExisting();
          localStorage.setItem('drive_active_squad_id', existingSquad.squad.id);
          navigate('squad-lobby/' + existingSquad.squad.id);
        });

        document.getElementById('sg-existing-read')?.addEventListener('click', async () => {
          closeExisting();
          localStorage.setItem('drive_active_squad_id', existingSquad.squad.id);
          // Find the correct episode story ID
          if (existingSquad.session) {
            const { fetchStoryByGroupAndEpisode } = await import('../lib/db.ts');
            const epData = await fetchStoryByGroupAndEpisode(
              existingSquad.session.storyGroupId,
              existingSquad.session.currentEpisodeNumber
            );
            if (epData) {
              navigate('story/' + epData.id);
              return;
            }
          }
          navigate('story/' + existingSquad.squad.storyId);
        });

        document.getElementById('sg-existing-close')?.addEventListener('click', closeExisting);
        return;
      }
    } catch (err) {
      console.warn('[SquadGate] Error checking existing squads:', err);
      // Continue with normal flow if check fails
    }
  }

  try {
    const activeSquadId = localStorage.getItem('drive_active_squad_id');
    let found = false;

    if (activeSquadId) {
      const squad = await fetchSquadById(activeSquadId);
      if (squad && squad.storyId === options.storyId && squad.status === 'forming') {
        currentSquadId = squad.id;
        currentInviteCode = squad.inviteCode;
        currentSquadName = squad.name;
        found = true;
      }
    }

    if (!found) {
      const username = localStorage.getItem('drive_username') || getUser()?.user_metadata?.username || 'Player';
      const squadName = `${username}'s Squad`;
      const result = await dbCreateSquad(options.storyId, squadName);
      if (result) {
        currentSquadId = result.squadId;
        currentInviteCode = result.inviteCode;
        currentSquadName = squadName;
        localStorage.setItem('drive_active_squad_id', currentSquadId);
      }
    }

    if (currentSquadId) {
      currentMembers = await getSquadMembers(currentSquadId);
    }
  } catch (err) {
    console.error('Error initializing squad:', err);
    alert('Failed to initialize squad. Please try again.');
    loadingOverlay.remove();
    return;
  }

  loadingOverlay.remove();

  // Remove any existing squad gate modal
  const existing = document.getElementById('squad-gate-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'squad-gate-overlay';
  overlay.id = 'squad-gate-modal';

  overlay.innerHTML = `
    <div class="squad-gate-card">
      <div class="squad-gate-glow"></div>
      
      <!-- Header -->
      <div class="squad-gate-header">
        <div class="squad-gate-badge">
          <span class="squad-gate-badge-dot"></span>
          <span>SQUAD GATE REACHED</span>
        </div>
        <button class="squad-gate-close" id="squad-gate-close-btn" aria-label="Close modal">✕</button>
      </div>

      <!-- Hero Title -->
      <div class="squad-gate-hero">
        <h2 class="squad-gate-title">Journey with a Squad</h2>
        <p class="squad-gate-subtitle">
          You've completed <strong>${options.storyTitle} • Ep. ${options.episodeNumber || 1}</strong>. To unlock Episode ${(options.episodeNumber || 1) + 1} and continue your journey, form or join a Squad of <strong>3 to 5 players</strong>.
        </p>
      </div>

      <!-- Content Area -->
      <div class="squad-gate-body" id="squad-gate-body">
        ${renderBody(options)}
      </div>

      <!-- Footer Sub-actions -->
      <div class="squad-gate-footer">
        <button class="squad-gate-btn-secondary" id="sg-btn-replay">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Replay Ep. ${options.episodeNumber || 1}
        </button>
        <button class="squad-gate-btn-secondary" id="sg-btn-catalog">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Browse Stories
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });

  attachListeners(options, overlay);
}

function renderBody(options: SquadGateOptions): string {
  const code = currentInviteCode || '...';
  const minMembers = 3;
  const maxMembers = 5;

  const slots = [];
  for (let i = 0; i < maxMembers; i++) {
    const member = currentMembers[i];
    if (member) {
      const avatarSvg = MONSTER_AVATARS[member.avatarIndex] || MONSTER_AVATARS[0];
      const roleText = member.role === 'driver' ? 'DRiVER' : 'Player';
      slots.push(`
        <div class="squad-slot filled">
          <div class="squad-slot-avatar">${avatarSvg}</div>
          <div class="squad-slot-info">
            <span class="squad-slot-name">${member.username}</span>
            <span class="squad-slot-role">${roleText}</span>
          </div>
          <span class="squad-slot-status ${member.isReady ? 'ready' : 'waiting'}">${member.isReady ? 'Ready' : 'Waiting...'}</span>
        </div>
      `);
    } else {
      const isRequired = i < minMembers;
      slots.push(`
        <div class="squad-slot empty ${isRequired ? 'required' : 'optional'}">
          <div class="squad-slot-avatar empty">+</div>
          <div class="squad-slot-info">
            <span class="squad-slot-name">Open Slot ${i + 1}</span>
            <span class="squad-slot-role">${isRequired ? 'Required (Min 3)' : 'Optional (Max 5)'}</span>
          </div>
          <span class="squad-slot-status waiting">Waiting...</span>
        </div>
      `);
    }
  }

  return `
    <div class="squad-friends-view">
      <!-- Room Code & Share Card -->
      <div class="squad-code-card">
        <div class="squad-code-label">YOUR SQUAD ROOM CODE</div>
        <div class="squad-code-display">
          <span class="squad-code-value" id="sg-room-code-val">${code}</span>
          <button class="squad-code-copy-btn" id="sg-btn-copy-code" title="Copy code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span id="sg-copy-code-text">Copy</span>
          </button>
        </div>
        <button class="squad-link-share-btn" id="sg-btn-share-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span id="sg-share-link-text">Share Deep Link</span>
        </button>
      </div>

      <!-- Squad Member Slots (3 to 5 players) -->
      <div class="squad-slots-container">
        <div class="squad-slots-header">
          <span>Squad Members (${currentMembers.length}/${maxMembers})</span>
          <span class="squad-slots-rule">${currentMembers.length >= minMembers ? '✅ Ready to Launch' : `Need ${minMembers - currentMembers.length} more to start`}</span>
        </div>
        <div class="squad-slots-list">
          ${slots.join('')}
        </div>
      </div>

      <!-- Join existing squad row -->
      <div class="squad-join-row">
        <input type="text" class="squad-join-input" id="sg-join-input" placeholder="Have a friend's squad code? (e.g. DRV-824)" maxlength="10" />
        <button class="squad-join-btn" id="sg-join-btn">Join Squad</button>
      </div>

      <!-- Open Full Squad Lobby Button -->
      <button class="squad-open-lobby-btn" id="sg-open-lobby-btn" style="
        width: 100%; margin-top: 14px; padding: 12px 18px; border-radius: var(--radius-lg);
        background: linear-gradient(135deg, var(--color-purple) 0%, #7c3aed 100%);
        color: white; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700;
        border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
        box-shadow: 0 4px 14px rgba(138,43,226,0.35);
      ">
        <span>🛡️ Enter Squad Mission Lobby & Ready Up</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  `;
}

function attachListeners(options: SquadGateOptions, overlay: HTMLElement): void {
  const close = () => {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 300);
    if (options.onClose) options.onClose();
  };

  overlay.querySelector('#squad-gate-close-btn')?.addEventListener('click', close);
  
  overlay.querySelector('#sg-btn-replay')?.addEventListener('click', () => {
    close();
    if (options.onReplay) options.onReplay();
  });

  overlay.querySelector('#sg-btn-catalog')?.addEventListener('click', () => {
    close();
    navigate('home');
  });

  attachBodySpecificListeners(options, overlay);
}

function attachBodySpecificListeners(options: SquadGateOptions, overlay: HTMLElement): void {
  // Copy room code
  overlay.querySelector('#sg-btn-copy-code')?.addEventListener('click', () => {
    if (!currentInviteCode) return;
    navigator.clipboard?.writeText(currentInviteCode).then(() => {
      const txt = overlay.querySelector('#sg-copy-code-text');
      if (txt) txt.textContent = 'Copied!';
      setTimeout(() => { if (txt) txt.textContent = 'Copy'; }, 2000);
    });
  });

  // Copy share link
  overlay.querySelector('#sg-btn-share-link')?.addEventListener('click', () => {
    if (!currentInviteCode) return;
    const shareUrl = `${window.location.origin}/#join?squad=${currentInviteCode}&story=${options.storyId}`;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      const txt = overlay.querySelector('#sg-share-link-text');
      if (txt) txt.textContent = 'Link Copied!';
      setTimeout(() => { if (txt) txt.textContent = 'Share Deep Link'; }, 2000);
    });
  });

  // Join squad via code input
  overlay.querySelector('#sg-join-btn')?.addEventListener('click', async () => {
    const input = overlay.querySelector('#sg-join-input') as HTMLInputElement | null;
    const code = input?.value.trim().toUpperCase() || '';
    if (!code) return;
    
    const btn = overlay.querySelector('#sg-join-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Joining...';

    try {
      const res = await dbJoinSquadByCode(code);
      if (res) {
        currentSquadId = res.squadId;
        currentInviteCode = code;
        currentSquadName = res.name;
        localStorage.setItem('drive_active_squad_id', currentSquadId);
        
        // Refresh members and re-render body
        currentMembers = await getSquadMembers(currentSquadId);
        const body = overlay.querySelector('#squad-gate-body');
        if (body) {
          body.innerHTML = renderBody(options);
          attachBodySpecificListeners(options, overlay);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to join squad.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Join Squad';
    }
  });

  // Open Squad Lobby & Ready Up
  overlay.querySelector('#sg-open-lobby-btn')?.addEventListener('click', () => {
    closeSquadGateModal();
    if (currentSquadId) {
      localStorage.setItem('drive_active_squad_id', currentSquadId);
      navigate('squad-lobby/' + currentSquadId);
    }
  });
}

export function closeSquadGateModal(): void {
  const overlay = document.getElementById('squad-gate-modal');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 300);
  }
}

export function openSquadGateFromDeepLink(storyId: string, storyTitle: string, squadCode: string): void {
  localStorage.setItem('drive_pending_squad_join', JSON.stringify({
    storyId,
    storyTitle,
    squadCode,
    timestamp: Date.now()
  }));

  if (isAuthenticated()) {
    dbJoinSquadByCode(squadCode)
      .then(result => {
        if (result) {
          localStorage.setItem('drive_active_squad_id', result.squadId);
          navigate('squad-lobby/' + result.squadId);
        }
      })
      .catch(err => {
        console.error('Deep link join error:', err);
        alert(err.message || 'Failed to join squad via deep link.');
        navigate('home');
      });
  } else {
    // Rely on the welcome overlay logic in main.ts which handles unauthenticated deep links
    navigate('home');
  }
}
