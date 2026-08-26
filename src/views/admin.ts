import type { UserStory, Story, Genre, StoryFormat, ContentRating } from '../types.ts';
import {
  fetchAdminMetrics,
  fetchAdminStories,
  fetchOfficialStories,
  saveOfficialStory,
  reorderOfficialStories,
  approveStoryAdmin,
  denyStoryAdmin,
  revertStoryAdmin,
  deleteStoryAdmin,
  deleteOfficialStory,
  toggleOfficialStoryFeatured,
  toggleOfficialStoryEditorPick,
  toggleUserStoryFeatured,
  toggleUserStoryEditorPick,
  goOfficialStoryLive,
  takeOfficialStoryOffline,
  checkIsGameMaster,
  hasAdminPrivileges,
  getUserRole,
  type AdminMetrics,
} from '../lib/db.ts';
import { showModal, hideModal } from '../components/modal.ts';
import { navigate } from '../router.ts';
import { setContentManagementMode } from '../state.ts';

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
  layout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  flag: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  chart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  cpu: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
};

// ─── Tab types ───
type AdminTab = 'originals' | 'pending' | 'community' | 'content-management' | 'moderation' | 'gm-tools';

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
          <button class="admin-main-tab" data-tab="content-management" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 500; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.layout} Content Management
          </button>
          <button class="admin-main-tab" data-tab="moderation" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 500; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.flag} Moderation <span style="background: #6366f1; color: #fff; padding: 1px 6px; border-radius: 8px; font-size: 0.62rem; font-weight: 800; margin-left: 2px;">WIP</span>
          </button>
          ${isGM ? `
          <button class="admin-main-tab" data-tab="gm-tools" style="padding: 10px 16px; font-size: 0.8rem; font-weight: 500; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
            ${ICON.crown} Game Master
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div id="admin-search-toolbar" style="padding: 10px 16px; display: flex; gap: 8px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; align-items: center; flex-wrap: wrap;">
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

  // Check URL query / hash for initial tab (e.g. #admin?tab=content-management)
  const hash = window.location.hash || '';
  if (hash.includes('tab=content-management')) {
    activeTab = 'content-management';
  } else if (hash.includes('tab=moderation')) {
    activeTab = 'moderation';
  } else if (hash.includes('tab=community')) {
    activeTab = 'community';
  } else if (hash.includes('tab=pending')) {
    activeTab = 'pending';
  } else if (hash.includes('tab=gm-tools')) {
    activeTab = 'gm-tools';
  } else if (hash.includes('tab=originals')) {
    activeTab = 'originals';
  }

  // Update tab headers active state to match activeTab
  const mainTabs = document.querySelectorAll('#admin-main-tabs .admin-main-tab');
  mainTabs.forEach(t => {
    const el = t as HTMLElement;
    const tabId = el.dataset.tab as AdminTab;
    if (tabId === activeTab) {
      el.style.color = 'var(--color-purple)';
      el.style.fontWeight = '700';
      el.style.borderBottom = '2px solid var(--color-purple)';
      el.classList.add('admin-main-tab--active');
    } else {
      el.style.color = 'var(--color-text-muted)';
      el.style.fontWeight = '500';
      el.style.borderBottom = '2px solid transparent';
      el.classList.remove('admin-main-tab--active');
    }
  });

  loadAllMetrics();
  loadTabContent();

  // Main Tab switching
  mainTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const tabId = target.dataset.tab as AdminTab;
      if (!tabId || tabId === activeTab) return;

      mainTabs.forEach(t => {
        (t as HTMLElement).style.color = 'var(--color-text-muted)';
        (t as HTMLElement).style.fontWeight = '500';
        (t as HTMLElement).style.borderBottom = '2px solid transparent';
        (t as HTMLElement).classList.remove('admin-main-tab--active');
      });
      target.style.color = 'var(--color-purple)';
      target.style.fontWeight = '700';
      target.style.borderBottom = '2px solid var(--color-purple)';
      target.classList.add('admin-main-tab--active');

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

  // Toggle toolbar visibility based on active tab
  const toolbar = document.getElementById('admin-search-toolbar');
  if (toolbar) {
    toolbar.style.display = (activeTab === 'originals' || activeTab === 'pending' || activeTab === 'community') ? 'flex' : 'none';
  }

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
      case 'content-management':
        renderContentManagementTab(area);
        break;
      case 'moderation':
        renderModerationTab(area);
        break;
      case 'gm-tools':
        renderGMToolsTab(area);
        break;
    }
  } catch (err: any) {
    area.innerHTML = `<div style="color: #ef4444; padding: 24px; text-align: center;">Error: ${err.message}</div>`;
  }
}

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

  // Group stories by storyGroupId into episode stacks
  const groupMap = new Map<string, Story[]>();
  for (const story of filtered) {
    const gid = story.storyGroupId || story.id;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(story);
  }
  // Sort episodes within each group by episodeNumber
  for (const episodes of groupMap.values()) {
    episodes.sort((a, b) => (a.episodeNumber || 1) - (b.episodeNumber || 1));
  }
  const storyGroups = Array.from(groupMap.values());

  if (storyGroups.length === 0) {
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
      openFormatPopup();
    });
    return;
  }

  area.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; font-family: var(--font-heading); font-size: 1rem; color: var(--color-text-primary);">DRiVE Originals (${storyGroups.length} stories, ${filtered.length} episodes)</h2>
      <button id="btn-add-original" style="padding: 8px 14px; background: linear-gradient(135deg, var(--color-purple), #8a2be2); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        ${ICON.plus} Add New
      </button>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;" id="originals-grid">
      ${storyGroups.map((episodes, i) => renderStoryStack(episodes, i)).join('')}
    </div>
  `;

  document.getElementById('btn-add-original')?.addEventListener('click', () => {
    openFormatPopup();
  });
  attachOfficialCardListeners();
  attachStackListeners();
}

/** Renders a stack of episode tiles that look like pages of a book */
function renderStoryStack(episodes: Story[], groupIndex: number): string {
  const first = episodes[0];
  const formatBadge = first.format === 'book' ? '📖 Book' : '📜 Waterfall';
  const groupId = first.storyGroupId || first.id;

  const episodeCards = episodes.map((story, epIdx) => {
    const coverSrc = story.coverImage || (story.panels?.[0]) || '';
    const isLive = story.officialStatus === 'live';
    const statusColor = isLive ? '#10b981' : '#ef4444';
    const statusBorder = isLive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
    const statusBg = isLive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
    const statusLabel = isLive ? '🟢 LIVE' : '🔴 DRAFT';
    const epNum = story.episodeNumber || (epIdx + 1);
    const isFirst = epIdx === 0;
    // Visual stacking: first card fully visible, others peeking 36px each
    const topOffset = isFirst ? 0 : 0; // will be controlled by the stack container
    const zIndex = episodes.length - epIdx;

    return `
      <div class="episode-tile" data-episode-id="${story.id}" data-episode-index="${epIdx}" data-group-id="${groupId}"
           style="
             background: var(--color-surface);
             border: 2px solid ${statusBorder};
             border-radius: 16px;
             overflow: hidden;
             box-shadow: var(--shadow-sm);
             transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s, opacity 0.3s;
             position: ${isFirst ? 'relative' : 'absolute'};
             top: ${isFirst ? '0' : epIdx * 36 + 'px'};
             left: 0;
             right: 0;
             z-index: ${zIndex};
             cursor: ${isFirst ? 'default' : 'pointer'};
             ${!isFirst ? 'opacity: 0.85;' : ''}
           ">
        <div style="position: relative; aspect-ratio: 16/10; background: var(--color-bg); overflow: hidden;">
          ${coverSrc
            ? `<img src="${coverSrc}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:0.8rem;">No Cover</div>`
          }
          <div style="position: absolute; top: 8px; left: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
            <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase;">${statusLabel}</span>
            <span style="background: rgba(139,92,246,0.9); color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800;">EP ${epNum}</span>
            ${story.isFeatured ? `<span style="background: #F59E0B; color: #000; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800;">⭐ FEATURED</span>` : ''}
            ${story.isEditorPick ? `<span style="background: #10b981; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 800;">🏆 PICK</span>` : ''}
          </div>
          <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 3px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 700;">${formatBadge}</div>
        </div>
        <div style="padding: 12px 14px;">
          <h3 style="margin: 0 0 4px 0; font-family: var(--font-heading); font-size: 0.95rem; color: var(--color-text-primary);">${escapeHtml(story.title)}</h3>
          <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 8px;">
            ${escapeHtml(story.author)} · ${story.genre} · ${story.panels?.length || 0} pages · ${formatNumber(story.readCount)} reads
          </div>
          ${story.synopsis ? `<p style="margin: 0 0 10px 0; font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(story.synopsis)}</p>` : ''}
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
            <button data-edit-official="${story.id}" style="flex: 2; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-purple); background: rgba(139,92,246,0.1); color: var(--color-purple); cursor: pointer; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
              ${ICON.eye} Edit
            </button>
            <button data-move-up="${story.id}" title="Move up" style="padding: 6px 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 0.8rem; font-weight: 700;">↑</button>
            <button data-move-down="${story.id}" title="Move down" style="padding: 6px 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 0.8rem; font-weight: 700;">↓</button>
            <button data-delete-official="${story.id}" style="padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-muted); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;" onmouseover="this.style.color='#ef4444';this.style.borderColor='#ef4444'" onmouseout="this.style.color='var(--color-text-muted)';this.style.borderColor='var(--color-border)'">
              ${ICON.trash}
            </button>
          </div>
          <!-- Status Action Bar -->
          <div style="background: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 10px; padding: 8px; display: flex; gap: 6px; align-items: center;">
            ${isLive ? `
              <button data-toggle-featured="${story.id}" data-is-featured="${story.isFeatured}" style="flex: 1; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--color-border); background: ${story.isFeatured ? '#F59E0B' : 'var(--color-bg)'}; color: ${story.isFeatured ? '#000' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.7rem; font-weight: 600;">
                ⭐ ${story.isFeatured ? 'Unfeature' : 'Feature'}
              </button>
              <button data-toggle-pick="${story.id}" data-is-pick="${story.isEditorPick}" style="flex: 1; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--color-border); background: ${story.isEditorPick ? 'var(--color-purple)' : 'var(--color-bg)'}; color: ${story.isEditorPick ? '#fff' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.7rem; font-weight: 600;">
                🏆 ${story.isEditorPick ? 'Unpick' : 'Pick'}
              </button>
              <button data-take-offline="${story.id}" style="flex: 1; padding: 5px 8px; border-radius: 6px; border: none; background: #ef4444; color: white; cursor: pointer; font-size: 0.7rem; font-weight: 700;">
                📴 Offline
              </button>
            ` : `
              <button data-go-live="${story.id}" style="flex: 1; padding: 8px; border-radius: 8px; border: none; background: #10b981; color: white; cursor: pointer; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 4px;">
                🚀 Go Live
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Container height: first card height is auto, plus peeking space for subsequent episodes
  const peekingHeight = (episodes.length - 1) * 36;

  return `
    <div class="story-stack" data-stack-group="${groupId}" style="position: relative; padding-bottom: ${peekingHeight}px;">
      ${episodeCards}
      <button data-add-episode="${groupId}" data-group-format="${first.format}" data-group-title="${escapeHtml(first.title)}" data-next-ep="${episodes.length + 1}"
              style="
                display: flex; align-items: center; justify-content: center; gap: 6px;
                width: 100%;
                padding: 10px;
                margin-top: 8px;
                border: 2px dashed var(--color-border);
                border-radius: 12px;
                background: transparent;
                color: var(--color-text-muted);
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                transition: all 0.2s;
                position: relative;
                z-index: 0;
              "
              onmouseover="this.style.borderColor='var(--color-purple)';this.style.color='var(--color-purple)';this.style.background='rgba(139,92,246,0.05)'"
              onmouseout="this.style.borderColor='var(--color-border)';this.style.color='var(--color-text-muted)';this.style.background='transparent'">
        ${ICON.plus} Add New Episode
      </button>
    </div>
  `;
}

/** Attach hover-to-reveal listeners for stacked episode tiles */
function attachStackListeners(): void {
  document.querySelectorAll('.story-stack').forEach(stack => {
    const tiles = stack.querySelectorAll('.episode-tile') as NodeListOf<HTMLElement>;
    if (tiles.length <= 1) return;

    let activeIndex = 0;

    const resetStack = () => {
      tiles.forEach((tile, idx) => {
        if (idx === 0) {
          tile.style.position = 'relative';
          tile.style.top = '0';
          tile.style.zIndex = String(tiles.length - idx);
          tile.style.opacity = '1';
          tile.style.transform = 'scale(1)';
          tile.style.boxShadow = 'var(--shadow-sm)';
        } else {
          tile.style.position = 'absolute';
          tile.style.top = idx * 36 + 'px';
          tile.style.zIndex = String(tiles.length - idx);
          tile.style.opacity = '0.85';
          tile.style.transform = 'scale(1)';
          tile.style.boxShadow = 'var(--shadow-sm)';
        }
      });
      activeIndex = 0;
    };

    const bringToFront = (targetIdx: number) => {
      if (targetIdx === activeIndex) return;
      tiles.forEach((tile, idx) => {
        if (idx === targetIdx) {
          tile.style.position = 'absolute';
          tile.style.top = '0';
          tile.style.zIndex = String(tiles.length + 1);
          tile.style.opacity = '1';
          tile.style.transform = 'scale(1)';
          tile.style.boxShadow = '0 8px 32px rgba(139,92,246,0.25)';
        } else {
          const peekPos = idx * 36;
          if (idx === 0) {
            tile.style.position = 'relative';
            tile.style.top = '0';
          } else {
            tile.style.position = 'absolute';
            tile.style.top = peekPos + 'px';
          }
          tile.style.zIndex = String(tiles.length - idx);
          tile.style.opacity = '0.65';
          tile.style.transform = 'scale(0.98)';
          tile.style.boxShadow = 'var(--shadow-sm)';
        }
      });
      activeIndex = targetIdx;
    };

    tiles.forEach((tile, idx) => {
      if (idx === 0) return;
      tile.addEventListener('mouseenter', () => bringToFront(idx));
    });

    (stack as HTMLElement).addEventListener('mouseleave', () => resetStack());
  });

  // "+ Add New Episode" button handler
  document.querySelectorAll('[data-add-episode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const groupId = el.dataset.addEpisode!;
      const format = el.dataset.groupFormat!;
      const title = el.dataset.groupTitle!;
      const nextEp = el.dataset.nextEp!;
      navigate(`admin-create?format=${format}&storyGroupId=${groupId}&episodeNumber=${nextEp}&storyTitle=${encodeURIComponent(title)}`);
    });
  });
}

function attachOfficialCardListeners(): void {
  // Edit button → navigate to admin creation studio
  document.querySelectorAll('[data-edit-official]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.editOfficial!;
      navigate('admin-create/' + id);
    });
  });

  // Move up
  document.querySelectorAll('[data-move-up]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.moveUp!;
      const idx = currentOfficialStories.findIndex(s => s.id === id);
      if (idx <= 0) return;
      const ids = currentOfficialStories.map(s => s.id);
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
      await reorderOfficialStories(ids);
      loadTabContent();
    });
  });

  // Move down
  document.querySelectorAll('[data-move-down]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.moveDown!;
      const idx = currentOfficialStories.findIndex(s => s.id === id);
      if (idx < 0 || idx >= currentOfficialStories.length - 1) return;
      const ids = currentOfficialStories.map(s => s.id);
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
      await reorderOfficialStories(ids);
      loadTabContent();
    });
  });

  // Feature toggle
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

  // Go Live
  document.querySelectorAll('[data-go-live]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.goLive!;
      const story = currentOfficialStories.find(s => s.id === id);
      showModal({
        title: `🚀 Go Live: "${story?.title || 'Story'}"`,
        content: `
          <div style="text-align: center; padding: 8px 0;">
            <p style="margin: 0 0 16px;">This story will become visible on the Explore feed and (if Featured/Picked) on the Featured page.</p>
            <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="golive-featured" /> ⭐ Also mark as <strong>Featured</strong> (Home hero carousel)
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="golive-pick" /> 🏆 Also mark as <strong>Editor's Pick</strong>
              </label>
            </div>
          </div>
        `,
        confirmText: '🚀 Go Live Now',
        cancelText: 'Cancel',
        onConfirm: async () => {
          const isFeatured = (document.getElementById('golive-featured') as HTMLInputElement)?.checked || false;
          const isEditorPick = (document.getElementById('golive-pick') as HTMLInputElement)?.checked || false;
          await goOfficialStoryLive(id, { isFeatured, isEditorPick });
          loadAllMetrics();
          loadTabContent();
        },
      });
    });
  });

  // Take Offline
  document.querySelectorAll('[data-take-offline]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.takeOffline!;
      const story = currentOfficialStories.find(s => s.id === id);
      showModal({
        title: `📴 Take Offline: "${story?.title || 'Story'}"`,
        content: '<p>This will remove the story from Featured and Explore feeds. It will become a draft and can be re-published later.</p>',
        confirmText: 'Take Offline',
        cancelText: 'Cancel',
        onConfirm: async () => {
          await takeOfficialStoryOffline(id);
          loadAllMetrics();
          loadTabContent();
        },
      });
    });
  });
}

// ═══════════════════════════════════════════
// STORY EDITOR FORM (Create / Edit Official Story)
// ═══════════════════════════════════════════

const GENRE_OPTIONS: Genre[] = ['Fantasy','Sci-Fi','Romance','Horror','Comedy','Drama','Mystery','Slice of Life','Action','Adventure','Thriller','Historical','Superhero','Sports','Psychological','Supernatural','Mecha','Musical','Custom'];
const FORMAT_OPTIONS: { value: StoryFormat; label: string }[] = [
  { value: 'scroll', label: 'Waterfall Storyboard' },
  { value: 'book', label: 'Illustrated Book' }
];
const RATING_OPTIONS: ContentRating[] = ['All Ages', 'PG-13', 'Mature'];

const EDITOR_DRAFT_KEY = 'drive_admin_editor_draft';

interface EditorPage {
  image: string;
  text: string;
  video: string;
}

interface EditorDraft {
  id: string;
  title: string;
  author: string;
  genre: string;
  format: string;
  synopsis: string;
  contentRating: string;
  coverImage: string;
  coverVideo: string;
  pages: EditorPage[];
  savedAt: string;
}

// ─── Image compression (matches create.ts pattern) ───

function editorCompressImage(dataUrl: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl.startsWith('data:image/')) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function editorFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }).then(url => editorCompressImage(url as string));
}

// ─── Upload box HTML ───

function renderUploadBox(id: string, currentImage: string, label: string, height: string = '140px'): string {
  if (currentImage) {
    return `
      <div style="position: relative;">
        <img src="${currentImage}" style="width: 100%; height: ${height}; object-fit: cover; border-radius: 10px; border: 1px solid var(--color-border);" />
        <button data-clear-upload="${id}" style="position: absolute; top: 6px; right: 6px; background: rgba(239,68,68,0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;">✕</button>
        <button data-change-upload="${id}" style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 0.7rem;">Change</button>
        <input type="file" accept="image/*" data-file-input="${id}" style="display: none;" />
      </div>
    `;
  }
  return `
    <div data-upload-area="${id}" style="width: 100%; height: ${height}; border: 2px dashed var(--color-border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: var(--color-bg); transition: border-color 0.2s, background 0.2s;" onmouseover="this.style.borderColor='var(--color-purple)';this.style.background='rgba(139,92,246,0.05)'" onmouseout="this.style.borderColor='var(--color-border)';this.style.background='var(--color-bg)'">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(139,92,246,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
        ${ICON.plus}
      </div>
      <span style="font-size: 0.75rem; color: var(--color-text-muted);">${label}</span>
    </div>
    <input type="file" accept="image/*" data-file-input="${id}" style="display: none;" />
  `;
}

function renderVideoUploadBox(id: string, currentVideo: string, label: string): string {
  if (currentVideo) {
    return `
      <div style="position: relative;">
        <video src="${currentVideo}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 10px; border: 1px solid var(--color-border); background: #000;" muted></video>
        <button data-clear-upload="${id}" style="position: absolute; top: 6px; right: 6px; background: rgba(239,68,68,0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;">✕</button>
        <button data-change-upload="${id}" style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 0.7rem;">Change</button>
        <div style="position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.7); color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.6rem; font-weight: 700;">🎬 VIDEO</div>
        <input type="file" accept="video/*" data-file-input="${id}" style="display: none;" />
      </div>
    `;
  }
  return `
    <div data-upload-area="${id}" style="width: 100%; height: 100px; border: 2px dashed var(--color-border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: var(--color-bg); transition: border-color 0.2s, background 0.2s;" onmouseover="this.style.borderColor='var(--color-purple)';this.style.background='rgba(139,92,246,0.05)'" onmouseout="this.style.borderColor='var(--color-border)';this.style.background='var(--color-bg)'">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(139,92,246,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
        ${ICON.plus}
      </div>
      <span style="font-size: 0.75rem; color: var(--color-text-muted);">${label}</span>
    </div>
    <input type="file" accept="video/*" data-file-input="${id}" style="display: none;" />
  `;
}

function editorFileToVideoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Format Selection Popup ───

function openFormatPopup(): void {
  const formatContent = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="fmt-book" style="display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 16px; border: 2px solid var(--color-border); background: var(--color-surface); cursor: pointer; text-align: left; transition: all 0.2s;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #a78bfa); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path d="M6 8c0-2 2-4 6-4h6c4 0 6 2 6 2s2-2 6-2h6c4 0 6 2 6 4v28c0 2-2 4-6 4h-6c-4 0-6 2-6 2s-2-2-6-2h-6c-4 0-6-2-6-4V8z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 6v34" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 2px;">📖 Illustrated Book</div>
            <div style="font-size: 0.78rem; color: var(--color-text-muted);">Single-page slides with AI illustrations, voice tuning & Deeper Dive notes</div>
          </div>
        </button>
        
        <button id="fmt-scroll" style="display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 16px; border: 2px solid var(--color-border); background: var(--color-surface); cursor: pointer; text-align: left; transition: all 0.2s;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #22d3ee); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><rect x="12" y="4" width="24" height="40" rx="4" stroke="currentColor" stroke-width="2.5"/><line x1="18" y1="14" x2="30" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="26" x2="26" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 2px;">🎬 Waterfall Storyboard</div>
            <div style="font-size: 0.78rem; color: var(--color-text-muted);">Vertical scrolling panels with multi-tile grids & Character Sheet Studio</div>
          </div>
        </button>
      </div>`;

  showModal({
    title: 'Choose Story Format',
    content: formatContent,
    hideActions: true,
    showCloseBtn: true,
  });

  document.getElementById('fmt-book')?.addEventListener('click', () => {
    hideModal();
    navigate('admin-create?format=book');
  });
  document.getElementById('fmt-scroll')?.addEventListener('click', () => {
    hideModal();
    navigate('admin-create?format=scroll');
  });
}


function saveEditorDraft(id: string, pages: EditorPage[]): void {
  const title = (document.getElementById('ed-title') as HTMLInputElement)?.value || '';
  const author = (document.getElementById('ed-author') as HTMLInputElement)?.value || '';
  const genre = (document.getElementById('ed-genre') as HTMLSelectElement)?.value || '';
  const format = (document.getElementById('ed-format') as HTMLSelectElement)?.value || '';
  const synopsis = (document.getElementById('ed-synopsis') as HTMLTextAreaElement)?.value || '';
  const contentRating = (document.getElementById('ed-rating') as HTMLSelectElement)?.value || '';
  const coverImage = (document.querySelector('[data-editor-cover-image]') as HTMLElement)?.dataset.editorCoverImage || '';
  const coverVideo = (document.querySelector('[data-editor-cover-video]') as HTMLElement)?.dataset.editorCoverVideo || '';

  const draft: EditorDraft = { id, title, author, genre, format, synopsis, contentRating, coverImage, coverVideo, pages, savedAt: new Date().toISOString() };
  try { localStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function loadEditorDraft(): EditorDraft | null {
  try {
    const raw = localStorage.getItem(EDITOR_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EditorDraft;
  } catch { return null; }
}

function clearEditorDraft(): void {
  try { localStorage.removeItem(EDITOR_DRAFT_KEY); } catch {}
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoSave(id: string, pages: EditorPage[]): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveEditorDraft(id, pages), 1000);
}

// ─── Main editor function ───

/** Open the story editor, either blank (create) or pre-filled (edit) */
function openStoryEditor(existing?: Story): void {
  const isEdit = !!existing;
  let coverImageData = existing?.coverImage || '';

  // Check for saved draft when creating new
  let draft: EditorDraft | null = null;
  if (!isEdit) {
    draft = loadEditorDraft();
  }

  const id = existing?.id || draft?.id || crypto.randomUUID();

  // Build initial pages array
  const pages: EditorPage[] = [];
  if (existing && existing.panels && existing.panels.length > 0) {
    for (let i = 0; i < existing.panels.length; i++) {
      pages.push({
        image: existing.panels[i] || '',
        text: existing.pageScripts?.[i] || '',
        video: existing.pageVideos?.[i] || '',
      });
    }
  } else if (draft) {
    pages.push(...draft.pages);
    coverImageData = draft.coverImage || '';
  }
  if (pages.length === 0) {
    pages.push({ image: '', text: '', video: '' });
  }

  const area = document.getElementById('admin-content-area');
  if (!area) return;

  function renderEditor(): void {
    const draftTitle = draft?.title || existing?.title || '';
    const draftAuthor = draft?.author || existing?.author || 'DRiVE Studios';
    const draftGenre = draft?.genre || existing?.genre || 'Fantasy';
    const draftFormat = draft?.format || existing?.format || 'book';
    const draftSynopsis = draft?.synopsis || existing?.synopsis || '';
    const draftRating = draft?.contentRating || existing?.contentRating || 'All Ages';
    const draftCoverVideo = draft?.coverVideo || existing?.coverVideo || '';

    area!.innerHTML = `
      <div style="max-width: 700px; margin: 0 auto; padding-bottom: 100px;">
        ${draft && !isEdit ? `<div style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--color-purple);"><span>📝</span> Draft restored from your last session</div>` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-family: var(--font-heading); font-size: 1.1rem; color: var(--color-text-primary);">
            ${isEdit ? '✏️ Edit Official Story' : '📖 Create Official Story'}
          </h2>
          <button id="editor-cancel" style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 0.8rem;">Cancel</button>
        </div>

        <!-- Metadata Fields -->
        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Title *</label>
            <input id="ed-title" type="text" value="${escapeAttr(draftTitle)}" placeholder="Story title" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.9rem; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Author</label>
            <input id="ed-author" type="text" value="${escapeAttr(draftAuthor)}" placeholder="Author name" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.9rem; box-sizing: border-box;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Genre</label>
              <select id="ed-genre" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.85rem; box-sizing: border-box;">
                ${GENRE_OPTIONS.map(g => `<option value="${g}" ${draftGenre === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Format</label>
              <select id="ed-format" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.85rem; box-sizing: border-box;">
                ${FORMAT_OPTIONS.map(f => `<option value="${f.value}" ${draftFormat === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Synopsis</label>
            <textarea id="ed-synopsis" rows="3" placeholder="Brief story description..." style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.85rem; resize: vertical; box-sizing: border-box; font-family: var(--font-body);">${escapeHtml(draftSynopsis)}</textarea>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Content Rating</label>
            <select id="ed-rating" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-primary); font-size: 0.85rem; box-sizing: border-box;">
              ${RATING_OPTIONS.map(r => `<option value="${r}" ${draftRating === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Cover Image</label>
            <div id="cover-image-upload" data-editor-cover-image="${escapeAttr(coverImageData)}">
              ${renderUploadBox('cover-image', coverImageData, 'Click to upload cover image', '180px')}
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 4px;">Cover Video (optional, for hover-play tile)</label>
            <div id="cover-video-upload" data-editor-cover-video="${escapeAttr(draftCoverVideo)}">
              ${renderVideoUploadBox('cover-video', draftCoverVideo, 'Click to upload cover video')}
            </div>
          </div>
        </div>

        <!-- Pages Section -->
        <div style="border-top: 1px solid var(--color-border); padding-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-family: var(--font-heading); font-size: 1rem; color: var(--color-text-primary);">📄 Story Pages (${pages.length})</h3>
            <button id="editor-add-page" style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--color-purple); background: rgba(139,92,246,0.1); color: var(--color-purple); cursor: pointer; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              ${ICON.plus} Add Page
            </button>
          </div>

          <div id="editor-pages" style="display: flex; flex-direction: column; gap: 16px;">
            ${pages.map((p, i) => renderEditorPage(p, i, pages.length)).join('')}
          </div>
        </div>

        <!-- Save Bar (constrained to mobile width) -->
        <div style="position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: var(--color-surface); border-top: 1px solid var(--color-border); padding: 12px 20px; display: flex; gap: 10px; justify-content: center; z-index: 100; box-shadow: 0 -4px 16px rgba(0,0,0,0.3); box-sizing: border-box; border-radius: 12px 12px 0 0;">
          <button id="editor-save" style="flex: 1; max-width: 260px; padding: 12px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--color-purple), #8a2be2); color: white; font-weight: 700; font-size: 0.95rem; cursor: pointer; box-shadow: var(--shadow-md);">
            💾 Save and Quit
          </button>
          <button id="editor-cancel-bottom" style="padding: 12px 20px; border-radius: 12px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text-secondary); font-weight: 600; font-size: 0.9rem; cursor: pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;

    // After first render, clear the draft reference so subsequent re-renders don't show "restored" toast
    draft = null;

    // Attach all listeners
    attachEditorListeners(pages, id, isEdit, existing, coverImageData, renderEditor);
    attachUploadListeners(pages, id, coverImageData, renderEditor);
  }

  renderEditor();
}

function renderEditorPage(page: EditorPage, index: number, total: number): string {
  return `
    <div class="editor-page-card" data-page-index="${index}" style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 14px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-weight: 700; font-size: 0.8rem; color: var(--color-purple);">Page ${index + 1}</span>
        <div style="display: flex; gap: 4px;">
          ${index > 0 ? `<button data-page-move-up="${index}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; font-size: 0.75rem;">↑</button>` : ''}
          ${index < total - 1 ? `<button data-page-move-down="${index}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; font-size: 0.75rem;">↓</button>` : ''}
          ${total > 1 ? `<button data-page-delete="${index}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; cursor: pointer; font-size: 0.75rem;">✕</button>` : ''}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div>
          <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 3px;">Page Image</label>
          ${renderUploadBox('page-' + index, page.image, 'Click to upload page image', '120px')}
        </div>
        <div>
          <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 3px;">Script / Story Text</label>
          <textarea data-page-text="${index}" rows="3" placeholder="Page narration or dialogue text..." style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font-size: 0.8rem; resize: vertical; box-sizing: border-box; font-family: var(--font-body);">${escapeHtml(page.text)}</textarea>
        </div>
        <div>
          <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 3px;">Video URL (optional)</label>
          <input data-page-video="${index}" type="text" value="${escapeAttr(page.video)}" placeholder="https://..." style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font-size: 0.8rem; box-sizing: border-box;" />
        </div>
      </div>
    </div>
  `;
}

/** Attach file upload click/change listeners for cover image and all page images */
function attachUploadListeners(pages: EditorPage[], storyId: string, coverImageData: string, rerender: () => void): void {
  // Cover image upload
  const coverArea = document.querySelector('[data-upload-area="cover-image"]');
  const coverFileInput = document.querySelector('[data-file-input="cover-image"]') as HTMLInputElement;
  const coverChangeBtn = document.querySelector('[data-change-upload="cover-image"]');
  const coverClearBtn = document.querySelector('[data-clear-upload="cover-image"]');

  if (coverArea && coverFileInput) {
    coverArea.addEventListener('click', () => coverFileInput.click());
  }
  if (coverChangeBtn && coverFileInput) {
    coverChangeBtn.addEventListener('click', (e) => { e.stopPropagation(); coverFileInput.click(); });
  }
  if (coverClearBtn) {
    coverClearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = document.getElementById('cover-image-upload');
      if (container) {
        container.dataset.editorCoverImage = '';
        container.innerHTML = renderUploadBox('cover-image', '', 'Click to upload cover image', '180px');
        attachUploadListeners(pages, storyId, '', rerender);
        scheduleAutoSave(storyId, pages);
      }
    });
  }
  if (coverFileInput) {
    coverFileInput.addEventListener('change', async () => {
      const file = coverFileInput.files?.[0];
      if (!file) return;
      const dataUrl = await editorFileToDataUrl(file);
      const container = document.getElementById('cover-image-upload');
      if (container) {
        container.dataset.editorCoverImage = dataUrl;
        container.innerHTML = renderUploadBox('cover-image', dataUrl, 'Click to upload cover image', '180px');
        attachUploadListeners(pages, storyId, dataUrl, rerender);
        scheduleAutoSave(storyId, pages);
      }
    });
  }

  // Cover video upload
  const vidArea = document.querySelector('[data-upload-area="cover-video"]');
  const vidFileInput = document.querySelector('[data-file-input="cover-video"]') as HTMLInputElement;
  const vidChangeBtn = document.querySelector('[data-change-upload="cover-video"]');
  const vidClearBtn = document.querySelector('[data-clear-upload="cover-video"]');

  if (vidArea && vidFileInput) {
    vidArea.addEventListener('click', () => vidFileInput.click());
  }
  if (vidChangeBtn && vidFileInput) {
    vidChangeBtn.addEventListener('click', (e) => { e.stopPropagation(); vidFileInput.click(); });
  }
  if (vidClearBtn) {
    vidClearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = document.getElementById('cover-video-upload');
      if (container) {
        container.dataset.editorCoverVideo = '';
        container.innerHTML = renderVideoUploadBox('cover-video', '', 'Click to upload cover video');
        attachUploadListeners(pages, storyId, coverImageData, rerender);
        scheduleAutoSave(storyId, pages);
      }
    });
  }
  if (vidFileInput) {
    vidFileInput.addEventListener('change', async () => {
      const file = vidFileInput.files?.[0];
      if (!file) return;
      const dataUrl = await editorFileToVideoDataUrl(file);
      const container = document.getElementById('cover-video-upload');
      if (container) {
        container.dataset.editorCoverVideo = dataUrl;
        container.innerHTML = renderVideoUploadBox('cover-video', dataUrl, 'Click to upload cover video');
        attachUploadListeners(pages, storyId, coverImageData, rerender);
        scheduleAutoSave(storyId, pages);
      }
    });
  }

  // Page image uploads
  pages.forEach((page, i) => {
    const uploadId = 'page-' + i;
    const area = document.querySelector(`[data-upload-area="${uploadId}"]`);
    const fileInput = document.querySelector(`[data-file-input="${uploadId}"]`) as HTMLInputElement;
    const changeBtn = document.querySelector(`[data-change-upload="${uploadId}"]`);
    const clearBtn = document.querySelector(`[data-clear-upload="${uploadId}"]`);

    if (area && fileInput) {
      area.addEventListener('click', () => fileInput.click());
    }
    if (changeBtn && fileInput) {
      changeBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncPagesFromDOMGlobal(pages);
        pages[i].image = '';
        rerender();
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        syncPagesFromDOMGlobal(pages);
        const dataUrl = await editorFileToDataUrl(file);
        pages[i].image = dataUrl;
        rerender();
      });
    }
  });
}

/** Global sync function that reads text/video from DOM into pages array */
function syncPagesFromDOMGlobal(pages: EditorPage[]): void {
  pages.forEach((_, i) => {
    const textInput = document.querySelector(`[data-page-text="${i}"]`) as HTMLTextAreaElement;
    const videoInput = document.querySelector(`[data-page-video="${i}"]`) as HTMLInputElement;
    if (textInput) pages[i].text = textInput.value;
    if (videoInput) pages[i].video = videoInput.value.trim();
    // Note: image is set directly via upload, not synced from a text input
  });
}

function attachEditorListeners(
  pages: EditorPage[],
  storyId: string,
  isEdit: boolean,
  existing: Story | undefined,
  coverImageData: string,
  rerender: () => void
): void {
  // Auto-save on input changes
  const autoSaveHandler = () => {
    syncPagesFromDOMGlobal(pages);
    scheduleAutoSave(storyId, pages);
  };
  document.querySelectorAll('#ed-title, #ed-author, #ed-synopsis').forEach(el => {
    el.addEventListener('input', autoSaveHandler);
  });
  document.querySelectorAll('#ed-genre, #ed-format, #ed-rating').forEach(el => {
    el.addEventListener('change', autoSaveHandler);
  });
  document.querySelectorAll('[data-page-text], [data-page-video]').forEach(el => {
    el.addEventListener('input', autoSaveHandler);
  });

  // Add page
  document.getElementById('editor-add-page')?.addEventListener('click', () => {
    syncPagesFromDOMGlobal(pages);
    pages.push({ image: '', text: '', video: '' });
    rerender();
  });

  // Move page up
  document.querySelectorAll('[data-page-move-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncPagesFromDOMGlobal(pages);
      const idx = parseInt((btn as HTMLElement).dataset.pageMoveUp!);
      if (idx > 0) [pages[idx - 1], pages[idx]] = [pages[idx], pages[idx - 1]];
      rerender();
    });
  });

  // Move page down
  document.querySelectorAll('[data-page-move-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncPagesFromDOMGlobal(pages);
      const idx = parseInt((btn as HTMLElement).dataset.pageMoveDown!);
      if (idx < pages.length - 1) [pages[idx], pages[idx + 1]] = [pages[idx + 1], pages[idx]];
      rerender();
    });
  });

  // Delete page
  document.querySelectorAll('[data-page-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      syncPagesFromDOMGlobal(pages);
      const idx = parseInt((btn as HTMLElement).dataset.pageDelete!);
      if (pages.length > 1) pages.splice(idx, 1);
      rerender();
    });
  });

  // Cancel buttons
  const cancelHandler = () => {
    const hasContent = (document.getElementById('ed-title') as HTMLInputElement)?.value.trim();
    if (hasContent && !isEdit) {
      showModal({
        title: 'Discard Draft?',
        content: '<p>You have unsaved changes. Do you want to discard them?</p>',
        confirmText: 'Discard',
        cancelText: 'Keep Editing',
        onConfirm: () => {
          clearEditorDraft();
          loadTabContent();
        },
      });
    } else {
      loadTabContent();
    }
  };
  document.getElementById('editor-cancel')?.addEventListener('click', cancelHandler);
  document.getElementById('editor-cancel-bottom')?.addEventListener('click', cancelHandler);

  // Save button
  document.getElementById('editor-save')?.addEventListener('click', async () => {
    syncPagesFromDOMGlobal(pages);

    const title = (document.getElementById('ed-title') as HTMLInputElement)?.value.trim();
    const author = (document.getElementById('ed-author') as HTMLInputElement)?.value.trim() || 'DRiVE Studios';
    const genre = (document.getElementById('ed-genre') as HTMLSelectElement)?.value as Genre;
    const format = (document.getElementById('ed-format') as HTMLSelectElement)?.value as StoryFormat;
    const synopsis = (document.getElementById('ed-synopsis') as HTMLTextAreaElement)?.value.trim();
    const contentRating = (document.getElementById('ed-rating') as HTMLSelectElement)?.value as ContentRating;
    const finalCoverImage = (document.querySelector('[data-editor-cover-image]') as HTMLElement)?.dataset.editorCoverImage || '';
    const coverVideo = (document.querySelector('[data-editor-cover-video]') as HTMLElement)?.dataset.editorCoverVideo || '';

    if (!title) {
      showModal({ title: 'Missing Title', content: '<p>Please enter a story title.</p>', confirmText: 'OK', cancelText: '', onConfirm: () => {} });
      return;
    }

    // Build panels, pageScripts, pageVideos from pages array
    const panels: string[] = pages.map(p => p.image);
    const pageScripts: Record<number, string> = {};
    const pageVideos: Record<number, string> = {};
    pages.forEach((p, i) => {
      if (p.text) pageScripts[i] = p.text;
      if (p.video) pageVideos[i] = p.video;
    });

    const saveBtn = document.getElementById('editor-save') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      await saveOfficialStory({
        id: storyId,
        title,
        author,
        genre,
        format,
        synopsis,
        coverImage: finalCoverImage,
        coverVideo: coverVideo || undefined,
        isFeatured: existing?.isFeatured ?? false,
        isEditorPick: existing?.isEditorPick ?? false,
        sortOrder: existing?.sortOrder ?? currentOfficialStories.length + 1,
        panels,
        pageScripts,
        pageVideos,
        contentRating,
        officialStatus: existing?.officialStatus || 'draft',
      });

      clearEditorDraft();

      // Show success toast
      const toast = document.createElement('div');
      toast.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 10px 24px; border-radius: 12px; font-weight: 700; font-size: 0.9rem; z-index: 9999; box-shadow: var(--shadow-lg);';
      toast.textContent = isEdit ? '✅ Story Updated!' : '✅ Story Saved!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);

      loadAllMetrics();
      loadTabContent();
    } catch (err: any) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save and Quit';
      }
      showModal({ title: 'Save Error', content: `<p style="color: #ef4444;">${err.message || 'Unknown error'}</p>`, confirmText: 'OK', cancelText: '', onConfirm: () => {} });
    }
  });
}

/** Escape for HTML attribute values */
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
          <button data-toggle-user-pick="${story.id}" data-is-pick="${story.isEditorsPick || false}" style="flex: 1; padding: 7px; border-radius: 8px; border: 1px solid var(--color-border); background: ${story.isEditorsPick ? '#10b981' : 'var(--color-bg)'}; color: ${story.isEditorsPick ? '#fff' : 'var(--color-text-secondary)'}; cursor: pointer; font-size: 0.75rem; font-weight: 600;">
            \uD83C\uDFC6 ${story.isEditorsPick ? 'Unpick' : 'Pick'}
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

  document.querySelectorAll('[data-toggle-user-pick]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.dataset.toggleUserPick!;
      const current = el.dataset.isPick === 'true';
      await toggleUserStoryEditorPick(id, !current);
      loadAllMetrics();
      loadTabContent();
    });
  });
}

// ═══════════════════════════════════════════
// TAB: CONTENT MANAGEMENT
// ═══════════════════════════════════════════

function renderContentManagementTab(area: HTMLElement): void {
  area.innerHTML = `
    <div style="max-width: 760px; margin: 0 auto; padding: 16px 0 40px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, var(--color-purple), #8a2be2); display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 12px; box-shadow: 0 4px 16px rgba(139,92,246,0.3);">
          ${ICON.layout}
        </div>
        <h2 style="margin: 0 0 6px; font-family: var(--font-heading); font-size: 1.3rem; color: var(--color-text-primary);">Content Management</h2>
        <p style="margin: 0; color: var(--color-text-muted); font-size: 0.85rem; max-width: 520px; margin: 0 auto;">
          Curate homepage layouts, tune platform recommendation algorithms, and analyze reader engagement across DRiVE.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Card 1: Manage story tiles -->
        <div id="cm-card-tiles" class="cm-hub-card" style="background: var(--color-surface); border: 2px solid rgba(139,92,246,0.3); border-radius: 18px; padding: 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--color-purple), #a855f7, #ec4899);"></div>
          <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, var(--color-purple), #7c3aed); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(139,92,246,0.3);">
            🗂️
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--color-text-primary);">Manage story tiles</h3>
              <span style="background: rgba(139,92,246,0.15); color: var(--color-purple); font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px; text-transform: uppercase;">Live Visual View</span>
            </div>
            <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4;">
              Open the interactive visual website view starting on Home. Preview and manage story placement across Home, Featured, and Explore feeds with purple tint mode.
            </p>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--color-bg); color: var(--color-purple); font-size: 1.1rem; font-weight: 700; flex-shrink: 0; border: 1px solid var(--color-border);">
            →
          </div>
        </div>

        <!-- Card 2: Stats for nerds -->
        <div id="cm-card-stats" class="cm-hub-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 18px; padding: 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
          <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #06b6d4, #0284c7); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(6,182,212,0.25);">
            📊
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--color-text-primary);">Stats for nerds</h3>
              <span style="background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px; text-transform: uppercase;">Deep Analytics</span>
            </div>
            <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4;">
              Deep-dive metrics: reader completion velocities, drop-off curves, genre resonance, audio playback ratios, and platform engagement telemetry.
            </p>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--color-bg); color: var(--color-text-muted); font-size: 1.1rem; font-weight: 700; flex-shrink: 0; border: 1px solid var(--color-border);">
            →
          </div>
        </div>

        <!-- Card 3: Algorithm -->
        <div id="cm-card-algorithm" class="cm-hub-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 18px; padding: 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
          <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(16,185,129,0.25);">
            ⚡
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--color-text-primary);">Algorithm</h3>
              <span style="background: rgba(16,185,129,0.15); color: #10b981; font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 8px; text-transform: uppercase;">Feed Tuning</span>
            </div>
            <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4;">
              Configure feed recommendation weights, freshness decay curves, community discovery boosts, and personalized exploration multipliers.
            </p>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--color-bg); color: var(--color-text-muted); font-size: 1.1rem; font-weight: 700; flex-shrink: 0; border: 1px solid var(--color-border);">
            →
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  document.getElementById('cm-card-tiles')?.addEventListener('click', () => {
    setContentManagementMode(true);
    navigate('home');
  });

  document.getElementById('cm-card-stats')?.addEventListener('click', () => {
    openStatsForNerdsModal();
  });

  document.getElementById('cm-card-algorithm')?.addEventListener('click', () => {
    openAlgorithmConfigModal();
  });
}

// ═══════════════════════════════════════════
// TAB: MODERATION (WIP)
// ═══════════════════════════════════════════

function renderModerationTab(area: HTMLElement): void {
  area.innerHTML = `
    <div style="max-width: 760px; margin: 0 auto; padding: 16px 0 40px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; margin: 0 auto 12px; box-shadow: 0 4px 16px rgba(99,102,241,0.3);">
          ${ICON.flag}
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;">
          <h2 style="margin: 0; font-family: var(--font-heading); font-size: 1.3rem; color: var(--color-text-primary);">Moderation Center</h2>
          <span style="background: #6366f1; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.5px;">WIP</span>
        </div>
        <p style="margin: 0; color: var(--color-text-muted); font-size: 0.85rem; max-width: 520px; margin: 0 auto;">
          DRiVE platform moderation, safety enforcement, community report triage, and automated content compliance.
        </p>
      </div>

      <!-- WIP Notice Banner -->
      <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 1.3rem;">🚧</span>
        <div>
          <div style="font-weight: 700; font-size: 0.85rem; color: #818cf8; margin-bottom: 2px;">Work in Progress</div>
          <div style="font-size: 0.78rem; color: var(--color-text-secondary); line-height: 1.4;">
            This module is currently being built and will eventually be how admins and moderators review flagged stories, handle user reports, manage automated safety filters, and oversee community standards across DRiVE.
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; opacity: 0.9;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.2rem;">🚩</span>
            <h4 style="margin: 0; font-size: 0.92rem; color: var(--color-text-primary);">Flagged Content Queue</h4>
          </div>
          <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.35;">
            Triage user-reported stories, comments, and avatar violations with one-click quarantine and escalation.
          </p>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; opacity: 0.9;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.2rem;">🤖</span>
            <h4 style="margin: 0; font-size: 0.92rem; color: var(--color-text-primary);">Automated Safety Filters</h4>
          </div>
          <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.35;">
            Manage Groq LLM & vision safety threshold rules, prohibited phrase lists, and automated content tagging.
          </p>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; opacity: 0.9;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.2rem;">⚖️</span>
            <h4 style="margin: 0; font-size: 0.92rem; color: var(--color-text-primary);">Disciplinary & Bans</h4>
          </div>
          <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.35;">
            Issue warnings, temporary suspensions, IP/device bans, and manage appeal cases from users.
          </p>
        </div>

        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; padding: 16px; opacity: 0.9;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.2rem;">📋</span>
            <h4 style="margin: 0; font-size: 0.92rem; color: var(--color-text-primary);">Moderator Audit Logs</h4>
          </div>
          <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted); line-height: 1.35;">
            Immutable history of all moderator actions, approvals, dismissals, and policy modifications.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════
// MODALS: STATS FOR NERDS & ALGORITHM
// ═══════════════════════════════════════════

function openStatsForNerdsModal(): void {
  showModal({
    title: '📊 Stats for Nerds — DRiVE Telemetry',
    content: `
      <div style="display: flex; flex-direction: column; gap: 16px; max-height: 70vh; overflow-y: auto; padding-right: 4px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--color-purple);">78.4%</div>
            <div style="font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase;">Completion Rate</div>
          </div>
          <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #06b6d4;">3.2 min</div>
            <div style="font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase;">Avg Session Velocity</div>
          </div>
          <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #10b981;">64.1%</div>
            <div style="font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase;">Audio / TTS Ratio</div>
          </div>
          <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 1.4rem; font-weight: 800; color: #F59E0B;">52.8%</div>
            <div style="font-size: 0.68rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase;">Return Readers</div>
          </div>
        </div>

        <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;">
          <div style="font-weight: 700; font-size: 0.8rem; color: var(--color-text-primary); margin-bottom: 10px;">Genre Resonance Distribution</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 3px;">
                <span>Fantasy & Sci-Fi</span>
                <span style="font-weight: 700;">44%</span>
              </div>
              <div style="height: 6px; border-radius: 3px; background: var(--color-surface); overflow: hidden;">
                <div style="width: 44%; height: 100%; background: linear-gradient(90deg, var(--color-purple), #8a2be2);"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 3px;">
                <span>Horror & Mystery</span>
                <span style="font-weight: 700;">28%</span>
              </div>
              <div style="height: 6px; border-radius: 3px; background: var(--color-surface); overflow: hidden;">
                <div style="width: 28%; height: 100%; background: linear-gradient(90deg, #ec4899, #f43f5e);"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 3px;">
                <span>Romance & Drama</span>
                <span style="font-weight: 700;">18%</span>
              </div>
              <div style="height: 6px; border-radius: 3px; background: var(--color-surface); overflow: hidden;">
                <div style="width: 18%; height: 100%; background: linear-gradient(90deg, #06b6d4, #3b82f6);"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--color-text-secondary); margin-bottom: 3px;">
                <span>Comedy & Slice of Life</span>
                <span style="font-weight: 700;">10%</span>
              </div>
              <div style="height: 6px; border-radius: 3px; background: var(--color-surface); overflow: hidden;">
                <div style="width: 10%; height: 100%; background: linear-gradient(90deg, #10b981, #059669);"></div>
              </div>
            </div>
          </div>
        </div>

        <div style="background: rgba(139,92,246,0.06); border: 1px solid rgba(139,92,246,0.2); border-radius: 12px; padding: 12px; font-size: 0.75rem; color: var(--color-text-secondary);">
          ⚡ <strong>Platform Infrastructure:</strong> Edge Cache Hit Ratio: 94.2% · p95 LLM Token Latency: 22ms · TTS Audio Pipeline: Operational (99.98% uptime).
        </div>
      </div>
    `,
    confirmText: 'Close',
    cancelText: '',
    onConfirm: () => {},
  });
}

function openAlgorithmConfigModal(): void {
  showModal({
    title: '⚡ Feed Recommendation Algorithm',
    content: `
      <div style="display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; padding-right: 4px;">
        <p style="margin: 0; font-size: 0.8rem; color: var(--color-text-muted);">
          Adjust the ranking multipliers used to generate the Home, Featured, and Explore story carousels.
        </p>

        <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px;">
              <span>Freshness Decay Weight</span>
              <span id="algo-val-freshness" style="color: var(--color-purple);">35%</span>
            </div>
            <input type="range" min="0" max="100" value="35" style="width: 100%; accent-color: var(--color-purple);" oninput="document.getElementById('algo-val-freshness').innerText = this.value + '%'" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px;">
              <span>Editor's Pick Priority Multiplier</span>
              <span id="algo-val-pick" style="color: #06b6d4;">2.5x</span>
            </div>
            <input type="range" min="10" max="50" value="25" style="width: 100%; accent-color: #06b6d4;" oninput="document.getElementById('algo-val-pick').innerText = (this.value / 10).toFixed(1) + 'x'" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px;">
              <span>Community Likes Multiplier</span>
              <span id="algo-val-likes" style="color: #10b981;">1.8x</span>
            </div>
            <input type="range" min="10" max="40" value="18" style="width: 100%; accent-color: #10b981;" oninput="document.getElementById('algo-val-likes').innerText = (this.value / 10).toFixed(1) + 'x'" />
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px;">
              <span>User Affinity Personalization</span>
              <span id="algo-val-personal" style="color: #F59E0B;">40%</span>
            </div>
            <input type="range" min="0" max="100" value="40" style="width: 100%; accent-color: #F59E0B;" oninput="document.getElementById('algo-val-personal').innerText = this.value + '%'" />
          </div>
        </div>

        <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 12px; font-size: 0.75rem; color: var(--color-text-secondary);">
          📐 <strong>Active Scoring Formula:</strong><br>
          <code style="font-family: monospace; color: #10b981; display: block; margin-top: 4px;">Score = (Reads * 0.4 + Likes * 1.8) * Decay(t) + PickBoost(2.5)</code>
        </div>
      </div>
    `,
    confirmText: 'Save Parameters',
    cancelText: 'Cancel',
    onConfirm: () => {
      const toast = document.createElement('div');
      toast.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 10px 24px; border-radius: 12px; font-weight: 700; font-size: 0.9rem; z-index: 9999; box-shadow: var(--shadow-lg);';
      toast.textContent = '✅ Algorithm Parameters Updated!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    },
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
  if (pages.length === 0) {
    showModal({
      title: `Preview: "${story.title}"`,
      content: '<p style="text-align:center; color: var(--color-text-muted);">This story has no pages.</p>',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    });
    return;
  }

  let currentPage = 0;

  function renderInspector(): void {
    const page = pages[currentPage];
    const totalPages = pages.length;

    // Create fullscreen overlay
    let overlay = document.getElementById('slide-inspector-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'slide-inspector-overlay';
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.95); z-index: 10000; display: flex; flex-direction: column; overflow: hidden;';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(30,30,50,0.9); border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
        <div style="min-width: 0; flex: 1;">
          <h3 style="margin: 0; font-size: 0.95rem; color: #fff; font-family: var(--font-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(story.title)}</h3>
          <div style="font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 2px;">
            by <strong>${escapeHtml(story.author_name || 'Anonymous')}</strong> · ${story.genre} · ${story.format}
          </div>
        </div>
        <button id="inspector-close" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; flex-shrink: 0; margin-left: 10px;">✕</button>
      </div>

      <!-- Page Content -->
      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 16px;">
        ${page.image
          ? `<img src="${page.image}" style="max-width: 100%; max-height: 55vh; object-fit: contain; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);" />`
          : `<div style="width: 100%; max-width: 400px; aspect-ratio: 3/4; background: rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 0.9rem;">No image</div>`
        }
        ${page.text
          ? `<div style="margin-top: 16px; max-width: 600px; width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px;">
               <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.4); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">📝 Story Text</div>
               <p style="margin: 0; color: rgba(255,255,255,0.85); font-size: 0.88rem; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(page.text)}</p>
             </div>`
          : ''
        }
      </div>

      <!-- Navigation Footer -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(30,30,50,0.9); border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
        <button id="inspector-prev" style="padding: 10px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: ${currentPage > 0 ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}; color: ${currentPage > 0 ? '#fff' : 'rgba(255,255,255,0.2)'}; cursor: ${currentPage > 0 ? 'pointer' : 'default'}; font-weight: 600; font-size: 0.85rem;">
          ← Prev
        </button>
        <div style="display: flex; flex-direction: column; align-items: center;">
          <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">Page ${currentPage + 1} / ${totalPages}</span>
          <div style="display: flex; gap: 4px; margin-top: 6px;">
            ${pages.map((_, i) => `<div style="width: ${Math.min(8, 120 / totalPages)}px; height: 4px; border-radius: 2px; background: ${i === currentPage ? 'var(--color-purple)' : 'rgba(255,255,255,0.2)'};"></div>`).join('')}
          </div>
        </div>
        <button id="inspector-next" style="padding: 10px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: ${currentPage < totalPages - 1 ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}; color: ${currentPage < totalPages - 1 ? '#fff' : 'rgba(255,255,255,0.2)'}; cursor: ${currentPage < totalPages - 1 ? 'pointer' : 'default'}; font-weight: 600; font-size: 0.85rem;">
          Next →
        </button>
      </div>

      ${story.status === 'under-review' ? `
      <!-- Action Bar (only for pending stories) -->
      <div style="display: flex; gap: 8px; padding: 10px 16px; background: rgba(20,20,40,0.95); border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
        <button id="inspector-approve" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #10b981; color: white; font-weight: 700; font-size: 0.9rem; cursor: pointer;">
          ✓ Approve Story
        </button>
        <button id="inspector-deny" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #ef4444; color: white; font-weight: 700; font-size: 0.9rem; cursor: pointer;">
          ✕ Deny Story
        </button>
      </div>
      ` : ''}
    `;

    // Attach listeners
    document.getElementById('inspector-close')?.addEventListener('click', () => {
      overlay?.remove();
    });

    document.getElementById('inspector-prev')?.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        renderInspector();
      }
    });

    document.getElementById('inspector-next')?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        currentPage++;
        renderInspector();
      }
    });

    // Keyboard navigation
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 0) { currentPage--; renderInspector(); }
      else if (e.key === 'ArrowRight' && currentPage < totalPages - 1) { currentPage++; renderInspector(); }
      else if (e.key === 'Escape') { overlay?.remove(); document.removeEventListener('keydown', keyHandler); }
    };
    document.addEventListener('keydown', keyHandler);

    // Action buttons
    document.getElementById('inspector-approve')?.addEventListener('click', () => {
      overlay?.remove();
      openApproveModal(story);
    });

    document.getElementById('inspector-deny')?.addEventListener('click', () => {
      overlay?.remove();
      openDenyModal(story);
    });
  }

  renderInspector();
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
