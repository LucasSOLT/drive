import type { UserStory, Story } from '../types.ts';
import {
  fetchAdminMetrics,
  fetchAdminStories,
  fetchOfficialStories,
  approveStoryAdmin,
  denyStoryAdmin,
  revertStoryAdmin,
  deleteStoryAdmin,
  deleteOfficialStory,
  toggleOfficialStoryFeatured,
  toggleOfficialStoryEditorPick,
  toggleUserStoryFeatured,
  toggleUserStoryEditorPick,
  checkIsGameMaster,
  hasAdminPrivileges,
  getUserRole,
  type AdminMetrics,
} from '../lib/db.ts';
import { showModal, hideModal } from '../components/modal.ts';

// ─── SVG Icons ───
const ICON = {
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  rotate: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  grip: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  crown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 20V9l4 3 4-7 4 7 4-3v11"/></svg>`,
  book: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  users: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
};

// ─── Tab types ───
type AdminTab = 'originals' | 'pending' | 'community' | 'gm-tools';

export function render(): string {
  const isGM = checkIsGameMaster();
  const roleBadge = isGM
    ? `<span style="background: linear-gradient(135deg, #F59E0B, #D97706); color: #000; padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px;">👑 GAME MASTER</span>`
    : `<span style="background: var(--color-purple); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px;">🛡️ ADMIN</span>`;

  return `
    <div class="view-admin fade-in" id="admin-container" style="display: flex; flex-direction: column; height: 100vh; overflow: hidden; font-family: var(--font-body);">
      
      <!-- Top Header Bar -->
      <header style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--color-border); background-color: var(--color-surface); position: sticky; top: 0; z-index: 10; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, var(--color-purple), #8a2be2); display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 1rem;">
            ${ICON.shield}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="margin: 0; font-family: var(--font-heading); font-size: 1.05rem; color: var(--color-text-primary);">Admin Creation Dashboard</h1>
              ${roleBadge}
            </div>
            <div style="font-size: 0.7rem; color: var(--color-text-muted); margin-top: 2px;">Manage official stories, moderate submissions & configure the platform</div>
          </div>
        </div>
      </header>

      <!-- Stats Bar -->
      <div id="admin-stats-bar" style="padding: 12px 16px; background: var(--color-surface); border-bottom: 1px solid var(--color-border); display: flex; gap: 12px; overflow-x: auto; flex-shrink: 0;">
        <div style="flex: 1; min-width: 100px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-purple);" id="stat-originals">\u2014</div>
          <div style="font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Originals</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: #F59E0B;" id="stat-pending">\u2014</div>
          <div style="font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Pending</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: #10b981;" id="stat-published">\u2014</div>
          <div style="font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Published</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-text-primary);" id="stat-reads">\u2014</div>
          <div style="font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Total Reads</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 10px 14px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: #ef4444;" id="stat-likes">\u2014</div>
          <div style="font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Total Likes</div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div style="padding: 10px 16px 0; background: var(--color-surface); border-bottom: 1px solid var(--color-border); flex-shrink: 0;">
        <div style="display: flex; gap: 0; overflow-x: auto;" id="admin-main-tabs">
          <button class="admin-main-tab admin-main-tab--active" data-tab="originals" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 700; border: none; background: transparent; color: var(--color-purple); cursor: pointer; border-bottom: 2px solid var(--color-purple); display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.book} DRiVE Originals
          </button>
          <button class="admin-main-tab" data-tab="pending" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 500; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.eye} Pending Review <span id="tab-badge-pending" style="background: #F59E0B; color: #000; padding: 1px 6px; border-radius: 8px; font-size: 0.65rem; font-weight: 800;">0</span>
          </button>
          <button class="admin-main-tab" data-tab="community" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 500; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.users} Live Community
          </button>
          ${isGM ? `
          <button class="admin-main-tab" data-tab="gm-tools" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 500; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.crown} Game Master
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div style="padding: 10px 16px; display: flex; gap: 8px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 180px; position: relative;">
          <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); display: flex;">${ICON.search}</span>
          <input type="text" id="admin-search-input" placeholder="Search stories..." style="width: 100%; padding: 8px 12px 8px 34px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-bg); color: var(--color-text-primary); font-family: inherit; font-size: 0.85rem; box-sizing: border-box; outline: none;" />
        </div>
        <select id="admin-genre-filter" style="padding: 8px 12px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.8rem; outline: none;">
          <option value="all">All Genres</option>
          <option value="Fantasy">Fantasy</option>
          <option value="Sci-Fi">Sci-Fi</option>
          <option value="Romance">Romance</option>
          <option value="Horror">Horror</option>
          <option value="Comedy">Comedy</option>
          <option value="Drama">Drama</option>
          <option value="Mystery">Mystery</option>
          <option value="Slice of Life">Slice of Life</option>
        </select>
        <select id="admin-format-filter" style="padding: 8px 12px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.8rem; outline: none;">
          <option value="all">All Formats</option>
          <option value="scroll">Waterfall Storyboard</option>
          <option value="book">Illustrated Book</option>
          <option value="comic">Comic Strip</option>
        </select>
      </div>

      <!-- Main Content Area -->
      <div style="flex: 1; overflow-y: auto; padding: 16px;" id="admin-content-area">
        <div style="display: flex; justify-content: center; align-items: center; padding: 60px 0; color: var(--color-text-muted);">
          <div class="admin-spinner"></div>
          <span style="margin-left: 8px;">Loading dashboard\u2026</span>
        </div>
      </div>
    </div>
  `;
}

// ─── State ───
let activeTab: AdminTab = 'originals';
let currentStatus: 'under-review' | 'published' | 'denied' = 'under-review';
let currentGenre = 'all';
let currentFormat = 'all';
let searchQuery = '';
let currentUserStories: UserStory[] = [];
let currentOfficialStories: Story[] = [];

export function init(): void {
  const container = document.getElementById('admin-container');
  if (!container) return;

  loadAllMetrics();
  loadTabContent();

  // Main Tab switching
  const mainTabs = document.querySelectorAll('#admin-main-tabs .admin-main-tab');
  mainTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const tabId = target.dataset.tab as AdminTab;
      if (!tabId || tabId === activeTab) return;

      mainTabs.forEach(t => {
        (t as HTMLElement).style.color = 'var(--color-text-muted)';
        (t as HTMLElement).style.fontWeight = '500';
        (t as HTMLElement).style.borderBottom = '2px solid transparent';
      });
      target.style.color = 'var(--color-purple)';
      target.style.fontWeight = '700';
      target.style.borderBottom = '2px solid var(--color-purple)';

      activeTab = tabId;
      loadTabContent();
    });
  });

  // Filter dropdowns
  document.getElementById('admin-genre-filter')?.addEventListener('change', (e) => {
    currentGenre = (e.target as HTMLSelectElement).value;
    loadTabContent();
  });

  document.getElementById('admin-format-filter')?.addEventListener('change', (e) => {
    currentFormat = (e.target as HTMLSelectElement).value;
    loadTabContent();
  });

  // Search
  let searchTimeout: any;
  document.getElementById('admin-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      loadTabContent();
    }, 300);
  });
}

async function loadAllMetrics(): Promise<void> {
  try {
    const [metrics, officialStories] = await Promise.all([
      fetchAdminMetrics(),
      fetchOfficialStories(),
    ]);

    const el = (id: string, val: string | number) => {
      const e = document.getElementById(id);
      if (e) e.textContent = String(val);
    };

    el('stat-originals', officialStories.length);
    el('stat-pending', metrics.pendingCount);
    el('stat-published', metrics.approvedCount);
    el('stat-reads', formatNumber(metrics.totalReads));
    el('stat-likes', formatNumber(metrics.totalLikes));

    // Update tab badge
    el('tab-badge-pending', metrics.pendingCount);
  } catch (err) {
    console.error('Failed to load admin metrics:', err);
  }
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

async function loadTabContent(): Promise<void> {
  const area = document.getElementById('admin-content-area');
  if (!area) return;

  area.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; padding: 60px 0; color: var(--color-text-muted);">
      <div class="admin-spinner"></div>
      <span style="margin-left: 8px;">Loading\u2026</span>
    </div>
  `;

  try {
    switch (activeTab) {
      case 'originals':
        await loadOriginalsTab(area);
        break;
      case 'pending':
        currentStatus = 'under-review';
        await loadSubmissionsTab(area, 'under-review');
        break;
      case 'community':
        currentStatus = 'published';
        await loadSubmissionsTab(area, 'published');
        break;
      case 'gm-tools':
        renderGMToolsTab(area);
        break;
    }
  } catch (err: any) {
    area.innerHTML = `<div style="color: #ef4444; padding: 24px; text-align: center;">Error: ${err.message}</div>`;
  }
}

// ═══════════════════════════════════════════
// TAB: DRiVE ORIGINALS
// ═══════════════════════════════════════════

async function loadOriginalsTab(area: HTMLElement): Promise<void> {
  currentOfficialStories = await fetchOfficialStories();

  let filtered = currentOfficialStories;
  if (searchQuery) {
    filtered = filtered.filter(s =>
      s.title.toLowerCase().includes(searchQuery) ||
      s.author.toLowerCase().includes(searchQuery) ||
      s.genre.toLowerCase().includes(searchQuery)
    );
  }
  if (currentGenre !== 'all') {
    filtered = filtered.filter(s => s.genre === currentGenre);
  }
  if (currentFormat !== 'all') {
    filtered = filtered.filter(s => s.format === currentFormat);
  }

  if (filtered.length === 0) {
    area.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">📖</div>
        <h3 style="margin: 0 0 8px 0; color: var(--color-text-primary); font-family: var(--font-heading);">No Official Stories Yet</h3>
        <p style="margin: 0 0 20px 0; color: var(--color-text-muted); max-width: 400px;">Upload your first DRiVE Original to get started. Official stories appear at the top of the Featured and Explore feeds.</p>
        <button id="btn-add-original" style="padding: 10px 20px; background: linear-gradient(135deg, var(--color-purple), #8a2be2); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: var(--shadow-md);">
          ${ICON.plus} Add Official Story
        </button>
      </div>
    `;
    document.getElementById('btn-add-original')?.addEventListener('click', () => {
      showAddOriginalPlaceholder();
    });
    return;
  }

  area.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; font-family: var(--font-heading); font-size: 1rem; color: var(--color-text-primary);">DRiVE Originals (${filtered.length})</h2>
      <button id="btn-add-original" style="padding: 8px 14px; background: linear-gradient(135deg, var(--color-purple), #8a2be2); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        ${ICON.plus} Add New
      </button>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;" id="originals-grid">
      ${filtered.map((s, i) => renderOfficialCard(s, i)).join('')}
    </div>
  `;

  document.getElementById('btn-add-original')?.addEventListener('click', () => {
    showAddOriginalPlaceholder();
  });
  attachOfficialCardListeners();
}

function renderOfficialCard(story: Story, index: number): string {
  const coverSrc = story.coverImage || (story.panels?.[0]) || '';
  const hasCoverVideo = !!story.coverVideo;

  return `
    <div class="admin-original-card" data-id="${story.id}" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm); transition: transform 0.15s, box-shadow 0.15s;">
      <div style="position: relative; aspect-ratio: 16/10; background: var(--color-bg); overflow: hidden;">
        ${coverSrc
          ? `<img src="${coverSrc}" style="width: 100%; height: 100%; object-fit: cover;" />`
          : hasCoverVideo
            ? `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:var(--color-text-muted);font-size:0.8rem;">\uD83C\uDFAC Video Cover</div>`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:0.8rem;">No Cover</div>`
        }
        <div style="position: absolute; top: 8px; left: 8px; display: flex; gap: 4px;">
          <span style="background: var(--color-purple); color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase;">OFFICIAL</span>
          ${story.isFeatured ? `<span style="background: #F59E0B; color: #000; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800;">\u2B50 FEATURED</span>` : ''}
          ${story.isEditorPick ? `<span style="background: #10b981; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800;">\uD83C\uDFC6 PICK</span>` : ''}
        </div>
        <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 700;">#${index + 1}</div>
        <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 700;">${story.format.toUpperCase()}</div>
      </div>
      <div style="padding: 12px 14px;">
        <h3 style="margin: 0 0 4px 0; font-family: var(--font-heading); font-size: 0.95rem; color: var(--color-text-primary);">${escapeHtml(story.title)}</h3>
        <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 8px;">
          ${escapeHtml(story.author)} \u00B7 ${story.genre} \u00B7 ${story.panels?.length || 0} pages \u00B7 ${formatNumber(story.readCount)} reads
        </div>
        ${story.synopsis ? `<p style="margin: 0 0 10px 0; font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(story.synopsis)}</p>` : ''}
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button data-toggle-featured="${story.id}" data-is-featured="${story.isFeatured}" style="flex: 1; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: ${story.isFeatured ? '#F59E0B' : 'var(--color-bg)'}; color: ${story.isFeatured ? '#000' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.75rem; font-weight: 600;">
            \u2B50 ${story.isFeatured ? 'Unfeature' : 'Feature'}
          </button>
          <button data-toggle-pick="${story.id}" data-is-pick="${story.isEditorPick}" style="flex: 1; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: ${story.isEditorPick ? '#10b981' : 'var(--color-bg)'}; color: ${story.isEditorPick ? '#fff' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.75rem; font-weight: 600;">
            \uD83C\uDFC6 ${story.isEditorPick ? 'Unpick' : 'Pick'}
          </button>
          <button data-delete-official="${story.id}" style="padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-muted); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;" onmouseover="this.style.color='#ef4444';this.style.borderColor='#ef4444'" onmouseout="this.style.color='var(--color-text-muted)';this.style.borderColor='var(--color-border)'">
            ${ICON.trash}
          </button>
        </div>
      </div>
    </div>
  `;
}

function attachOfficialCardListeners(): void {
  document.querySelectorAll('[data-toggle-featured]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.dataset.toggleFeatured!;
      const current = el.dataset.isFeatured === 'true';
      await toggleOfficialStoryFeatured(id, !current);
      loadAllMetrics();
      loadTabContent();
    });
  });

  document.querySelectorAll('[data-toggle-pick]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.dataset.togglePick!;
      const current = el.dataset.isPick === 'true';
      await toggleOfficialStoryEditorPick(id, !current);
      loadAllMetrics();
      loadTabContent();
    });
  });

  document.querySelectorAll('[data-delete-official]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.deleteOfficial!;
      const story = currentOfficialStories.find(s => s.id === id);
      showModal({
        title: `Delete "${story?.title || 'Story'}"?`,
        content: '<p>Are you sure you want to permanently delete this official story? This cannot be undone.</p>',
        confirmText: 'Delete Permanently',
        cancelText: 'Cancel',
        onConfirm: async () => {
          await deleteOfficialStory(id);
          loadAllMetrics();
          loadTabContent();
        },
      });
    });
  });
}

function showAddOriginalPlaceholder(): void {
  showModal({
    title: 'Add Official Story',
    content: `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">\uD83D\uDEA7</div>
        <p style="color: var(--color-text-secondary);">The full story upload form is coming in <strong>Step 4</strong>.</p>
        <p style="color: var(--color-text-muted); font-size: 0.85rem;">You'll be able to upload cover images, videos, add pages with scripts, assign genres, and configure TTS audio baking.</p>
      </div>
    `,
    confirmText: 'OK',
    cancelText: '',
    onConfirm: () => {},
  });
}

// ═══════════════════════════════════════════
// TAB: PENDING SUBMISSIONS / LIVE COMMUNITY
// ═══════════════════════════════════════════

async function loadSubmissionsTab(area: HTMLElement, status: 'under-review' | 'published' | 'denied'): Promise<void> {
  currentUserStories = await fetchAdminStories(status, currentGenre, currentFormat);

  let filtered = currentUserStories;
  if (searchQuery) {
    filtered = filtered.filter(s =>
      s.title.toLowerCase().includes(searchQuery) ||
      (s.author_name || '').toLowerCase().includes(searchQuery) ||
      s.genre.toLowerCase().includes(searchQuery)
    );
  }

  const tabLabel = status === 'under-review' ? 'Pending Submissions' : 'Live Community Stories';
  const emptyEmoji = status === 'under-review' ? '\uD83C\uDF89' : '\uD83D\uDCDA';
  const emptyMsg = status === 'under-review'
    ? 'All caught up! No stories awaiting review.'
    : 'No community stories are live yet.';

  if (filtered.length === 0) {
    area.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 16px;">${emptyEmoji}</div>
        <h3 style="margin: 0 0 8px 0; color: var(--color-text-primary); font-family: var(--font-heading);">${emptyMsg}</h3>
        <p style="margin: 0; color: var(--color-text-muted);">Check back later for new submissions from the community.</p>
      </div>
    `;
    return;
  }

  const subTabHtml = activeTab === 'community' ? `
    <div style="display: flex; gap: 8px; margin-bottom: 16px;" id="community-sub-tabs">
      <button class="community-sub-tab ${currentStatus === 'published' ? 'community-sub-tab--active' : ''}" data-sub-status="published" style="padding: 6px 14px; border-radius: 8px; border: 1px solid ${currentStatus === 'published' ? '#10b981' : 'var(--color-border)'}; background: ${currentStatus === 'published' ? '#10b981' : 'var(--color-bg)'}; color: ${currentStatus === 'published' ? 'white' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.8rem; font-weight: ${currentStatus === 'published' ? '700' : '500'};">
        \u2705 Published
      </button>
      <button class="community-sub-tab ${currentStatus === 'denied' ? 'community-sub-tab--active' : ''}" data-sub-status="denied" style="padding: 6px 14px; border-radius: 8px; border: 1px solid ${currentStatus === 'denied' ? '#ef4444' : 'var(--color-border)'}; background: ${currentStatus === 'denied' ? '#ef4444' : 'var(--color-bg)'}; color: ${currentStatus === 'denied' ? 'white' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.8rem; font-weight: ${currentStatus === 'denied' ? '700' : '500'};">
        \u274C Denied
      </button>
    </div>
  ` : '';

  area.innerHTML = `
    ${subTabHtml}
    <h2 style="margin: 0 0 16px 0; font-family: var(--font-heading); font-size: 1rem; color: var(--color-text-primary);">${tabLabel} (${filtered.length})</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
      ${filtered.map((s, i) => renderSubmissionCard(s, i)).join('')}
    </div>
  `;

  if (activeTab === 'community') {
    document.querySelectorAll('#community-sub-tabs .community-sub-tab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const subStatus = (e.currentTarget as HTMLElement).dataset.subStatus as 'published' | 'denied';
        if (subStatus === currentStatus) return;
        currentStatus = subStatus;
        await loadSubmissionsTab(area, currentStatus);
      });
    });
  }

  attachSubmissionCardListeners();
}

function renderSubmissionCard(story: UserStory, _index: number): string {
  const coverImage = story.live_pages?.[0]?.image || story.pages?.[0]?.image || '';
  const statusColor = story.status === 'published' ? '#10b981' : story.status === 'denied' ? '#ef4444' : '#F59E0B';
  const statusLabel = story.status === 'published' ? 'LIVE' : story.status === 'denied' ? 'DENIED' : 'PENDING';

  return `
    <div class="admin-submission-card" data-id="${story.id}" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm);">
      <div style="display: flex; gap: 12px; padding: 14px;">
        <div style="width: 80px; height: 100px; border-radius: 10px; overflow: hidden; flex-shrink: 0; background: var(--color-bg); border: 1px solid var(--color-border);">
          ${coverImage
            ? `<img src="${coverImage}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:0.7rem;">No Img</div>`
          }
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <h3 style="margin: 0; font-family: var(--font-heading); font-size: 0.9rem; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(story.title)}</h3>
            <span style="background: ${statusColor}; color: ${story.status === 'published' ? '#fff' : story.status === 'denied' ? '#fff' : '#000'}; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800; flex-shrink: 0; margin-left: 8px;">${statusLabel}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 6px;">
            by <strong>${escapeHtml(story.author_name || 'Anonymous')}</strong> \u00B7 ${story.genre} \u00B7 ${story.format}
          </div>
          ${story.synopsis ? `<p style="margin: 0; font-size: 0.78rem; color: var(--color-text-secondary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(story.synopsis)}</p>` : ''}
          ${story.rejectionReason ? `<p style="margin: 4px 0 0; font-size: 0.72rem; color: #FCA5A5; background: rgba(239,68,68,0.1); padding: 4px 8px; border-radius: 6px;">\u274C ${escapeHtml(story.rejectionReason)}</p>` : ''}
        </div>
      </div>
      <div style="padding: 8px 14px 12px; border-top: 1px solid var(--color-border); display: flex; gap: 6px; flex-wrap: wrap;">
        <button data-preview="${story.id}" style="flex: 1; padding: 7px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
          ${ICON.eye} Preview
        </button>
        ${story.status === 'under-review' ? `
          <button data-approve="${story.id}" style="flex: 1; padding: 7px; border-radius: 8px; border: none; background: #10b981; color: white; cursor: pointer; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${ICON.check} Approve
          </button>
          <button data-deny="${story.id}" style="flex: 1; padding: 7px; border-radius: 8px; border: none; background: #ef4444; color: white; cursor: pointer; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${ICON.x} Deny
          </button>
        ` : ''}
        ${story.status === 'published' ? `
          <button data-toggle-user-featured="${story.id}" data-is-featured="${story.isFeatured || false}" style="flex: 1; padding: 7px; border-radius: 8px; border: 1px solid var(--color-border); background: ${story.isFeatured ? '#F59E0B' : 'var(--color-bg)'}; color: ${story.isFeatured ? '#000' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.75rem; font-weight: 600;">
            \u2B50 ${story.isFeatured ? 'Unfeature' : 'Feature'}
          </button>
          <button data-revert="${story.id}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">
            ${ICON.rotate} Revoke
          </button>
        ` : ''}
        ${story.status === 'denied' ? `
          <button data-revert="${story.id}" style="flex: 1; padding: 7px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${ICON.rotate} Re-Review
          </button>
          <button data-approve="${story.id}" style="flex: 1; padding: 7px; border-radius: 8px; border: none; background: #10b981; color: white; cursor: pointer; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${ICON.check} Approve
          </button>
        ` : ''}
        <button data-delete="${story.id}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-muted); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;" onmouseover="this.style.color='#ef4444';this.style.borderColor='#ef4444'" onmouseout="this.style.color='var(--color-text-muted)';this.style.borderColor='var(--color-border)'">
          ${ICON.trash}
        </button>
      </div>
    </div>
  `;
}

function attachSubmissionCardListeners(): void {
  document.querySelectorAll('[data-preview]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.preview;
      const story = currentUserStories.find(s => s.id === id);
      if (story) openStoryPreviewModal(story);
    });
  });

  document.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.approve;
      const story = currentUserStories.find(s => s.id === id);
      if (story) openApproveModal(story);
    });
  });

  document.querySelectorAll('[data-deny]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.deny;
      const story = currentUserStories.find(s => s.id === id);
      if (story) openDenyModal(story);
    });
  });

  document.querySelectorAll('[data-revert]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.revert;
      if (!id) return;
      await revertStoryAdmin(id);
      loadAllMetrics();
      loadTabContent();
    });
  });

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.delete;
      if (!id) return;
      showModal({
        title: 'Delete Story Submission?',
        content: '<p>Are you sure you want to permanently delete this story submission?</p>',
        confirmText: 'Delete Permanently',
        cancelText: 'Cancel',
        onConfirm: async () => {
          await deleteStoryAdmin(id);
          loadAllMetrics();
          loadTabContent();
        },
      });
    });
  });

  document.querySelectorAll('[data-toggle-user-featured]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.dataset.toggleUserFeatured!;
      const current = el.dataset.isFeatured === 'true';
      await toggleUserStoryFeatured(id, !current);
      loadAllMetrics();
      loadTabContent();
    });
  });
}

// ═══════════════════════════════════════════
// TAB: GAME MASTER TOOLS
// ═══════════════════════════════════════════

function renderGMToolsTab(area: HTMLElement): void {
  area.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px 0;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 3rem; margin-bottom: 8px;">\uD83D\uDC51</div>
        <h2 style="margin: 0 0 4px; font-family: var(--font-heading); color: var(--color-text-primary);">Game Master Tools</h2>
        <p style="margin: 0; color: var(--color-text-muted); font-size: 0.85rem;">Employee management, audit logs, and platform controls</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: box-shadow 0.15s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'" id="gm-manage-admins">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--color-purple), #8a2be2); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
            ${ICON.users}
          </div>
          <div style="flex: 1;">
            <h3 style="margin: 0; font-size: 0.9rem; color: var(--color-text-primary);">Manage Employees</h3>
            <p style="margin: 2px 0 0; font-size: 0.75rem; color: var(--color-text-muted);">Promote users to admin, revoke access, and view the employee roster</p>
          </div>
          <span style="color: var(--color-text-muted); font-size: 1.2rem;">\u2192</span>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: box-shadow 0.15s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'" id="gm-activity-log">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #F59E0B, #D97706); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
            ${ICON.eye}
          </div>
          <div style="flex: 1;">
            <h3 style="margin: 0; font-size: 0.9rem; color: var(--color-text-primary);">Activity Log</h3>
            <p style="margin: 2px 0 0; font-size: 0.75rem; color: var(--color-text-muted);">View all admin actions: approvals, denials, uploads, and edits</p>
          </div>
          <span style="color: var(--color-text-muted); font-size: 1.2rem;">\u2192</span>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: box-shadow 0.15s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'" id="gm-platform-settings">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
            ${ICON.shield}
          </div>
          <div style="flex: 1;">
            <h3 style="margin: 0; font-size: 0.9rem; color: var(--color-text-primary);">Platform Settings</h3>
            <p style="margin: 2px 0 0; font-size: 0.75rem; color: var(--color-text-muted);">Content policies, TTS configuration, and global settings</p>
          </div>
          <span style="color: var(--color-text-muted); font-size: 1.2rem;">\u2192</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; padding: 16px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px;">
        <p style="margin: 0; color: var(--color-text-muted); font-size: 0.8rem;">\uD83D\uDEA7 Employee management & audit logs are coming in <strong>Step 7</strong>.</p>
      </div>
    </div>
  `;

  ['gm-manage-admins', 'gm-activity-log', 'gm-platform-settings'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      showModal({
        title: 'Coming Soon',
        content: '<p style="text-align:center;">This feature will be fully built in <strong>Step 7</strong>.</p>',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => {},
      });
    });
  });
}

// ═══════════════════════════════════════════
// MODALS (Approve, Deny, Preview)
// ═══════════════════════════════════════════

function openApproveModal(story: UserStory): void {
  showModal({
    title: `Approve: "${story.title}"`,
    content: `
      <div class="admin-modal-body">
        <p>Review settings for publishing this story live to the DRiVE platform:</p>
        <div class="admin-modal-field">
          <label>Content Age Rating:</label>
          <select id="modal-rating-select" class="admin-select" style="width:100%;">
            <option value="All Ages" ${story.contentRating === 'All Ages' ? 'selected' : ''}>All Ages (Family Friendly)</option>
            <option value="PG-13" ${story.contentRating === 'PG-13' ? 'selected' : ''}>PG-13 (Teens)</option>
            <option value="Mature" ${story.contentRating === 'Mature' ? 'selected' : ''}>Mature (18+)</option>
          </select>
        </div>
        <div class="admin-modal-checkbox">
          <input type="checkbox" id="modal-featured-check" ${story.isFeatured ? 'checked' : ''}>
          <label for="modal-featured-check">Mark as Featured (show on Home Hero Carousel)</label>
        </div>
        <div class="admin-modal-checkbox">
          <input type="checkbox" id="modal-editors-check" ${story.isEditorsPick ? 'checked' : ''}>
          <label for="modal-editors-check">Mark as Editor's Pick</label>
        </div>
      </div>
    `,
    confirmText: 'Publish Live Now',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const rating = (document.getElementById('modal-rating-select') as HTMLSelectElement)?.value || 'All Ages';
      const isFeatured = (document.getElementById('modal-featured-check') as HTMLInputElement)?.checked || false;
      const isEditorsPick = (document.getElementById('modal-editors-check') as HTMLInputElement)?.checked || false;
      await approveStoryAdmin(story.id, { contentRating: rating, isFeatured, isEditorsPick });
      loadAllMetrics();
      loadTabContent();
    },
  });
}

function openDenyModal(story: UserStory): void {
  showModal({
    title: `Deny: "${story.title}"`,
    content: `
      <div class="admin-modal-body">
        <p>Provide rejection feedback to <strong>${escapeHtml(story.author_name || 'Author')}</strong>. They will see this in their Library and can edit and resubmit:</p>
        <div class="admin-modal-field">
          <textarea id="modal-rejection-reason" class="admin-textarea" placeholder="Explain why the story was denied and what needs to be fixed..." rows="4"></textarea>
        </div>
        <div class="admin-template-pills">
          <span class="admin-pill" onclick="document.getElementById('modal-rejection-reason').value='Content Guidelines: Please ensure images and text adhere to our community guidelines.'">Content Guidelines</span>
          <span class="admin-pill" onclick="document.getElementById('modal-rejection-reason').value='Quality & Formatting: Please clean up text alignment and ensure images load correctly.'">Formatting Issue</span>
          <span class="admin-pill" onclick="document.getElementById('modal-rejection-reason').value='Incomplete Story: Please add more pages or complete the story text before resubmitting.'">Incomplete</span>
        </div>
      </div>
    `,
    confirmText: 'Send Rejection Feedback',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const reason = (document.getElementById('modal-rejection-reason') as HTMLTextAreaElement)?.value.trim();
      if (!reason) {
        alert('Please write a rejection reason before confirming.');
        return;
      }
      await denyStoryAdmin(story.id, reason);
      loadAllMetrics();
      loadTabContent();
    },
  });
}

function openStoryPreviewModal(story: UserStory): void {
  const pages = story.pages || [];
  const pagesHtml = pages.map((p, idx) => `
    <div class="admin-preview-page">
      <div class="admin-preview-page__num">Page ${idx + 1}</div>
      ${p.image ? `<img src="${p.image}" class="admin-preview-page__img">` : ''}
      ${p.text ? `<p class="admin-preview-page__text">${escapeHtml(p.text)}</p>` : ''}
    </div>
  `).join('');

  showModal({
    title: `Preview: "${story.title}" (${story.format})`,
    hideActions: true,
    content: `
      <div class="admin-preview-modal">
        <button class="modal-close" onclick="document.querySelector('.modal-backdrop').remove()">\u00D7</button>
        <div class="admin-preview-meta">
          <span>Author: <strong>${escapeHtml(story.author_name || 'Anonymous')}</strong></span> |
          <span>Genre: <strong>${story.genre}</strong></span> |
          <span>Format: <strong>${story.format}</strong></span>
        </div>
        <p style="font-style:italic; color:var(--color-text-muted); margin:8px 0 16px;">${escapeHtml(story.synopsis || 'No synopsis provided.')}</p>
        <div class="admin-preview-pages-container">
          ${pagesHtml || '<p>No pages in story.</p>'}
        </div>
      </div>
    `,
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
