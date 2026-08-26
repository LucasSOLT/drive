// ─── SQUAD GATE MODAL COMPONENT (Engine A - Module 2) ───

import { navigate } from '../router.ts';
import {
  type Squad,
  createSquad,
  getSquadByCode,
  joinSquadByCode,
  joinGlobalMatchmaking,
  getActiveSquadForStory
} from '../lib/squad.ts';

export interface SquadGateOptions {
  storyId: string;
  storyTitle: string;
  storyCoverImage?: string;
  episodeNumber?: number;
  onReplay?: () => void;
  onClose?: () => void;
}

let currentSquad: Squad | null = null;
let activeTab: 'friends' | 'global' = 'friends';

export function openSquadGateModal(options: SquadGateOptions): void {
  // Check if squad already exists for this story, or create one
  currentSquad = getActiveSquadForStory(options.storyId);
  if (!currentSquad) {
    currentSquad = createSquad({
      storyId: options.storyId,
      storyTitle: options.storyTitle,
      storyCoverImage: options.storyCoverImage,
    });
  }

  // Remove any existing squad gate modal
  const existing = document.getElementById('squad-gate-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'squad-gate-overlay';
  overlay.id = 'squad-gate-modal';

  overlay.innerHTML = `
    <div class="squad-gate-card">
      <!-- Glow effect top border -->
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
          You've completed <strong>${options.storyTitle} • Ep. 1</strong>. To unlock Episode 2 and continue your journey, form or join a Squad of <strong>3 to 5 players</strong>.
        </p>
      </div>

      <!-- Path Selector Tabs -->
      <div class="squad-gate-tabs">
        <button class="squad-gate-tab ${activeTab === 'friends' ? 'active' : ''}" id="sg-tab-friends">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Play with Friends
        </button>
        <button class="squad-gate-tab ${activeTab === 'global' ? 'active' : ''}" id="sg-tab-global">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Play Globally
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="squad-gate-body" id="squad-gate-body">
        ${renderTabContent(options)}
      </div>

      <!-- Footer Sub-actions -->
      <div class="squad-gate-footer">
        <button class="squad-gate-btn-secondary" id="sg-btn-replay">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Replay Ep. 1
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

  attachSquadGateListeners(options, overlay);
}

function renderTabContent(options: SquadGateOptions): string {
  if (activeTab === 'friends') {
    const code = currentSquad?.roomCode || 'DRV-777';
    const members = currentSquad?.members || [];
    const minMembers = currentSquad?.minMembers || 3;
    const maxMembers = currentSquad?.maxMembers || 5;

    const slots = [];
    for (let i = 0; i < maxMembers; i++) {
      const member = members[i];
      if (member) {
        slots.push(`
          <div class="squad-slot filled">
            <div class="squad-slot-avatar">${member.username.charAt(0).toUpperCase()}</div>
            <div class="squad-slot-info">
              <span class="squad-slot-name">${member.username}</span>
              <span class="squad-slot-role">${member.isHost ? 'Squad Leader' : 'Member'}</span>
            </div>
            <span class="squad-slot-status ready">Ready</span>
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
            <span>Squad Members (${members.length}/${maxMembers})</span>
            <span class="squad-slots-rule">${members.length >= minMembers ? '✅ Ready to Launch' : `Need ${minMembers - members.length} more to start`}</span>
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
      </div>
    `;
  } else {
    return `
      <div class="squad-global-view">
        <div class="squad-radar-container">
          <div class="squad-radar-pulse"></div>
          <div class="squad-radar-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
        </div>
        <h3 class="squad-global-headline">Finding a Squad Cohort</h3>
        <p class="squad-global-desc">
          We're grouping you with 2 to 4 active readers exploring <strong>${options.storyTitle}</strong>. As soon as quorum is reached, Episode 2 will unlock for your team.
        </p>
        <button class="squad-global-launch-btn" id="sg-btn-matchmake">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Enter Matchmaking Pool
        </button>
      </div>
    `;
  }
}

function attachSquadGateListeners(options: SquadGateOptions, overlay: HTMLElement): void {
  // Close
  const close = () => {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 300);
    if (options.onClose) options.onClose();
  };

  overlay.querySelector('#squad-gate-close-btn')?.addEventListener('click', close);

  // Tab switching
  overlay.querySelector('#sg-tab-friends')?.addEventListener('click', () => {
    activeTab = 'friends';
    refreshBody(options, overlay);
  });
  overlay.querySelector('#sg-tab-global')?.addEventListener('click', () => {
    activeTab = 'global';
    refreshBody(options, overlay);
  });

  // Replay
  overlay.querySelector('#sg-btn-replay')?.addEventListener('click', () => {
    close();
    if (options.onReplay) options.onReplay();
  });

  // Catalog
  overlay.querySelector('#sg-btn-catalog')?.addEventListener('click', () => {
    close();
    navigate('home');
  });

  attachBodySpecificListeners(options, overlay);
}

function refreshBody(options: SquadGateOptions, overlay: HTMLElement): void {
  const tabs = overlay.querySelectorAll('.squad-gate-tab');
  tabs.forEach(t => t.classList.remove('active'));
  if (activeTab === 'friends') overlay.querySelector('#sg-tab-friends')?.classList.add('active');
  if (activeTab === 'global') overlay.querySelector('#sg-tab-global')?.classList.add('active');

  const body = overlay.querySelector('#squad-gate-body');
  if (body) {
    body.innerHTML = renderTabContent(options);
    attachBodySpecificListeners(options, overlay);
  }
}

function attachBodySpecificListeners(options: SquadGateOptions, overlay: HTMLElement): void {
  // Copy room code
  overlay.querySelector('#sg-btn-copy-code')?.addEventListener('click', () => {
    const code = currentSquad?.roomCode || '';
    navigator.clipboard?.writeText(code).then(() => {
      const txt = overlay.querySelector('#sg-copy-code-text');
      if (txt) txt.textContent = 'Copied!';
      setTimeout(() => { if (txt) txt.textContent = 'Copy'; }, 2000);
    });
  });

  // Copy share link
  overlay.querySelector('#sg-btn-share-link')?.addEventListener('click', () => {
    const code = currentSquad?.roomCode || '';
    const shareUrl = `${window.location.origin}/#reader/${options.storyId}?squad=${code}`;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      const txt = overlay.querySelector('#sg-share-link-text');
      if (txt) txt.textContent = 'Link Copied!';
      setTimeout(() => { if (txt) txt.textContent = 'Share Deep Link'; }, 2000);
    });
  });

  // Join squad via code input
  overlay.querySelector('#sg-join-btn')?.addEventListener('click', () => {
    const input = overlay.querySelector('#sg-join-input') as HTMLInputElement | null;
    const code = input?.value.trim().toUpperCase() || '';
    if (!code) return;

    const res = joinSquadByCode(code);
    if (res.success && res.squad) {
      currentSquad = res.squad;
      refreshBody(options, overlay);
    } else {
      alert(res.message);
    }
  });

  // Matchmaking
  overlay.querySelector('#sg-btn-matchmake')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Matching you with a squad...';

    setTimeout(() => {
      currentSquad = joinGlobalMatchmaking(options.storyId, options.storyTitle, options.storyCoverImage);
      activeTab = 'friends';
      refreshBody(options, overlay);
    }, 1200);
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
