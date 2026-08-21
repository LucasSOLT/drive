import { navigate } from '../router.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';

export interface SquadMember {
  userId: string;
  username: string;
  avatarIndex: number;
  role: 'driver' | 'player';
}

export interface SquadData {
  id: string;
  name: string;
  driverId: string;
  inviteCode: string;
  minSize: number;
  maxSize: number;
  members: SquadMember[];
}

// Default mock state for UI rendering until backend integration
let currentSquad: SquadData = {
  id: 'squad-demo',
  name: 'Speed Demons',
  driverId: 'current-user',
  inviteCode: 'DRV-7892',
  minSize: 3,
  maxSize: 5,
  members: [
    { userId: 'current-user', username: 'You (DRIVER)', avatarIndex: 0, role: 'driver' },
    { userId: 'user-2', username: 'Alex', avatarIndex: 3, role: 'player' },
  ],
};

export function setLobbySquadData(data: SquadData): void {
  currentSquad = data;
}

export function render(): string {
  const memberCount = currentSquad.members.length;
  const isDriver = true; // DRIVER perspective by default for creation
  const canStart = memberCount >= currentSquad.minSize;

  // Build 5 slots (joined members + empty placeholders)
  const slotsHtml = Array.from({ length: currentSquad.maxSize }).map((_, i) => {
    const member = currentSquad.members[i];
    if (member) {
      const avatarSvg = MONSTER_AVATARS[member.avatarIndex] || MONSTER_AVATARS[0];
      return `
        <div class="squad-slot squad-slot--filled" style="
          display: flex; align-items: center; gap: var(--space-md);
          background: var(--color-surface); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg); padding: var(--space-sm) var(--space-md);
          box-shadow: var(--shadow-sm);
        ">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--color-eggshell); display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
            ${avatarSvg}
          </div>
          <div style="flex: 1;">
            <div style="font-family: var(--font-heading); font-weight: 600; font-size: 0.95rem; color: var(--color-text-primary); display: flex; align-items: center; gap: 6px;">
              ${member.username}
              ${member.role === 'driver' ? '<span style="font-size: 0.68rem; background: linear-gradient(135deg, var(--color-purple) 0%, var(--color-purple-dark) 100%); color: white; padding: 2px 6px; border-radius: var(--radius-full); font-weight: 700;">DRIVER</span>' : ''}
            </div>
            <span style="font-size: 0.78rem; color: var(--color-text-muted);">Ready</span>
          </div>
        </div>
      `;
    }
    return `
      <div class="squad-slot squad-slot--empty" style="
        display: flex; align-items: center; justify-content: center; gap: var(--space-sm);
        border: 2px dashed var(--color-border); border-radius: var(--radius-lg);
        padding: var(--space-md); color: var(--color-text-muted); font-size: 0.88rem;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Waiting for player...</span>
      </div>
    `;
  }).join('');

  return `
    <div class="view-squad-lobby fade-in" id="squad-lobby-container" style="padding: var(--space-md);">
      
      <!-- Squad Title Card -->
      <div class="squad-lobby-card slide-up stagger-1" style="
        background: var(--color-surface); border: 1.5px solid var(--color-border);
        border-radius: var(--radius-xl); padding: var(--space-lg); box-shadow: var(--shadow-md);
        margin-bottom: var(--space-md); text-align: center;
      ">
        <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-purple); font-weight: 700;">Squad Lobby</span>
        <h1 id="squad-name-title" style="font-family: var(--font-heading); font-size: 1.6rem; font-weight: 700; color: var(--color-text-primary); margin: 4px 0 12px 0;">${currentSquad.name}</h1>
        
        <!-- Invite Link Box -->
        <div style="
          display: flex; align-items: center; justify-content: space-between;
          background: var(--color-eggshell); border: 1px solid var(--color-border);
          border-radius: var(--radius-full); padding: 6px 6px 6px 16px; margin: 0 auto; max-width: 320px;
        ">
          <span style="font-family: monospace; font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary);" id="invite-code-text">Code: ${currentSquad.inviteCode}</span>
          <button id="copy-invite-btn" class="btn btn--primary btn--sm" style="border-radius: var(--radius-full); font-size: 0.78rem; padding: 6px 14px;">Copy Code</button>
        </div>
      </div>

      <!-- Player Progress Bar -->
      <div class="slide-up stagger-2" style="margin-bottom: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.85rem;">
          <span style="color: var(--color-text-secondary); font-weight: 500;">Squad Members</span>
          <span style="color: ${canStart ? 'var(--color-purple)' : 'var(--color-text-muted)'}; font-weight: 700;">${memberCount} of ${currentSquad.minSize} min required</span>
        </div>
        <div style="height: 8px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(100, (memberCount / currentSquad.minSize) * 100)}%; background: linear-gradient(90deg, var(--color-purple) 0%, var(--color-blue) 100%); transition: width 0.3s ease;"></div>
        </div>
      </div>

      <!-- Members Grid -->
      <div class="squad-members-list slide-up stagger-3" style="display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-xl);">
        ${slotsHtml}
      </div>

      <!-- Action Buttons -->
      <div class="squad-actions slide-up stagger-4" style="display: flex; flex-direction: column; gap: var(--space-sm);">
        <button id="start-story-btn" class="btn btn--primary" ${!canStart ? 'disabled' : ''} style="
          width: 100%; padding: var(--space-md); font-size: 1.05rem; font-weight: 700;
          ${!canStart ? 'opacity: 0.5; cursor: not-allowed;' : ''}
        ">
          ${canStart ? '🚀 Start Story' : `Need ${currentSquad.minSize - memberCount} More Player${(currentSquad.minSize - memberCount) > 1 ? 's' : ''}`}
        </button>
        
        <button id="leave-squad-btn" class="btn btn--ghost" style="width: 100%; color: var(--color-red); font-size: 0.9rem;">
          Leave Squad
        </button>
      </div>

    </div>
  `;
}

export function init(): void {
  // Copy Invite Code button
  const copyBtn = document.getElementById('copy-invite-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentSquad.inviteCode).then(() => {
        copyBtn.textContent = 'Copied! ✨';
        setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 2000);
      });
    });
  }

  // Start Story button — Hard Stop: 3–5 player gate
  const startBtn = document.getElementById('start-story-btn');
  if (startBtn && !startBtn.hasAttribute('disabled')) {
    startBtn.addEventListener('click', () => {
      const memberCount = currentSquad.members.length;

      if (memberCount < currentSquad.minSize) {
        alert(`⚠️ Not enough players!\n\nYou need at least ${currentSquad.minSize} squad members to start. Currently: ${memberCount}.`);
        return;
      }
      if (memberCount > currentSquad.maxSize) {
        alert(`⚠️ Too many players!\n\nMaximum squad size is ${currentSquad.maxSize}. Currently: ${memberCount}. Please remove some members.`);
        return;
      }

      // Lock squad status and navigate to story
      navigate('explore');
    });
  }

  // Leave Squad button
  const leaveBtn = document.getElementById('leave-squad-btn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      navigate('path-select');
    });
  }
}
