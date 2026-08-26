import { fetchOfficialStories } from '../lib/db.ts';
import type { Story } from '../types.ts';

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
        <button class="tile-config-insert-btn" id="tile-config-insert-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Insert story
        </button>

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

  grid.innerHTML = stories.map(story => {
    const formatLabel = story.format === 'book' ? '\uD83D\uDCD6 Book' : '\uD83D\uDCDC Waterfall';
    const statusLabel = story.officialStatus === 'live'
      ? '<span style="color:#22c55e; font-weight:700;">LIVE</span>'
      : '<span style="color:#f59e0b; font-weight:700;">DRAFT</span>';
    const coverHtml = story.coverImage
      ? `<img src="${story.coverImage}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" />`
      : `<div style="width:100%; height:100%; background:linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.1)); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">\uD83D\uDCD6</div>`;
    const epBadge = story.episodeNumber ? `EP ${story.episodeNumber}` : 'EP 1';

    return `
      <div class="tile-config-story-card" data-insert-story-id="${story.id}">
        <div class="tile-config-story-cover">
          ${coverHtml}
          <span class="tile-config-ep-badge">${epBadge}</span>
        </div>
        <div class="tile-config-story-info">
          <div class="tile-config-story-title">${escapeHtml(story.title)}</div>
          <div class="tile-config-story-meta">
            <span>${formatLabel}</span>
            <span>\u2022</span>
            ${statusLabel}
            <span>\u2022</span>
            <span>${story.genre}</span>
          </div>
          <button class="tile-config-select-btn" data-select-story-id="${story.id}">Insert</button>
        </div>
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

  const currentEl = document.getElementById('tile-config-current');
  if (currentEl) {
    currentEl.innerHTML = `
      <div class="tile-config-current-info">
        <span class="tile-config-current-title">${escapeHtml(story.title)}</span>
        <span class="tile-config-current-id" style="font-size:0.7rem; color:var(--color-text-muted);">ID: ${story.id}</span>
      </div>
    `;
  }

  const drawer = document.getElementById('tile-config-drawer');
  if (drawer) drawer.style.display = 'none';
  isInsertDrawerOpen = false;

  console.log(`[CM] Inserted story "${story.title}" (${story.id}) into slot ${currentSlotType}[${currentSlotIndex}]`);
}

function formatSlotLabel(slotType: string, index: number): string {
  const labels: Record<string, string> = {
    'home-bestselling': 'Home \u2022 Best-Selling',
    'home-featured': 'Home \u2022 Featured',
    'featured-hero': 'Featured \u2022 Editor\'s Pick',
    'featured-rising': 'Featured \u2022 Rising Stars',
    'explore-grid': 'Explore \u2022 Discovery Grid',
  };
  const base = labels[slotType] || slotType;
  return `${base} \u2022 Slot #${index + 1}`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
