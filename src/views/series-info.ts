/**
 * Series Info Screen — Crunchyroll-inspired full-screen overlay.
 * Shows hero cover, synopsis, star rating, action buttons (bookmark/share),
 * episode list with thumbnails, season dropdown (S1 placeholder),
 * and sticky "Continue Episode X" bottom bar.
 *
 * While the user browses, first-page media of each episode is preloaded.
 */

import { getRouteParam, navigate } from '../router.ts';
import { fetchStoryByIdFromDb, fetchOfficialStories, getCachedOfficialStories } from '../lib/db.ts';
import { isBookmarked, toggleBookmark } from '../state.ts';
import { preloadEpisodeFirstPages } from '../lib/media-preloader.ts';
import { isVideoMedia } from '../lib/media.ts';
import { type Story } from '../types.ts';

// ─── SVG Icons ───
const ICON = {
  close: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  bookmarkOff: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  bookmarkOn: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  share: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  play: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
};

// ─── Reading progress helpers (localStorage) ───
const PROGRESS_KEY = 'drive_reading_progress';

interface ReadingProgress {
  [storyGroupId: string]: {
    lastEpisodeId: string;
    lastEpisodeNumber: number;
    lastPage: number;
    updatedAt: string;
  };
}

function getReadingProgress(): ReadingProgress {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch { return {}; }
}

export function saveReadingProgress(storyGroupId: string, episodeId: string, episodeNumber: number, page: number): void {
  const progress = getReadingProgress();
  progress[storyGroupId] = {
    lastEpisodeId: episodeId,
    lastEpisodeNumber: episodeNumber,
    lastPage: page,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function getProgressForGroup(storyGroupId: string) {
  return getReadingProgress()[storyGroupId] || null;
}

// ─── Generate a deterministic but seemingly random star rating per story ───
function getStarRating(storyId: string): number {
  // Simple hash → 4.0–5.0 range in 0.1 steps
  let hash = 0;
  for (let i = 0; i < storyId.length; i++) {
    hash = ((hash << 5) - hash) + storyId.charCodeAt(i);
    hash |= 0;
  }
  const options = [4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0];
  return options[Math.abs(hash) % options.length];
}

function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.3 && rating % 1 <= 0.7;
  let html = '';
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      html += `<span class="si-star si-star--full">${ICON.star}</span>`;
    } else if (i === fullStars && hasHalf) {
      html += `<span class="si-star si-star--half">${ICON.star}</span>`;
    } else {
      html += `<span class="si-star si-star--empty">${ICON.star}</span>`;
    }
  }
  return html;
}

// ─── Hero cover preloading ───

/** First non-video candidate for the hero banner (background-image can't show videos). */
function pickHeroCover(s: Story): string {
  const candidates = [s.seriesCoverImage, s.coverImage, s.panels?.[0]];
  return candidates.find(u => !!u && !isVideoMedia(u)) || '';
}

type HeroLoad = {
  /** true if the image loaded before the timeout */
  ok: boolean;
  /** resolves true whenever the image eventually loads (even after the timeout) */
  late: Promise<boolean>;
};

const heroPreloads = new Map<string, Promise<HeroLoad>>();

/** Load the hero image, resolving on load, error, or timeout — whichever comes first. */
function preloadHero(url: string, timeoutMs = 5000): Promise<HeroLoad> {
  if (!url) return Promise.resolve({ ok: true, late: Promise.resolve(true) });
  const existing = heroPreloads.get(url);
  if (existing) return existing;

  const p = new Promise<HeroLoad>(resolve => {
    const img = new Image();
    let settled = false;
    let lateResolve: (ok: boolean) => void = () => {};
    const late = new Promise<boolean>(r => { lateResolve = r; });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, late });
    }, timeoutMs);

    img.onload = () => {
      lateResolve(true);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: true, late });
    };
    img.onerror = () => {
      lateResolve(false);
      heroPreloads.delete(url); // allow a retry next time
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, late });
    };
    img.decoding = 'async';
    img.src = url;
  });
  heroPreloads.set(url, p);
  return p;
}

/** Minimal line-art dinosaur for the connection-error state. */
const DINO_SVG = `<svg class="si-hero__dino" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M34 8h16a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2h-9v3h7v3h-7v6c0 8-6 14-14 15l-1 8h-4l1-8h-3l-1 8h-4l1-9c-4-2-7-6-8-10L4 41v-3l7-6c2-6 7-10 13-10h6V12a4 4 0 0 1 4-4z"/>
  <circle cx="40" cy="13" r="1.3" fill="currentColor" stroke="none"/>
  <path d="M36 34l5 3"/>
</svg>`;

// ─── Render ───

export function render(): string {
  return `
    <div class="series-info" id="series-info">
      <div class="series-info__loading">
        <div class="reader__spinner-ring" style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.15);border-top-color:#10B981;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      </div>
    </div>
  `;
}

export async function init(): Promise<void> {
  const storyId = getRouteParam();
  if (!storyId) { navigate('home'); return; }

  const container = document.getElementById('series-info');
  if (!container) return;

  // Head start: if this story is already cached, begin loading its cover
  // before the network fetch even returns.
  const cachedStory = getCachedOfficialStories()?.find(s => s.id === storyId);
  if (cachedStory) preloadHero(pickHeroCover(cachedStory));

  // Fetch story + all episodes in parallel
  const [story, allStories] = await Promise.all([
    fetchStoryByIdFromDb(storyId),
    fetchOfficialStories(),
  ]);
  if (!container.isConnected) return; // user left while loading
  if (!story) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:#94a3b8;">Story not found.</div>`;
    return;
  }

  const groupId = story.storyGroupId || story.id;
  const episodes = allStories
    .filter(s => (s.storyGroupId || s.id) === groupId)
    .sort((a, b) => (a.episodeNumber || 1) - (b.episodeNumber || 1));

  // If only one episode and it's the same story, still show info screen
  if (episodes.length === 0) episodes.push(story);

  // Data for template
  const heroCover = pickHeroCover(story);

  // Keep the spinner up until the cover is ready (or failed / 5s timeout)
  const heroResult = await preloadHero(heroCover);
  if (!container.isConnected) return;
  const heroOk = heroResult.ok;

  // Preload first pages of each episode in background
  preloadEpisodeFirstPages(episodes);

  const bookmarked = isBookmarked(storyId);
  const rating = getStarRating(groupId);
  const progress = getProgressForGroup(groupId);
  const contentRatingLabel = story.contentRating || 'All Ages';

  // Synopsis truncation
  const synopsis = story.synopsis || 'No description available.';
  const synopsisShort = synopsis.length > 150 ? synopsis.substring(0, 150) + '...' : synopsis;
  const needsExpand = synopsis.length > 150;
  // Wide (computer) screens have the room: start with the full synopsis open
  const startExpanded = needsExpand && window.matchMedia('(min-width: 900px)').matches;

  // Continue / Start button
  let ctaText = `${ICON.play} Start Reading`;
  let ctaEpisodeId = episodes[0].id;
  if (progress) {
    ctaText = `${ICON.play} Continue Episode ${progress.lastEpisodeNumber}`;
    ctaEpisodeId = progress.lastEpisodeId;
  }

  // Episode read status
  const readEpisodes = new Set<string>();
  if (progress) {
    for (const ep of episodes) {
      if ((ep.episodeNumber || 1) < progress.lastEpisodeNumber) {
        readEpisodes.add(ep.id);
      }
    }
  }

  container.innerHTML = `
    <!-- Hero Section -->
    <div class="si-hero" id="si-hero">
      <div class="si-hero__bg ${heroOk && heroCover ? 'si-hero__bg--visible' : ''}" id="si-hero-bg" style="${heroOk && heroCover ? `background-image: url('${heroCover}');` : ''}"></div>
      ${heroOk ? '' : `
      <div class="si-hero__error" id="si-hero-error">
        ${DINO_SVG}
        <span class="si-hero__error-text">Connection issues, please check your network</span>
      </div>`}
      <div class="si-hero__overlay"></div>
      <button class="si-close-btn" id="si-close" aria-label="Close">${ICON.close}</button>
    </div>

    <!-- Scrollable Content -->
    <div class="si-content" id="si-content">
      <!-- Meta -->
      <div class="si-meta">
        <span class="si-rating-badge">${contentRatingLabel}</span>
        <span class="si-meta-dot">·</span>
        <span class="si-genre">${story.genre}</span>
        <span class="si-meta-dot">·</span>
        <span class="si-author">${story.author}</span>
      </div>

      <!-- Star Rating -->
      <div class="si-stars-row">
        ${renderStars(rating)}
        <span class="si-stars-text">Average: <strong>${rating.toFixed(1)}</strong></span>
      </div>

      <!-- Action Buttons -->
      <div class="si-actions">
        <button class="si-action-btn ${bookmarked ? 'si-action-btn--active' : ''}" id="si-bookmark" data-story-id="${storyId}">
          <span class="si-action-icon" id="si-bookmark-icon">${bookmarked ? ICON.bookmarkOn : ICON.bookmarkOff}</span>
          <span class="si-action-label">${bookmarked ? 'Saved' : 'Save'}</span>
        </button>
        <button class="si-action-btn" id="si-share">
          <span class="si-action-icon">${ICON.share}</span>
          <span class="si-action-label">Share</span>
        </button>
      </div>

      <!-- Synopsis -->
      <div class="si-synopsis">
        <p class="si-synopsis-text" id="si-synopsis-text">${startExpanded ? synopsis : synopsisShort}</p>
        ${needsExpand ? `<button class="si-more-details" id="si-more-details">${startExpanded ? 'Less Details' : 'More Details'}</button>` : ''}
      </div>

      <!-- Tab Bar -->
      <div class="si-tabs">
        <button class="si-tab si-tab--active">Episodes</button>
      </div>

      <!-- Season Dropdown -->
      <div class="si-season-row">
        <button class="si-season-dropdown" id="si-season-dropdown">
          ${ICON.chevronDown}
          <span>${story.title} Season 1</span>
        </button>
      </div>

      <!-- Episode List -->
      <div class="si-episode-list" id="si-episode-list">
        ${episodes.map(ep => {
          const epNum = ep.episodeNumber || 1;
          const epTitle = ep.episodeTitle || `Episode ${epNum}`;
          const epThumb = ep.episodeThumbnail || ep.panels?.[0] || ep.coverImage || '';
          const pageCount = ep.panels?.length || 0;
          const isRead = readEpisodes.has(ep.id);

          return `
            <div class="si-episode" data-episode-id="${ep.id}" data-episode-num="${epNum}">
              <div class="si-episode__thumb-wrap">
                ${epThumb
                  ? `<img class="si-episode__thumb" src="${epThumb}" alt="Episode ${epNum}" loading="lazy">`
                  : `<div class="si-episode__thumb-placeholder">${epNum}</div>`
                }
                ${isRead ? `<span class="si-episode__watched">Read</span>` : ''}
              </div>
              <div class="si-episode__info">
                <span class="si-episode__number">${epNum}.</span>
                <span class="si-episode__title">${epTitle}</span>
                <span class="si-episode__pages">${pageCount} ${pageCount === 1 ? 'page' : 'pages'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Bottom spacer for sticky bar -->
      <div style="height: calc(140px + env(safe-area-inset-bottom, 0px));"></div>
    </div>

    <!-- Sticky Bottom Bar -->
    <div class="si-sticky-bar">
      <button class="si-cta-btn" id="si-cta" data-episode-id="${ctaEpisodeId}">
        ${ctaText}
      </button>
      <button class="si-sticky-bookmark ${bookmarked ? 'si-sticky-bookmark--active' : ''}" id="si-sticky-bookmark" data-story-id="${storyId}">
        ${bookmarked ? ICON.bookmarkOn : ICON.bookmarkOff}
      </button>
    </div>

    <!-- Expand overlay for episode transition -->
    <div class="si-expand-overlay" id="si-expand-overlay"></div>
  `;

  // Store full synopsis for expand toggle
  const synopsisTextEl = document.getElementById('si-synopsis-text');
  let synopsisExpanded = startExpanded;

  // Cover failed or timed out → show dino now, swap the image in if it arrives later
  if (!heroOk && heroCover) {
    const showLateHero = () => {
      const bg = document.getElementById('si-hero-bg');
      if (!bg || !bg.isConnected) return;
      bg.style.backgroundImage = `url('${heroCover}')`;
      // next frame so the opacity transition actually runs
      requestAnimationFrame(() => bg.classList.add('si-hero__bg--visible'));
      document.getElementById('si-hero-error')?.remove();
      window.removeEventListener('online', retryHero);
    };
    const retryHero = () => {
      heroPreloads.delete(heroCover);
      preloadHero(heroCover, 15000).then(r => { if (r.ok) showLateHero(); });
    };
    heroResult.late.then(ok => { if (ok) showLateHero(); });
    window.addEventListener('online', retryHero);
  }

  // ─── Event Listeners ───

  // Close
  document.getElementById('si-close')?.addEventListener('click', () => {
    // Go back to previous screen
    const prevRoute = sessionStorage.getItem('drive_pre_series_route');
    if (prevRoute) {
      navigate(prevRoute);
      sessionStorage.removeItem('drive_pre_series_route');
    } else {
      navigate('home');
    }
  });

  // Bookmark toggle
  const wireBookmark = (btnId: string, iconId: string | null, labelUpdate: boolean) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const sid = storyId;
      const nowBookmarked = toggleBookmark(sid);
      // Update all bookmark UIs
      const bkBtn = document.getElementById('si-bookmark');
      const bkIcon = document.getElementById('si-bookmark-icon');
      const stickyBk = document.getElementById('si-sticky-bookmark');
      if (bkBtn) {
        bkBtn.classList.toggle('si-action-btn--active', nowBookmarked);
        if (bkIcon) bkIcon.innerHTML = nowBookmarked ? ICON.bookmarkOn : ICON.bookmarkOff;
        const label = bkBtn.querySelector('.si-action-label');
        if (label) label.textContent = nowBookmarked ? 'Saved' : 'Save';
      }
      if (stickyBk) {
        stickyBk.classList.toggle('si-sticky-bookmark--active', nowBookmarked);
        stickyBk.innerHTML = nowBookmarked ? ICON.bookmarkOn : ICON.bookmarkOff;
      }
    });
  };
  wireBookmark('si-bookmark', 'si-bookmark-icon', true);
  wireBookmark('si-sticky-bookmark', null, false);

  // Share
  document.getElementById('si-share')?.addEventListener('click', async () => {
    const url = `${window.location.origin}/#/series/${storyId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: story.title, text: story.synopsis || '', url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('si-share');
      if (btn) {
        const label = btn.querySelector('.si-action-label');
        if (label) { label.textContent = 'Copied!'; setTimeout(() => { label.textContent = 'Share'; }, 1500); }
      }
    }
  });

  // More Details toggle
  document.getElementById('si-more-details')?.addEventListener('click', () => {
    if (!synopsisTextEl) return;
    synopsisExpanded = !synopsisExpanded;
    synopsisTextEl.textContent = synopsisExpanded ? synopsis : synopsisShort;
    const btn = document.getElementById('si-more-details');
    if (btn) btn.textContent = synopsisExpanded ? 'Less Details' : 'More Details';
  });

  // Episode click → expand animation → reader
  document.getElementById('si-episode-list')?.addEventListener('click', (e) => {
    const epEl = (e.target as HTMLElement).closest('[data-episode-id]');
    if (!epEl) return;
    const epId = epEl.getAttribute('data-episode-id')!;
    launchEpisode(epId, epEl as HTMLElement);
  });

  // CTA button
  document.getElementById('si-cta')?.addEventListener('click', () => {
    const epId = document.getElementById('si-cta')?.getAttribute('data-episode-id');
    if (epId) {
      const ctaBtn = document.getElementById('si-cta');
      launchEpisode(epId, ctaBtn as HTMLElement);
    }
  });

  // ─── Episode Launch with Expand Animation ───
  function launchEpisode(episodeId: string, sourceEl: HTMLElement) {
    // Store navigation source so reader back button returns here
    sessionStorage.setItem('drive_reader_return_route', `series/${storyId}`);

    // Quick scale pulse on the source element
    sourceEl.style.transition = 'transform 0.1s ease';
    sourceEl.style.transform = 'scale(1.02)';

    const overlay = document.getElementById('si-expand-overlay');
    if (overlay) {
      overlay.classList.add('si-expand-overlay--active');
    }

    setTimeout(() => {
      navigate('story/' + episodeId);
    }, 300);
  }
}
