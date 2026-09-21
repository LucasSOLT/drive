import { fetchOfficialStories } from '../lib/db.ts';
import type { Story } from '../types.ts';
import { setSlotOverride } from '../state.ts';
import { renderStoryCard, renderEmptySlot } from './story-card.ts';

let currentSlotStoryId: string | null = null;
let currentSlotType: string = '';
let currentSlotIndex: number = 0;
let allStories: Story[] = [];
let isInsertDrawerOpen = false;

/**
 * Opens the full-screen Configuration popup when an admin/GM clicks a story tile
 * in Content Management (Manage Story Tiles) mode.
 */
export function openTileConfigModal(options: {
  storyId: string | null;
  slotType: string;
  slotIndex: number;
  storyTitle?: string;
}): void {
  currentSlotStoryId = options.storyId;
  currentSlotType = options.slotType;
  currentSlotIndex = options.slotIndex;
  isInsertDrawerOpen = false;

  // Remove any existing modal
  document.getElementById('tile-config-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tile-config-modal';
  overlay.className = 'tile-config-overlay';
  overlay.innerHTML = `
    <div class="tile-config-card">
      <div class="tile-config-header">
        <div>
          <h2 class="tile-config-title">Configuration</h2>
          <span class="tile-config-slot-badge">${formatSlotLabel(currentSlotType, currentSlotIndex)}</span>
        </div>
        <button class="tile-config-close" id="tile-config-close" aria-label="Close">\u2715</button>
      </div>

      <div class="tile-config-body" id="tile-config-body">
        <!-- Current assignment -->
        <div class="tile-config-section">
          <div class="tile-config-section-label">Currently Assigned</div>
          <div class="tile-config-current" id="tile-config-current">
            ${options.storyTitle
              ? `<div class="tile-config-current-info">
                   <span class="tile-config-current-title">${escapeHtml(options.storyTitle)}</span>
                   <span class="tile-config-current-id" style="font-size:0.7rem; color:var(--color-text-muted);">ID: ${options.storyId || 'N/A'}</span>
                 </div>`
              : `<div class="tile-config-current-empty">No story assigned to this slot</div>`
            }
          </div>
        </div>

        <!-- Insert story action -->
        <!-- Insert / Change story action -->
        <div style="display:flex; gap:10px; margin-bottom:16px;">
          <button class="tile-config-insert-btn" id="tile-config-insert-btn" style="flex:1; margin-bottom:0;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${options.storyId ? 'Change story' : 'Insert story'}
          </button>
          ${options.storyId ? `
          <button class="tile-config-remove-btn" id="tile-config-remove-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Remove
          </button>
          ` : ''}
        </div>

        <!-- Insert Story Drawer (hidden initially) -->
        <div class="tile-config-drawer" id="tile-config-drawer" style="display:none;">
          <div class="tile-config-search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="tile-config-search-input" id="tile-config-search" placeholder="Search all DRiVE Originals..." autocomplete="off" />
          </div>
          <div class="tile-config-grid" id="tile-config-grid">
            <div style="text-align:center; padding:30px; color:var(--color-text-muted);">Loading stories...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Force reflow then add 'open' class for animation
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });

  // Close button
  document.getElementById('tile-config-close')?.addEventListener('click', closeTileConfigModal);

  // Backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTileConfigModal();
  });

  // Insert story button
  document.getElementById('tile-config-insert-btn')?.addEventListener('click', async () => {
    if (isInsertDrawerOpen) {
      const drawer = document.getElementById('tile-config-drawer');
      if (drawer) drawer.style.display = 'none';
      isInsertDrawerOpen = false;
      return;
    }

    isInsertDrawerOpen = true;
    const drawer = document.getElementById('tile-config-drawer');
    if (drawer) drawer.style.display = 'block';

    try {
      allStories = await fetchOfficialStories();
      renderStoryGrid(allStories);
    } catch (err) {
      const grid = document.getElementById('tile-config-grid');
      if (grid) grid.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Failed to load stories</div>`;
    }
  });

  // Remove story button
  document.getElementById('tile-config-remove-btn')?.addEventListener('click', () => {
    setSlotOverride(currentSlotType, currentSlotIndex, null);
    const currentEl = document.getElementById('tile-config-current');
    if (currentEl) {
      currentEl.innerHTML = `
        <div class="tile-config-current-empty" style="color:#ef4444; font-weight:700;">
          ✕ Removed — Slot is now empty
        </div>
      `;
    }
    currentSlotStoryId = null;
    updateGridSlotInView(currentSlotType, currentSlotIndex, null);
    console.log(`[CM] Removed story from slot ${currentSlotType}[${currentSlotIndex}]`);

    setTimeout(() => {
      document.getElementById('tile-config-modal')?.remove();
    }, 600);
  });

  // Search input (live filtering)
  document.getElementById('tile-config-search')?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (!query) {
      renderStoryGrid(allStories);
      return;
    }
    const filtered = allStories.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.author.toLowerCase().includes(query) ||
      s.genre.toLowerCase().includes(query) ||
      (s.synopsis || '').toLowerCase().includes(query)
    );
    renderStoryGrid(filtered);
  });
}

export function closeTileConfigModal(): void {
  const overlay = document.getElementById('tile-config-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 250);
}

function renderStoryGrid(stories: Story[]): void {
  const grid = document.getElementById('tile-config-grid');
  if (!grid) return;

  if (stories.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--color-text-muted);">
        <div style="font-size:1.5rem; margin-bottom:8px;">\uD83D\uDCED</div>
        No stories found
      </div>
    `;
    return;
  }

  // Group by storyGroupId
  const groupMap = new Map<string, Story[]>();
  for (const story of stories) {
    const gid = story.storyGroupId || story.id;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(story);
  }

  // Sort episodes within each group
  for (const eps of groupMap.values()) {
    eps.sort((a, b) => (a.episodeNumber || 1) - (b.episodeNumber || 1));
  }

  const groups = Array.from(groupMap.values());

  grid.innerHTML = groups.map(episodes => {
    const ep1 = episodes[0];
    const totalEps = episodes.length;
    const cover = ep1.coverImage || ep1.coverVideo || '';
    const isLive = ep1.officialStatus === 'live';
    const statusBadge = isLive ? '<span style="color:#10b981; font-weight:700;">LIVE</span>' : '<span style="color:#ef4444; font-weight:700;">DRAFT</span>';

    return `
      <div class="tile-config-story-card" style="display:flex; gap:12px; padding:12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); cursor:pointer; align-items:center;" data-insert-story-id="${ep1.id}">
        <div style="width:60px; height:80px; border-radius:8px; overflow:hidden; flex-shrink:0; background:var(--color-bg);">
          ${cover ? `<img src="${cover}" style="width:100%; height:100%; object-fit:cover;" alt="">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📚</div>'}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:0.88rem; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(ep1.title) || 'Untitled'}</div>
          <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:2px;">${ep1.genre || 'Unknown'} · ${totalEps} Ep${totalEps > 1 ? 's' : ''} · ${statusBadge}</div>
        </div>
        ${isLive 
          ? `<button class="tile-config-select-btn" data-select-story-id="${ep1.id}" style="padding:8px 14px; background:var(--color-purple); color:white; border:none; border-radius:var(--radius-md); font-size:0.78rem; font-weight:700; cursor:pointer; white-space:nowrap;">Insert</button>`
          : `<span style="padding:8px 14px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:var(--radius-md); font-size:0.72rem; color:var(--color-text-muted);">Not Live</span>`
        }
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-select-story-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const storyId = (btn as HTMLElement).getAttribute('data-select-story-id');
      if (storyId) {
        handleStoryInserted(storyId);
      }
    });
  });
}

function handleStoryInserted(storyId: string): void {
  const story = allStories.find(s => s.id === storyId);
  if (!story) return;

  try {
    setSlotOverride(currentSlotType, currentSlotIndex, storyId);
    currentSlotStoryId = storyId;

    updateGridSlotInView(currentSlotType, currentSlotIndex, story);
    console.log(`[CM] Inserted story "${story.title}" (${story.id}) into slot ${currentSlotType}[${currentSlotIndex}]`);

    // Show success feedback
    const modal = document.getElementById('tile-config-modal');
    if (modal) {
      modal.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; height:100%;">
          <div style="font-size:3rem; margin-bottom:12px;">✅</div>
          <p style="font-size:1.2rem; font-weight:700; color:var(--color-text-primary);">Story Placed!</p>
          <p style="font-size:0.9rem; color:var(--color-text-muted); margin:8px 0 20px;">The tile will update when you return to the home page.</p>
          <button id="tile-config-done" style="padding:10px 24px; background:var(--color-purple); color:white; border:none; border-radius:var(--radius-md); font-weight:700; cursor:pointer;">Done</button>
        </div>
      `;
      document.getElementById('tile-config-done')?.addEventListener('click', () => {
        modal.remove();
      });
    }
  } catch (err) {
    console.error('Failed to place story on tile:', err);
    alert('Failed to place story on tile. Please try again.');
  }
}

function updateGridSlotInView(slotType: string, slotIndex: number, story: Story | null): void {
  let containerId = '';
  if (slotType === 'home-bestselling') containerId = 'home-bestselling-grid';
  else if (slotType === 'home-featured') containerId = 'home-featured-grid';
  else if (slotType === 'explore-grid') containerId = 'explore-grid';
  else if (slotType === 'featured-hero') containerId = 'featured-hero';
  else if (slotType === 'featured-rising') containerId = 'featured-rising-stars';
  else if (slotType === 'featured-staff') containerId = 'featured-staff-picks';

  const container = containerId ? document.getElementById(containerId) : null;
  if (!container) return;

  const cards = Array.from(container.querySelectorAll('.story-card'));
  const targetCard = cards[slotIndex];
  if (!targetCard) return;

  const isHero = slotType === 'featured-hero' || (slotType === 'home-featured' && (slotIndex === 0 || slotIndex === 3));
  const variant = isHero ? 'hero' : 'full';

  if (!story) {
    const div = document.createElement('div');
    div.innerHTML = renderEmptySlot(slotType, slotIndex, variant);
    const placeholder = div.firstElementChild;
    if (placeholder) {
      targetCard.replaceWith(placeholder);
    }
  } else {
    const div = document.createElement('div');
    div.innerHTML = renderStoryCard(story, variant);
    const newCard = div.firstElementChild;
    if (newCard) {
      targetCard.replaceWith(newCard);
    }
  }
}

function formatSlotLabel(slotType: string, index: number): string {
  const labels: Record<string, string> = {
    'home-bestselling': 'Home \u2022 Best-Selling',
    'home-featured': 'Home \u2022 Featured',
    'featured-hero': 'Featured • Editor\'s Pick',
    'featured-staff': 'Featured • Staff Picks',
    'featured-rising': 'Featured • Rising Stars',
    'explore-grid': 'Explore • Discovery Grid',
  };
  const base = labels[slotType] || slotType;
  return `${base} \u2022 Slot #${index + 1}`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

