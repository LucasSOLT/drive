import { MONSTER_AVATARS } from '../data/avatars.ts';

export interface PlayerQueueItem {
  id: string;
  username: string;
  avatarIndex: number;
  bio: string;
  timezone: string;
  availability: string[];
}

const DEMO_PLAYERS: PlayerQueueItem[] = [
  {
    id: 'demo-player-1',
    username: 'CyberKnight',
    avatarIndex: 1,
    bio: 'Love fast-paced sci-fi choices and mystery stories. Usually available for evening squad runs!',
    timezone: 'US/Eastern (EST)',
    availability: ['Evening', 'Late Night'],
  },
  {
    id: 'demo-player-2',
    username: 'StarGazer_99',
    avatarIndex: 4,
    bio: 'Casual reader exploring fantasy adventures. Always down to join a new squad and share decisions with cool people.',
    timezone: 'US/Pacific (PST)',
    availability: ['Afternoon', 'Evening'],
  },
  {
    id: 'demo-player-3',
    username: 'BookWorm_Sam',
    avatarIndex: 7,
    bio: 'Voracious reader looking for active drivers. Ready to dive into action, thrillers, and deep lore.',
    timezone: 'US/Central (CST)',
    availability: ['Morning', 'Afternoon'],
  },
];

const invitedIds = new Set<string>();

function truncateBio(bio: string, maxLen: number = 80): string {
  if (bio.length <= maxLen) return bio;
  return bio.substring(0, maxLen).trim() + '...';
}

function renderPlayerCard(player: PlayerQueueItem): string {
  const isInvited = invitedIds.has(player.id);
  const avatarSvg = MONSTER_AVATARS[player.avatarIndex % MONSTER_AVATARS.length] || MONSTER_AVATARS[0];
  const truncatedBio = truncateBio(player.bio, 80);

  const availTagsHtml = player.availability
    .map(
      tag => `<span style="
        font-size: 0.72rem;
        background: var(--color-eggshell);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
        padding: 2px 8px;
        border-radius: var(--radius-lg);
        font-weight: 500;
      ">${tag}</span>`
    )
    .join('');

  return `
    <div class="player-card" data-player-id="${player.id}" style="
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-md);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    ">
      <div style="display: flex; align-items: flex-start; gap: var(--space-md);">
        <!-- Avatar -->
        <div style="
          width: 52px;
          height: 52px;
          min-width: 52px;
          border-radius: 50%;
          background: var(--color-eggshell);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 1px solid var(--color-border);
          padding: 2px;
          flex-shrink: 0;
        ">
          ${avatarSvg}
        </div>

        <!-- Info -->
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-xs); flex-wrap: wrap; margin-bottom: 4px;">
            <h3 style="
              font-family: var(--font-heading);
              font-size: 1.05rem;
              font-weight: 700;
              color: var(--color-text-primary);
              margin: 0;
            ">${player.username}</h3>
            
            <span style="
              font-size: 0.72rem;
              background: rgba(139, 92, 246, 0.12);
              color: var(--color-purple);
              font-weight: 600;
              padding: 2px 8px;
              border-radius: var(--radius-lg);
            ">${player.timezone}</span>
          </div>

          <p style="
            font-family: var(--font-body);
            font-size: 0.88rem;
            color: var(--color-text-secondary);
            margin: 0 0 8px 0;
            line-height: 1.4;
          ">${truncatedBio}</p>

          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            ${availTagsHtml}
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--color-border);">
        <button class="btn send-invite-btn" data-player-id="${player.id}" ${isInvited ? 'disabled' : ''} style="
          background: ${isInvited ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-purple) 0%, #7c3aed 100%)'};
          color: ${isInvited ? 'var(--color-text-muted)' : '#ffffff'};
          border: none;
          border-radius: var(--radius-lg);
          padding: 8px 16px;
          font-family: var(--font-heading);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: ${isInvited ? 'default' : 'pointer'};
          transition: opacity 0.2s ease, transform 0.1s ease;
          box-shadow: ${isInvited ? 'none' : 'var(--shadow-sm)'};
        ">
          ${isInvited ? 'Invite Sent ✓' : 'Send Invite'}
        </button>
      </div>
    </div>
  `;
}

function renderPlayerList(players: PlayerQueueItem[]): string {
  if (players.length === 0) {
    return `
      <div style="
        text-align: center;
        padding: var(--space-xl);
        background: var(--color-surface);
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-lg);
        color: var(--color-text-muted);
        font-family: var(--font-body);
      ">
        <p style="margin: 0; font-size: 0.9rem;">No players found matching your filters.</p>
      </div>
    `;
  }
  return players.map(player => renderPlayerCard(player)).join('');
}

export function render(): string {
  return `
    <div class="view-lfg-browse fade-in" id="lfg-browse-container" style="
      padding: var(--space-md);
      max-width: 600px;
      margin: 0 auto;
      min-height: 100%;
      box-sizing: border-box;
      background-color: var(--color-eggshell);
    ">
      <!-- Title Section -->
      <div class="section__header slide-up stagger-1" style="margin-bottom: var(--space-md);">
        <h1 style="
          font-family: var(--font-heading);
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0 0 4px 0;
        ">Find Players</h1>
        <p style="
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          margin: 0;
        ">Browse the LFG queue to recruit players for your squad</p>
      </div>

      <!-- Filter Bar -->
      <div class="lfg-filter-bar slide-up stagger-2" style="
        background: var(--color-surface);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-sm) var(--space-md);
        box-shadow: var(--shadow-sm);
        margin-bottom: var(--space-lg);
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
      ">
        <!-- Timezone Filter -->
        <div style="flex: 1; min-width: 140px;">
          <label for="lfg-filter-timezone" style="
            display: block;
            font-family: var(--font-heading);
            font-size: 0.72rem;
            font-weight: 600;
            color: var(--color-text-muted);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Timezone</label>
          <select id="lfg-filter-timezone" style="
            width: 100%;
            padding: 8px 12px;
            font-family: var(--font-body);
            font-size: 0.85rem;
            background: var(--color-eggshell);
            color: var(--color-text-primary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            outline: none;
            cursor: pointer;
          ">
            <option value="All">All Timezones</option>
            <option value="US/Pacific (PST)">US/Pacific (PST)</option>
            <option value="US/Mountain (MST)">US/Mountain (MST)</option>
            <option value="US/Central (CST)">US/Central (CST)</option>
            <option value="US/Eastern (EST)">US/Eastern (EST)</option>
            <option value="Europe (GMT/CET)">Europe (GMT/CET)</option>
            <option value="Asia/Pacific (JST/AEST)">Asia/Pacific (JST/AEST)</option>
          </select>
        </div>

        <!-- Availability Filter -->
        <div style="flex: 1; min-width: 140px;">
          <label for="lfg-filter-avail" style="
            display: block;
            font-family: var(--font-heading);
            font-size: 0.72rem;
            font-weight: 600;
            color: var(--color-text-muted);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Availability</label>
          <select id="lfg-filter-avail" style="
            width: 100%;
            padding: 8px 12px;
            font-family: var(--font-body);
            font-size: 0.85rem;
            background: var(--color-eggshell);
            color: var(--color-text-primary);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            outline: none;
            cursor: pointer;
          ">
            <option value="All">All</option>
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
            <option value="Late Night">Late Night</option>
          </select>
        </div>
      </div>

      <!-- Player Cards Container -->
      <div id="lfg-player-list" class="slide-up stagger-3" style="
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      ">
        ${renderPlayerList(DEMO_PLAYERS)}
      </div>
    </div>
  `;
}

export function init(): void {
  const timezoneSelect = document.getElementById('lfg-filter-timezone') as HTMLSelectElement | null;
  const availSelect = document.getElementById('lfg-filter-avail') as HTMLSelectElement | null;
  const playerListContainer = document.getElementById('lfg-player-list');

  function updateList(): void {
    if (!playerListContainer) return;

    const tzValue = timezoneSelect?.value || 'All';
    const availValue = availSelect?.value || 'All';

    const filtered = DEMO_PLAYERS.filter(player => {
      const matchTz = tzValue === 'All' || player.timezone.toLowerCase().includes(tzValue.toLowerCase());
      const matchAvail = availValue === 'All' || player.availability.includes(availValue);
      return matchTz && matchAvail;
    });

    playerListContainer.innerHTML = renderPlayerList(filtered);
    bindInviteButtons();
  }

  function bindInviteButtons(): void {
    const inviteButtons = document.querySelectorAll<HTMLButtonElement>('.send-invite-btn');
    inviteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const playerId = btn.getAttribute('data-player-id');
        if (playerId) {
          invitedIds.add(playerId);
          btn.disabled = true;
          btn.textContent = 'Invite Sent ✓';
          btn.style.background = 'var(--color-border)';
          btn.style.color = 'var(--color-text-muted)';
          btn.style.cursor = 'default';
          btn.style.boxShadow = 'none';
        }
      });
    });
  }

  timezoneSelect?.addEventListener('change', updateList);
  availSelect?.addEventListener('change', updateList);

  bindInviteButtons();
}
