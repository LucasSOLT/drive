import { openSquadGateModal } from '../components/squad-gate-modal.ts';
import { trackStoryReading, updateTrackedStoryStatus } from '../lib/reading-tracker.ts';
import { getRouteParam, navigate } from '../router.ts';
import { leaveReader } from '../lib/reader-origin.ts';
import { isPreviewStory, isAdminSkipActive, activateAdminSkip } from '../lib/reader-mode.ts';
import { adminSkipToNextEpisode, adminSkipButtonHtml } from '../lib/admin-skip.ts';
import { getStoryById, registerStory } from '../data/stories.ts';
import { fetchStoryByIdFromDb, fetchOfficialStories, hasAdminPrivileges } from '../lib/db.ts';
import { isEpisodeLive, canViewerOpenEpisode } from '../lib/episode-visibility.ts';
import {
  getStoryLikes, hasUserLiked, toggleStoryLike,
  isBookmarked, toggleBookmark
} from '../state.ts';
import { stopSpeaking, isSpeaking, playAudioUrl, playAudioSequence, getCurrentAlignment, setWordHighlightCallback } from '../lib/tts.ts';
import { KaraokeController, type WordTimestamp } from '../lib/karaoke.ts';
import { getSettings } from '../lib/settings.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import { getSoloEpisodeCount, getEpisodeTimeRemaining, formatTimeRemaining } from '../lib/squad-engine.ts';
import { getSquadSession } from '../lib/db.ts';
import { type SquadSession } from '../types.ts';
import { preloadAdjacentPages, getPreloadedElement, isPreloaded } from '../lib/media-preloader.ts';
import { saveReadingProgress } from './series-info.ts';
import {
  ensureAutoplayAudio,
  getAutoplayAudio,
  resetLevel as resetAudioLevel,
  playAutoplayUrl,
  stopAutoplayUrl,
  releaseAutoplayAudio,
} from '../lib/audio-fade.ts';

/** Per-episode auto-play toggle. OFF by default; reset every time an episode opens. */
let episodeAutoplay = false;
const AUTOPLAY_DELAY_MS = 1000; // wait after a page appears before audio starts (audio then plays at full volume, no fade)

// ─── SVG Icons ───
const ICON = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  bookmarkOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  bookmarkOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  heartOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  share: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  bigHeart: `<svg viewBox="0 0 24 24" fill="#EF4444" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  comment: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function renderGateInfoPage(format: 'book' | 'scroll', soloEpCount: number): string {
  const btnId = format === 'book' ? 'btn-book-lets-begin' : 'btn-waterfall-lets-begin';
  const episodeText = soloEpCount === 1 ? 'Episode 1' : `Episodes 1–${soloEpCount}`;
  const nextEpText = soloEpCount === 1 ? 'Episode 2' : `Episode ${soloEpCount + 1}`;
  return `
    <div class="reader__info-page reader__info-page--${format}">
      <div class="reader__info-glow"></div>
      
      <div class="reader__info-badge">
        <span class="squad-gate-badge-dot"></span>
        <span>${episodeText.toUpperCase()} COMPLETE · SQUAD GATE</span>
      </div>

      <h2 class="reader__info-title">Nobody Plays Alone on DRiVE</h2>
      
      <p class="reader__info-lead">
        What is a story without the whole <strong>CAST</strong> of characters?
      </p>

      <div class="reader__info-card">
        <div class="reader__info-pillar">
          <div class="reader__info-pillar-icon">✨</div>
          <div class="reader__info-pillar-text">
            <strong>${episodeText} ${soloEpCount === 1 ? 'is' : 'are'} Free & Solo</strong>
            <span>All first ${soloEpCount === 1 ? 'episodes are' : soloEpCount + ' episodes are'} 100% free and accessible solo to experience the hook.</span>
          </div>
        </div>

        <div class="reader__info-pillar">
          <div class="reader__info-pillar-icon">👥</div>
          <div class="reader__info-pillar-text">
            <strong>${nextEpText}+ Requires a Squad of 3 to 5</strong>
            <span>To continue the journey, assemble your friends or match globally with fellow adventurers.</span>
          </div>
        </div>

        <div class="reader__info-pillar">
          <div class="reader__info-pillar-icon">💎</div>
          <div class="reader__info-pillar-text">
            <strong>Affordable Story Credit Pass</strong>
            <span>Subsequent episodes vary in price with simple credit unlocks — zero microtransactions.</span>
          </div>
        </div>
      </div>

      <p class="reader__info-closing">
        Form your squad, coordinate your sparks, and experience the story together as a team.
      </p>

      <button class="reader__info-btn" id="${btnId}">
        <span>Let's Begin</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
      ${adminSkipButtonHtml(btnId + '-admin')}
    </div>
  `;
}

function escapeCardText(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Preview-only SPARC card: shows the prompt as readers would see it, but is skippable and saves nothing. */
function renderSparcPreviewCard(
  format: 'book' | 'scroll',
  prompt: { text?: string; mediaUrls?: string[] },
  hasNextEpisode: boolean,
  mode: 'preview' | 'admin' = 'preview',
): string {
  const btnId = format === 'book' ? 'btn-book-sparc-preview-skip' : 'btn-waterfall-sparc-preview-skip';
  const media = (prompt.mediaUrls || [])
    .filter(u => /^https?:\/\//i.test(u))
    .map(u => `<img src="${escapeCardText(u)}" alt="" style="max-width:100%; border-radius:8px; margin-top:12px;">`)
    .join('');
  return `
    <div class="reader__info-page reader__info-page--${format}">
      <div class="reader__info-glow"></div>

      <div class="reader__info-badge">
        <span class="squad-gate-badge-dot" style="background:var(--color-purple);"></span>
        <span>${mode === 'admin' ? 'ADMIN SKIP - SQUAD CHECKPOINT' : 'SPARC CHECKPOINT - PREVIEW'}</span>
      </div>

      <h2 class="reader__info-title">${mode === 'admin' ? 'Squad Gate Skipped' : 'Squad Challenge Prompt'}</h2>

      <div class="reader__info-card" style="text-align:left; padding:20px;">
        <p style="font-size:0.95rem; color:var(--color-text-primary); line-height:1.6; margin:0; white-space:pre-wrap;">${escapeCardText(prompt.text?.trim() || (mode === 'admin' ? 'No SPARC prompt on this episode. As an admin you are reading solo.' : 'Reflect on what you just read.'))}</p>
        ${media}
      </div>

      <p class="reader__info-closing">
        ${mode === 'admin' ? 'Admin skip is on: no squad, no timer, nothing is saved. Continue to read solo.' : 'This is how squads see the checkpoint. Previewing is solo, so there is no timer and nothing is saved.'}
      </p>

      <button class="reader__info-btn" id="${btnId}">
        <span>${hasNextEpisode ? 'Skip to Next Episode' : (mode === 'admin' ? 'Finish' : 'Skip &amp; Finish Preview')}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </div>
  `;
}

function renderSparcTransitionCard(format: 'book' | 'scroll'): string {
  const btnId = format === 'book' ? 'btn-book-sparc-transition' : 'btn-waterfall-sparc-transition';
  return `
    <div class="reader__info-page reader__info-page--${format}">
      <div class="reader__info-glow"></div>
      
      <div class="reader__info-badge">
        <span class="squad-gate-badge-dot" style="background:var(--color-purple);"></span>
        <span>EPISODE COMPLETE</span>
      </div>

      <h2 class="reader__info-title">⚡ SPARC Checkpoint</h2>
      
      <p class="reader__info-lead">
        You've finished reading this episode! Now it's time to share your thoughts with your squad.
      </p>

      <div class="reader__info-card" style="text-align:center; padding:24px;">
        <div style="font-size:2.5rem; margin-bottom:12px;">💬</div>
        <p style="font-size:0.95rem; color:var(--color-text-primary); line-height:1.6; margin:0;">
          Answer the challenge prompt, share your perspective, and see what your squad members think.
          <br><br>
          <strong>Everyone must reply</strong> before the squad advances to the next episode.
        </p>
      </div>

      <button class="reader__info-btn" id="${btnId}" style="background:linear-gradient(135deg, var(--color-purple), var(--color-blue));">
        <span>Open SPARC Checkpoint</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
      ${adminSkipButtonHtml(btnId + '-admin')}
    </div>
  `;
}

// ─── Page media mounting: instant spinner → smooth fade-in ───
// Each call bumps a token so a slow load from an OLD page can never appear on the NEW page.
let mediaMountToken = 0;

function mountPageMedia(container: HTMLElement, opts: {
  url: string;
  isVideo: boolean;
  id: string;
  alt: string;
  style: string;
}): void {
  const token = ++mediaMountToken;
  const stale = () => token !== mediaMountToken || !container.isConnected;

  container.innerHTML = '';
  container.classList.add('reader__page--loading');

  // Spinner shows INSTANTLY (before any network work)
  const spinner = document.createElement('div');
  spinner.className = 'reader__media-spinner';
  spinner.innerHTML = '<div class="reader__spinner-ring"></div>';
  container.appendChild(spinner);

  // Reuse the preloaded element when we have one
  const cached = getPreloadedElement(opts.url);
  let el: HTMLImageElement | HTMLVideoElement;
  if (opts.isVideo) {
    const v = cached instanceof HTMLVideoElement
      ? (cached.isConnected ? (cached.cloneNode(true) as HTMLVideoElement) : cached)
      : document.createElement('video');
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('webkit-playsinline', '');
    if (!v.getAttribute('src')) v.src = opts.url;
    el = v;
  } else {
    const img = cached instanceof HTMLImageElement
      ? (cached.cloneNode(true) as HTMLImageElement)
      : new Image();
    img.alt = opts.alt;
    if (!img.getAttribute('src')) img.src = opts.url;
    el = img;
  }
  el.id = opts.id;
  el.className = 'reader-media'; // starts invisible (opacity 0, no glow)
  el.style.cssText = opts.style;
  container.appendChild(el);

  let revealed = false;
  const reveal = () => {
    if (revealed || stale()) return;
    revealed = true;
    spinner.remove();
    container.classList.remove('reader__page--loading');
    // two frames so the browser paints opacity:0 first and the fade actually runs
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (stale()) return;
      el.classList.add('reader-media--loaded');
      if (el instanceof HTMLVideoElement) ensureVideoPlayback(el);
    }));
  };

  const showError = () => {
    if (revealed || stale()) return;
    revealed = true;
    spinner.remove();
    el.remove();
    container.classList.remove('reader__page--loading');
    const err = document.createElement('button');
    err.type = 'button';
    err.className = 'reader__media-error';
    err.textContent = "Couldn't load this page. Tap to retry";
    err.addEventListener('click', (e) => { e.stopPropagation(); mountPageMedia(container, opts); });
    container.appendChild(err);
  };

  if (el instanceof HTMLImageElement) {
    const ready = () => {
      const done = () => reveal();
      if (typeof el.decode === 'function') (el as HTMLImageElement).decode().then(done, done);
      else done();
    };
    if (el.complete && el.naturalWidth > 0) ready();
    else {
      el.addEventListener('load', ready, { once: true });
      el.addEventListener('error', showError, { once: true });
    }
  } else {
    const v = el as HTMLVideoElement;
    if (v.readyState >= 2) reveal();
    else {
      v.addEventListener('loadeddata', reveal, { once: true });
      v.addEventListener('canplay', reveal, { once: true });
      v.addEventListener('error', showError, { once: true });
      // Low-data / low-power mode can stall before first frame: after 5s, show it if metadata is in
      setTimeout(() => { if (!revealed && v.readyState >= 1) reveal(); }, 5000);
      if (v.networkState === HTMLMediaElement.NETWORK_EMPTY) v.load();
    }
  }
}

export function render(): string {
  const storyId = getRouteParam();
  if (!storyId) {
    return `
      <div class="reader-error" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100dvh; gap:16px; text-align:center; padding:20px;">
        <p style="font-size:1.1rem; color:var(--color-text-secondary);">No story ID provided.</p>
        <button class="btn btn--secondary" onclick="window.__driveLeaveReader ? window.__driveLeaveReader() : (window.location.hash = 'home')" style="padding:8px 20px;">← Go Back</button>
      </div>
    `;
  }

  const story = getStoryById(storyId);
  if (!story) {
    return `
      <div class="reader reader--loading" id="reader-container" data-story-id="${storyId}">
        <header class="reader__header" style="display:flex;">
          <button class="reader__header-btn reader__header-btn--back" id="reader-back" aria-label="Go back" onclick="window.__driveLeaveReader ? window.__driveLeaveReader() : (window.location.hash = 'home')">
            ${ICON.back}
          </button>
        </header>
        <div class="reader__content" id="reader-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:calc(100dvh - 60px); gap:16px;">
          <div style="width:36px; height:36px; border:3px solid rgba(255,255,255,0.15); border-top-color:var(--color-purple); border-radius:50%; animation:spin 1s linear infinite;"></div>
          <p style="color:var(--color-text-secondary); font-size:0.95rem;">Loading story...</p>
          <button class="btn btn--secondary" onclick="window.__driveLeaveReader ? window.__driveLeaveReader() : (window.location.hash = 'home')" style="margin-top:12px; font-size:0.85rem; padding:8px 16px;">← Back to Stories</button>
        </div>
      </div>
    `;
  }

  const liked = hasUserLiked(storyId);
  const likeCount = getStoryLikes(storyId);
  const bookmarked = isBookmarked(storyId);

  let contentHtml = '';

  // Head start: begin fetching the opening pages the moment the reader renders
  // (before init() runs), instead of waiting until after the first paint.
  preloadAdjacentPages(story.panels || [], story.pageVideos, 0);

  // Auto-play audio is OFF by default every time an episode is opened
  episodeAutoplay = false;
  releaseAutoplayAudio();

  if (story.format === 'scroll') {
    contentHtml = `
      <div class="reader__scroll-content">
        ${story.panels.map((panel: string, i: number) => {
          const isVideo = isVideoMedia(panel) || !!(story.pageVideos && story.pageVideos[i]);
          const mediaUrl = (story.pageVideos && story.pageVideos[i]) || panel;
          const pageAudioSrc = story.pageAudioSource?.[i];
          const effectiveAudioMode = pageAudioSrc || (story.audioMode === 'simple_upload' ? 'upload' : 'ai');
          const hasAudio = effectiveAudioMode !== 'silent' && effectiveAudioMode !== 'native' && (
            !!story.pageAudio?.[i] ||
            !!(story.pageDialogue?.[i]?.some((l: any) => !!l.audioUrl))
          );
          return `
          <div class="reader__panel reader__panel--loading" data-panel-index="${i}">
            ${isVideo
              ? `<video class="reader__panel-video reader-media" src="${mediaUrl}" autoplay loop playsinline webkit-playsinline data-panel-idx="${i}" style="width:100%;height:auto;border-radius:8px;display:block;"></video>`
              : `<img class="reader-media" src="${panel}" alt="Panel ${i + 1}" ${i < 3 ? 'fetchpriority="high"' : 'loading="lazy"'}>`
            }
            ${hasAudio ? `
              <button class="reader-audio-btn" data-audio-panel="${i}" type="button" title="Play audio">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            ` : ''}
          </div>
        `;}).join('')}

        <!-- Gate/SPARC end card inserted dynamically in init() -->
        <div id="scroll-end-card"></div>
      </div>
    `;
  } else if (story.format === 'book') {
    const page0Media = (story.pageVideos && story.pageVideos[0]) || (story.panels && story.panels[0]) || '';
    const pageAudioSrc = story.pageAudioSource?.[0];
    const effectiveAudioMode = pageAudioSrc || (story.audioMode === 'simple_upload' ? 'upload' : 'ai');
    const hasAudio = effectiveAudioMode !== 'silent' && effectiveAudioMode !== 'native' && (
      !!story.pageAudio?.[0] ||
      !!(story.pageDialogue?.[0]?.some((l: any) => !!l.audioUrl))
    );
    // No bare <img>/<video> here: updatePage() mounts page 1 through mountPageMedia()
    // right after render, so the first thing readers see is the spinner, then a fade-in.
    const firstPageMedia = page0Media
      ? `<div class="reader__media-spinner"><div class="reader__spinner-ring"></div></div>`
      : '';

    contentHtml = `
      <div class="reader__book-content">
        <div class="reader__page${page0Media ? ' reader__page--loading' : ''}" id="book-page" style="position:relative;">
          ${firstPageMedia}
        </div>
        <div class="reader__page-nav">
          <div class="reader__page-dots" id="book-dots">
            ${Array.from({ length: story.panels.length + 1 }).map((_, i) => `<span class="reader__dot ${i === 0 ? 'active' : ''} ${i >= story.panels.length ? 'reader__dot--info' : ''}" data-page="${i}" title="${i >= story.panels.length ? 'End' : 'Page ' + (i + 1)}"></span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  const themeColor = story.themeColor || (story as any).theme_color || '#141424';

  return `
    <div class="reader" id="reader-container" data-story-id="${storyId}" style="--story-theme-color: ${themeColor}; background: ${themeColor} !important;">

      <!-- Progress bar -->
      <div class="reader__progress-track">
        <div class="reader__progress-bar" id="reader-progress"></div>
      </div>

      <!-- 48h Squad Timer Banner -->
      <div class="reader__timer-banner" id="reader-timer-banner" style="display:none;">
        <span class="reader__timer-icon">⏱️</span>
        <span class="reader__timer-text" id="reader-timer-text"></span>
      </div>

      <!-- Floating action header -->
      <header class="reader__header" id="reader-header">
        <button class="reader__header-btn reader__header-btn--back" id="reader-back" aria-label="Go back">
          ${ICON.back}
        </button>

        <div class="reader__header-info">
          <h2 class="reader__header-title">${story.title}</h2>
        </div>

        <div class="reader__desktop-hint">
          <span><kbd>←</kbd> / <kbd>→</kbd> Turn Page</span>
          <span><kbd>Esc</kbd> Exit</span>
        </div>

        <div class="reader__header-actions">
          <button class="reader__action-btn ${bookmarked ? 'active' : ''}" id="btn-bookmark" aria-label="Bookmark">
            <span class="reader__action-icon" id="bookmark-icon">${bookmarked ? ICON.bookmarkOn : ICON.bookmarkOff}</span>
          </button>
          <button class="reader__action-btn ${liked ? 'active liked' : ''}" id="btn-like" aria-label="Like">
            <span class="reader__action-icon" id="like-icon">${liked ? ICON.heartOn : ICON.heartOff}</span>
            <span class="reader__action-count" id="like-count">${formatCount(likeCount)}</span>
          </button>
          <button class="reader__action-btn" id="btn-comments" aria-label="Comments">
            <span class="reader__action-icon">${ICON.comment}</span>
          </button>
          <button class="reader__action-btn active" id="btn-cc" aria-label="Captions">
            <span class="reader__action-icon reader__cc-icon">CC</span>
          </button>
          <button class="reader__action-btn" id="btn-autoplay" aria-label="Auto-play audio" aria-pressed="false" title="Auto-play audio: Off">
            <span class="reader__action-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon></svg>
            </span>
          </button>
        </div>
      </header>

      ${story.format === 'book' ? `
        <!-- Side Navigation Arrows: Left & Right, vertically halfway up -->
        <button class="reader__side-arrow reader__side-arrow--prev" id="book-prev" aria-label="Previous page" title="Previous page (← or A)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="reader__side-arrow reader__side-arrow--next" id="book-next" aria-label="Next page" title="Next page (→ or D)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      ` : ''}

      <!-- Story content -->
      <div class="reader__content" id="reader-content" style="background: ${themeColor};">
        ${contentHtml}
      </div>

      <!-- Double-tap heart overlay -->
      <div class="reader__heart-overlay" id="heart-overlay">
        <div class="reader__heart-burst" id="heart-burst">
          ${ICON.bigHeart}
        </div>
      </div>

      <!-- Action toast (bookmark/share/etc) -->
      <div class="reader__action-toast" id="action-toast"></div>
    </div>
  `;
}

export async function init(): Promise<void> {
  let captionsOpen = true;
  let activeKaraokeCtrl: KaraokeController | null = null;

  // Auto-play state (the on/off flag itself is module-level `episodeAutoplay`)
  let autoplayTimer: ReturnType<typeof setTimeout> | null = null;
  let autoplayKick: (() => void) | null = null;   // scroll format: start with the panel on screen
  let autoplayCancel: (() => void) | null = null; // scroll format: cancel pending start
  const container = document.getElementById('reader-container');
  if (!container) return;

  const storyId = container.dataset.storyId || '';
  let story = getStoryById(storyId);
  if (!story) {
    fetchStoryByIdFromDb(storyId).then(fetched => {
      if (fetched) {
        registerStory(fetched);
        const viewContainer = document.getElementById('view-container');
        if (viewContainer) {
          viewContainer.innerHTML = render();
          init();
        }
      } else {
        const content = container.querySelector('#reader-content') || container;
        content.innerHTML = `
          <div class="reader-error" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:80dvh; gap:16px; text-align:center; padding:20px;">
            <p style="font-size:1.1rem; color:var(--color-text-secondary);">Story not found or unavailable.</p>
            <button class="btn btn--secondary" onclick="window.__driveLeaveReader ? window.__driveLeaveReader() : (window.location.hash = 'home')" style="padding:8px 20px;">← Back to Stories</button>
          </div>
        `;
      }
    });
    return;
  }

  // Draft / archived / under-review official episodes are for admins only (reachable by a guessed link otherwise)
  if (!canViewerOpenEpisode(story, hasAdminPrivileges())) {
    const content = container.querySelector('#reader-content') || container;
    content.innerHTML = `
      <div class="reader-error" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:80dvh; gap:16px; text-align:center; padding:20px;">
        <p style="font-size:1.1rem; color:var(--color-text-secondary);">This episode isn't available yet.</p>
        <button class="btn btn--secondary" onclick="window.__driveLeaveReader ? window.__driveLeaveReader() : (window.location.hash = 'home')" style="padding:8px 20px;">&larr; Back to Stories</button>
      </div>
    `;
    return;
  }
  const themeColor = story.themeColor || (story as any).theme_color || '#141424';
  container.style.setProperty('--story-theme-color', themeColor);
  container.style.setProperty('background', themeColor, 'important');
  const contentEl = document.getElementById('reader-content');
  if (contentEl) contentEl.style.setProperty('background', themeColor, 'important');

  let siblingEpisodes: { id: string; episodeNumber: number }[] = [];
  if (story.storyGroupId) {
    const allStories = await fetchOfficialStories();
    // Readers only ever move between LIVE episodes. A preview (owner/admin) sees every episode.
    const includeNonLive = isPreviewStory(story);
    siblingEpisodes = allStories
      .filter(s => s.storyGroupId === story.storyGroupId)
      .filter(s => includeNonLive || isEpisodeLive(s) || s.id === story.id)
      .map(s => ({ id: s.id, episodeNumber: s.episodeNumber || 1 }))
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  if (siblingEpisodes.length > 1) {
    // Episode nav bar is position:fixed, no padding needed
    
    const navHtml = `
      <div id="episode-nav-bar" style="
        position: fixed; bottom: 0; left: 0; right: 0;
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 20px;
        background: linear-gradient(to top, var(--color-bg), rgba(20,20,36,0.95));
        border-top: 1px solid var(--color-border);
        z-index: 100;
        max-width: 600px;
        margin: 0 auto;
      ">
        <button id="ep-nav-prev" style="
          padding: 10px 16px; border-radius: 10px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text-primary);
          cursor: pointer; font-size: 0.82rem; font-weight: 600;
          display: flex; align-items: center; gap: 6px;
        ">← Previous Episode</button>
        
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted);">
          Episode ${story.episodeNumber || 1}
        </span>
        
        <button id="ep-nav-next" style="
          padding: 10px 16px; border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--color-purple), #8a2be2);
          color: white;
          cursor: pointer; font-size: 0.82rem; font-weight: 700;
          display: flex; align-items: center; gap: 6px;
        ">Next Episode →</button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', navHtml);

    // Reserve room for the fixed bar so page dots / captions never sit under it.
    const epBar = document.getElementById('episode-nav-bar');
    const readerRoot = container; // #reader-container
    if (epBar && readerRoot) {
      readerRoot.classList.add('reader--has-ep-bar');
      const syncEpBarHeight = () => {
        const h = Math.ceil(epBar.getBoundingClientRect().height) || 64;
        readerRoot.style.setProperty('--ep-nav-h', `${h}px`);
      };
      syncEpBarHeight();
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(syncEpBarHeight);
        ro.observe(epBar);
        window.addEventListener('hashchange', () => ro.disconnect(), { once: true });
      }
    }

    const currentEpNum = story.episodeNumber || 1;
    const currentIdx = siblingEpisodes.findIndex(e => e.episodeNumber === currentEpNum);
    const prevEp = currentIdx > 0 ? siblingEpisodes[currentIdx - 1] : null;
    const nextEp = currentIdx < siblingEpisodes.length - 1 ? siblingEpisodes[currentIdx + 1] : null;
    
    const prevBtn = document.getElementById('ep-nav-prev');
    const nextBtn = document.getElementById('ep-nav-next');
    
    if (prevBtn) {
      if (prevEp) {
        prevBtn.addEventListener('click', () => navigate('story/' + prevEp.id));
      } else {
        prevBtn.style.visibility = 'hidden';
      }
    }
    
    if (nextBtn) {
      if (nextEp) {
        nextBtn.addEventListener('click', () => navigate('story/' + nextEp.id));
      } else {
        nextBtn.style.visibility = 'hidden';
      }
    }
  }

  // Auto-track reading session in My Stories library
  trackStoryReading({
    id: story.id,
    title: story.title,
    coverImage: story.coverImage,
    coverVideo: story.coverVideo,
    format: story.format,
    author: story.author,
    genre: story.genre,
    episodeNumber: story.episodeNumber || 1,
  });

  // ─── Dynamic Squad Gate & Timer ───
  const episodeNumber = story.episodeNumber || 1;
  const storyGroupId = story.storyGroupId || story.id;
  let soloEpCount: number = story.soloEpisodeCount || 1;
  // Preview (owner/admin looking at non-live or explicitly previewed content) is solo:
  // no squad gate, no squad timer. SPARC is shown as a skippable card instead.
  const previewMode = isPreviewStory(story);
  // Admin skip: an admin chose to read this story solo past the squad gate / SPARC barriers.
  // Honored only while the user is an admin (see reader-mode.ts). Preview already is solo, so it wins.
  const adminSkipActive = !previewMode && isAdminSkipActive(storyGroupId);
  const soloMode = previewMode || adminSkipActive;
  let isPostGateEpisode = !soloMode && episodeNumber > soloEpCount;
  let isGateEpisode = !soloMode && episodeNumber === soloEpCount;
  const previewSparcPrompt = soloMode ? story.sparcPrompt : undefined;
  const hasPromptContent = !!previewSparcPrompt && (!!previewSparcPrompt.text?.trim() || !!previewSparcPrompt.mediaUrls?.length);
  // Solo checkpoint card: preview shows it when the episode has a SPARC prompt;
  // admin skip shows it at every gate/post-gate episode so there is always a way to continue.
  const previewSparc = (previewMode && hasPromptContent) || (adminSkipActive && episodeNumber >= soloEpCount);
  const showEndCard = isGateEpisode || isPostGateEpisode || previewSparc;
  const soloCardMode: 'preview' | 'admin' = adminSkipActive ? 'admin' : 'preview';

  // Skip the solo checkpoint card: go to the next episode of this story, or leave the reader after the last one
  const previewSkip = () => {
    stopSpeaking();
    if (adminSkipActive) {
      adminSkipToNextEpisode(storyGroupId, episodeNumber);
      return;
    }
    const idx = siblingEpisodes.findIndex(e => e.episodeNumber === episodeNumber);
    const next = idx >= 0 && idx < siblingEpisodes.length - 1 ? siblingEpisodes[idx + 1] : null;
    if (next) navigate('story/' + next.id);
    else leaveReader();
  };

  // Admin-only "Admin skip" on the real barriers (same as a user sees, plus this button)
  const wireAdminSkip = (buttonId: string) => {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      stopSpeaking();
      adminSkipToNextEpisode(storyGroupId, episodeNumber);
    });
  };
  // Re-renders the scroll-format end card (assigned further down) when the gate flags flip
  let refreshScrollEndCard: (() => void) | null = null;

  // Fetch soloEpisodeCount from DB for accuracy (async, won't block render)
  getSoloEpisodeCount(storyGroupId).then(count => {
    soloEpCount = count;
  }).catch(() => {});

  // ─── Solo Episode Guard ───
  // Prevent direct URL access to post-gate episodes without a squad
  const squadId = localStorage.getItem('drive_active_squad_id') || '';
  if (isPostGateEpisode && !squadId) {
    const content = container.querySelector('#reader-content') || container;
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:80dvh; gap:16px; text-align:center; padding:20px;">
        <div style="font-size:3rem;">🔒</div>
        <h2 style="font-family:var(--font-heading); font-size:1.3rem; margin:0;">Squad Required</h2>
        <p style="color:var(--color-text-secondary); font-size:0.9rem; line-height:1.6; max-width:360px;">
          This episode is part of a squad reading experience. Join or create a squad to continue the story together.
        </p>
        <button id="gate-guard-btn" class="btn btn--primary" style="padding:12px 28px; font-weight:700;">Open Squad Gate</button>
        ${adminSkipButtonHtml('gate-guard-admin-skip')}
        <button class="btn btn--secondary" onclick="window.__driveLeaveReader ? window.__driveLeaveReader() : (window.location.hash = 'home')" style="padding:8px 20px;">← Back</button>
      </div>
    `;
    document.getElementById('gate-guard-admin-skip')?.addEventListener('click', () => {
      // Read the rest of this story solo; reload so the reader re-evaluates with admin skip on
      activateAdminSkip(storyGroupId);
      window.location.reload();
    });
    document.getElementById('gate-guard-btn')?.addEventListener('click', () => {
      openSquadGateModal({
        storyId: story!.id,
        storyTitle: story!.title,
        storyGroupId,
        episodeNumber,
        soloEpisodeCount: soloEpCount,
      });
    });
    return;
  }

  // 48h Timer for squad episodes (post-gate episodes, or the gate episode itself when the squad's
  // session runs on it because the story has nothing after the gate)
  let activeSession: SquadSession | null = null;
  if ((isPostGateEpisode || isGateEpisode) && squadId) {
    getSquadSession(squadId).then(session => {
      activeSession = session;
      // Ignore a stale squad id that belongs to a different story
      if (session && session.storyGroupId !== storyGroupId) return;
      if (session && isGateEpisode && session.currentEpisodeNumber === episodeNumber) {
        isGateEpisode = false;
        isPostGateEpisode = true;
        refreshScrollEndCard?.();
      }
      if (session && isPostGateEpisode) {
        const timerBanner = document.getElementById('reader-timer-banner');
        const timerText = document.getElementById('reader-timer-text');
        if (timerBanner && timerText) {
          timerBanner.style.display = 'flex';
          const updateTimer = () => {
            const remaining = getEpisodeTimeRemaining(session);
            timerText.textContent = `${formatTimeRemaining(remaining)} remaining · Episode ${episodeNumber}`;
            if (remaining <= 0) timerText.textContent = 'Time expired · Episode ' + episodeNumber;
          };
          updateTimer();
          const timerInterval = setInterval(updateTimer, 60000);
          // Cleanup on navigation
          window.addEventListener('hashchange', () => clearInterval(timerInterval), { once: true });
        }
      }
    }).catch(() => {});
  }

  const progressBar = document.getElementById('reader-progress');
  const header = document.getElementById('reader-header');

  // Ensure video playback (always muted — audio comes from upload/AI only)
  const initialBookVideo = document.getElementById('book-video') as HTMLVideoElement | null;
  if (initialBookVideo) {
    ensureVideoPlayback(initialBookVideo);
  }
  document.querySelectorAll<HTMLVideoElement>('.reader__panel-video').forEach(vid => {
    ensureVideoPlayback(vid);
  });

  // Waterfall: each panel shows a spinner until its media is ready, then fades in
  document.querySelectorAll<HTMLElement>('.reader__panel--loading').forEach(panel => {
    const media = panel.querySelector('.reader-media') as HTMLImageElement | HTMLVideoElement | null;
    const show = () => {
      panel.classList.remove('reader__panel--loading');
      if (media) requestAnimationFrame(() => media.classList.add('reader-media--loaded'));
    };
    if (!media) { show(); return; }
    if (media instanceof HTMLImageElement) {
      if (media.complete && media.naturalWidth > 0) show();
      else {
        media.addEventListener('load', show, { once: true });
        media.addEventListener('error', show, { once: true });
      }
    } else if (media.readyState >= 2) {
      show();
    } else {
      media.addEventListener('loadeddata', show, { once: true });
      media.addEventListener('error', show, { once: true });
      setTimeout(() => { if (media.readyState >= 1) show(); }, 5000);
    }
  });

  // ─── Back button ───
  document.getElementById('reader-back')?.addEventListener('click', () => {
    stopSpeaking();
    // Return to the screen the user entered the story from (Series Info, Library, Dashboard...),
    // never to another episode of the same story.
    leaveReader();
  });

    // ─── Desktop Keyboard Navigation ───
    const handleKeyNav = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        if (story.format === 'book') {
          e.preventDefault();
          document.getElementById('book-next')?.click();
        } else if (story.format === 'scroll') {
          e.preventDefault();
          container.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        if (story.format === 'book') {
          e.preventDefault();
          document.getElementById('book-prev')?.click();
        } else if (story.format === 'scroll') {
          e.preventDefault();
          container.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        document.getElementById('reader-back')?.click();
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Activate Let's Begin button on gate page
        const letsBeginBtn = document.getElementById('btn-book-lets-begin');
        if (letsBeginBtn) {
          e.preventDefault();
          letsBeginBtn.click();
          return;
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        // Space = play / pause the page audio (same as the Play button under the story text)
        if (story.format === 'book' && pageHasAudio(currentPage)) {
          playAudioForPage(currentPage);
        }
      }
    };
    window.addEventListener('keydown', handleKeyNav);

  const cleanupReader = () => {
    cancelAutoplay();
    autoplayCancel?.();
    if (activeKaraokeCtrl) { activeKaraokeCtrl.destroy(); activeKaraokeCtrl = null; }
    stopSpeaking();
    episodeAutoplay = false;
    releaseAutoplayAudio();
    window.removeEventListener('keydown', handleKeyNav);
    window.removeEventListener('hashchange', cleanupReader);
    window.removeEventListener('popstate', cleanupReader);
  };

  window.addEventListener('hashchange', cleanupReader, { once: true });
  window.addEventListener('popstate', cleanupReader, { once: true });

  // ─── Auto-hide header on scroll ───
  let lastScroll = 0;
  let headerVisible = true;
  const showHeader = () => { if (header && !headerVisible) { header.classList.remove('hidden'); headerVisible = true; } };
  const hideHeader = () => { if (header && headerVisible) { header.classList.add('hidden'); headerVisible = false; } };

  container.addEventListener('scroll', () => {
    const scrollTop = container.scrollTop;

    // Progress bar
    if (progressBar && story.format === 'scroll') {
      const max = container.scrollHeight - container.clientHeight;
      progressBar.style.width = max > 0 ? `${(scrollTop / max) * 100}%` : '0%';
    }

    // Auto-hide header: hide on scroll down, show on scroll up
    if (scrollTop > lastScroll && scrollTop > 80) {
      hideHeader();
    } else {
      showHeader();
    }
    lastScroll = scrollTop;
  });

  // ─── Action toast helper ───
  const actionToast = document.getElementById('action-toast');
  const showActionToast = (msg: string) => {
    if (!actionToast) return;
    actionToast.textContent = msg;
    actionToast.classList.add('show');
    setTimeout(() => actionToast.classList.remove('show'), 2000);
  };

  // ─── Bookmark toggle ───
  const bookmarkBtn = document.getElementById('btn-bookmark');
  const bookmarkIcon = document.getElementById('bookmark-icon');
  bookmarkBtn?.addEventListener('click', () => {
    const nowBookmarked = toggleBookmark(storyId);
    bookmarkBtn.classList.toggle('active', nowBookmarked);
    bookmarkBtn.classList.toggle('bookmarked', nowBookmarked);
    if (bookmarkIcon) bookmarkIcon.innerHTML = nowBookmarked ? ICON.bookmarkOn : ICON.bookmarkOff;
    bookmarkBtn.classList.add('bounce');
    setTimeout(() => bookmarkBtn.classList.remove('bounce'), 400);
    showActionToast(nowBookmarked ? 'Added to your favorites' : 'Removed from favorites');
  });

  // ─── Like toggle ───
  const likeBtn = document.getElementById('btn-like');
  const likeIcon = document.getElementById('like-icon');
  const likeCount = document.getElementById('like-count');

  const performLike = () => {
    const result = toggleStoryLike(storyId);
    likeBtn?.classList.toggle('active', result.liked);
    likeBtn?.classList.toggle('liked', result.liked);
    if (likeIcon) likeIcon.innerHTML = result.liked ? ICON.heartOn : ICON.heartOff;
    if (likeCount) likeCount.textContent = formatCount(result.count);
    // Pop animation
    likeBtn?.classList.add('bounce');
    setTimeout(() => likeBtn?.classList.remove('bounce'), 400);
  };

  likeBtn?.addEventListener('click', performLike);

  // ─── Double-tap heart ───
  const heartOverlay = document.getElementById('heart-overlay');
  const heartBurst = document.getElementById('heart-burst');
  const content = document.getElementById('reader-content');
  let lastTapTime = 0;

  content?.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 350) {
      // Double tap!
      e.preventDefault();

      // Only like if not already liked
      if (!hasUserLiked(storyId)) {
        performLike();
      }

      // Show heart burst at tap position
      if (heartOverlay && heartBurst) {
        const rect = container.getBoundingClientRect();
        const x = (e as MouseEvent).clientX - rect.left;
        const y = (e as MouseEvent).clientY - rect.top;
        heartBurst.style.left = `${x}px`;
        heartBurst.style.top = `${y}px`;
        heartOverlay.classList.add('show');
        setTimeout(() => heartOverlay.classList.remove('show'), 800);
      }
    }
    lastTapTime = now;
  });


  // ─── Book format page navigation ───
  captionsOpen = true; // CC ON by default — declared here so it's available in book page navigation
  if (story.format === 'book') {
    var currentPage = 0;
    const totalPages = showEndCard ? story.panels.length + 1 : story.panels.length;
    const pageContainer = document.getElementById('book-page');
    const dotsContainer = document.getElementById('book-dots');

    const updatePage = () => {
      cancelAutoplay(); // swiped away before the ~1s delay finished -> never start the old page's audio
      const isInfoPage = showEndCard && currentPage === story.panels.length;

      if (pageContainer) {
        // Invalidate any media still loading for the previous page
        mediaMountToken++;
        pageContainer.classList.remove('reader__page--loading');
        if (isInfoPage) {

          if (isGateEpisode) {
            // Squad Gate info page
            pageContainer.innerHTML = renderGateInfoPage('book', soloEpCount);
            wireAdminSkip('btn-book-lets-begin-admin');
            document.getElementById('btn-book-lets-begin')?.addEventListener('click', () => {
              stopSpeaking();
              openSquadGateModal({
                storyId: story.id,
                storyTitle: story.title,
                storyCoverImage: story.coverImage,
                episodeNumber: episodeNumber,
                onReplay: () => {
                  currentPage = 0;
                  updatePage();
                  renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
                },
              });
            });
          } else if (isPostGateEpisode) {
            // SPARC transition page
            pageContainer.innerHTML = renderSparcTransitionCard('book');
            wireAdminSkip('btn-book-sparc-transition-admin');
            document.getElementById('btn-book-sparc-transition')?.addEventListener('click', () => {
              stopSpeaking();
              navigate(`sparc/${squadId}/${storyGroupId}/${episodeNumber}`);
            });
          } else if (previewSparc) {
            // Preview: show the prompt as a skippable card (no squad, no timer, nothing saved)
            const idx = siblingEpisodes.findIndex(e => e.episodeNumber === episodeNumber);
            pageContainer.innerHTML = renderSparcPreviewCard('book', previewSparcPrompt || {}, idx >= 0 && idx < siblingEpisodes.length - 1, soloCardMode);
            document.getElementById('btn-book-sparc-preview-skip')?.addEventListener('click', previewSkip);
          }
        } else {
          if (activeKaraokeCtrl) {
            activeKaraokeCtrl.destroy();
            activeKaraokeCtrl = null;
          }
          // Render regular book panel
          const currentMedia = (story.pageVideos && story.pageVideos[currentPage]) || (story.panels && story.panels[currentPage]) || '';
          const isVideo = isVideoMedia(currentMedia) || !!(story.pageVideos && story.pageVideos[currentPage]);
          const pageAudioSrc = story.pageAudioSource?.[currentPage];
          const effectiveAudioMode = pageAudioSrc || (story.audioMode === 'simple_upload' ? 'upload' : 'ai');
          const hasAudio = effectiveAudioMode !== 'silent' && effectiveAudioMode !== 'native' && (
            !!story.pageAudio?.[currentPage] ||
            !!(story.pageDialogue?.[currentPage]?.some((l: any) => !!l.audioUrl))
          );
          const focalPos = story.pageFocalPositions?.[currentPage];
          const objPosStyle = focalPos && focalPos !== 'center' ? `object-position:center ${focalPos};` : '';

          // Spinner shows instantly, media fades in once decoded / first frame ready
          if (currentMedia) {
            mountPageMedia(pageContainer, {
              url: currentMedia,
              isVideo,
              id: isVideo ? 'book-video' : 'book-img',
              alt: `Page ${currentPage + 1}`,
              style: `max-width:100%;object-fit:contain;${objPosStyle}border-radius:8px;`,
            });
          } else {
            // Text-only page: nothing to load, no empty image box
            pageContainer.innerHTML = '';
          }

          // Preload adjacent pages in background
          preloadAdjacentPages(story.panels || [], story.pageVideos, currentPage);

          // Save reading progress for Series Info "Continue Episode" feature
          if (story.storyGroupId) {
            saveReadingProgress(story.storyGroupId, story.id, story.episodeNumber || 1, currentPage);
          }
          // Pages with audio are played from the Play button under the story text (bottom right).
          // (The green button over the video and the time bar were removed; tapping a word still seeks.)
          if (hasAudio) {
            // Auto-play (per-episode toggle): waits ~1s, then plays from the start at full volume
            if (episodeAutoplay) {
              scheduleAutoplay(currentPage);
            }
          }

        }

        // Re-add position:relative for audio button positioning
        pageContainer.style.position = 'relative';
      }
      

      if (dotsContainer) {
        dotsContainer.querySelectorAll('.reader__dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === currentPage);
        });
      }
      if (progressBar) {
        progressBar.style.width = `${((currentPage + 1) / totalPages) * 100}%`;
      }
      const prevBtn = document.getElementById('book-prev') as HTMLButtonElement | null;
      if (prevBtn) {
        prevBtn.disabled = currentPage === 0;
        prevBtn.style.opacity = currentPage === 0 ? '0.2' : '1';
        prevBtn.style.pointerEvents = currentPage === 0 ? 'none' : 'auto';
      }
    };

    const stopAudioAndAdvance = (action: () => void) => {
      if (activeKaraokeCtrl) {
        activeKaraokeCtrl.destroy();
        activeKaraokeCtrl = null;
      }
      stopSpeaking();
      action();
      updatePage();
      renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
    };

    document.getElementById('book-prev')?.addEventListener('click', () => {
      if (currentPage > 0) {
        stopAudioAndAdvance(() => { currentPage--; });
      }
    });
    document.getElementById('book-next')?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        stopAudioAndAdvance(() => { currentPage++; });
      } else {
        if (activeKaraokeCtrl) { activeKaraokeCtrl.destroy(); activeKaraokeCtrl = null; }
        stopSpeaking();
        if (isGateEpisode) {
          openSquadGateModal({
            storyId: story.id,
            storyTitle: story.title,
            storyCoverImage: story.coverImage,
            episodeNumber: episodeNumber,
            onReplay: () => {
              currentPage = 0;
              updatePage();
              renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
            },
          });
        } else if (isPostGateEpisode) {
          navigate(`sparc/${squadId}/${storyGroupId}/${episodeNumber}`);
        }
      }
    });

    // Dot click navigation
    dotsContainer?.addEventListener('click', (e) => {
      const dot = (e.target as HTMLElement).closest('.reader__dot') as HTMLElement;
      if (dot) {
        const targetPage = parseInt(dot.dataset.page || '0', 10);
        if (targetPage !== currentPage) {
          stopAudioAndAdvance(() => { currentPage = targetPage; });
        }
      }
    });

    // ─── Swipe Gesture Navigation (Mobile) ───
    let dismissSwipeTutorial = () => {};
    const bookContent = document.querySelector('.reader__book-content') as HTMLElement | null;
    if (bookContent) {
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;
      let touchDeltaX = 0;
      let gestureLocked: 'horizontal' | 'vertical' | null = null;
      let isSwiping = false;
      const LOCK_THRESHOLD = 10;   // px before we decide direction
      const SWIPE_DISTANCE = 60;   // px to commit a page turn
      const SWIPE_VELOCITY = 0.3;  // px/ms to commit via flick

      bookContent.addEventListener('touchstart', (e: TouchEvent) => {
        dismissSwipeTutorial();

        // Don't interfere with button taps or range inputs
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, .reader-audio-btn')) return;

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        touchDeltaX = 0;
        gestureLocked = null;
        isSwiping = false;

        // Remove transition during drag for instant feedback
        bookContent.style.transition = 'none';
      }, { passive: true });

      bookContent.addEventListener('touchmove', (e: TouchEvent) => {
        if (gestureLocked === 'vertical') return; // Let native scroll happen

        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        // Decide gesture direction once we've moved enough
        if (!gestureLocked) {
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          if (absDx < LOCK_THRESHOLD && absDy < LOCK_THRESHOLD) return; // Still in dead zone

          if (absDx > absDy * 1.2) {
            // Horizontal intent — check if we're inside a scrollable text area
            const targetEl = e.target as HTMLElement;
            if (targetEl.closest('.reader-dialogue-body')) {
              // Inside scrollable dialogue — only lock horizontal if at extremes
              const dialogueBody = targetEl.closest('.reader-dialogue-body') as HTMLElement;
              const canScrollUp = dialogueBody.scrollTop > 0;
              const canScrollDown = dialogueBody.scrollTop < dialogueBody.scrollHeight - dialogueBody.clientHeight - 2;
              if (canScrollUp || canScrollDown) {
                gestureLocked = 'vertical';
                return;
              }
            }
            gestureLocked = 'horizontal';
            isSwiping = true;
          } else {
            gestureLocked = 'vertical';
            return;
          }
        }

        // Horizontal swiping — prevent default scroll and apply visual peek
        e.preventDefault();
        touchDeltaX = dx;

        // Rubber-band resistance at boundaries
        const atLeftEdge = currentPage === 0 && dx > 0;
        const atRightEdge = currentPage >= totalPages - 1 && dx < 0;
        const dampening = (atLeftEdge || atRightEdge) ? 0.2 : 1;

        bookContent.style.transform = `translateX(${dx * dampening}px)`;
      }, { passive: false });

      bookContent.addEventListener('touchend', () => {
        if (!isSwiping || gestureLocked !== 'horizontal') {
          // Reset any partial state
          bookContent.style.transition = '';
          bookContent.style.transform = '';
          return;
        }

        const elapsed = Date.now() - touchStartTime;
        const velocity = Math.abs(touchDeltaX) / Math.max(1, elapsed);
        const commitSwipe = Math.abs(touchDeltaX) > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY;

        // Snap-back or commit animation
        bookContent.style.transition = 'transform 0.25s cubic-bezier(0.22, 0.68, 0, 1.0)';

        if (commitSwipe && touchDeltaX < 0 && currentPage < totalPages - 1) {
          // Swipe left → next page
          bookContent.style.transform = `translateX(-100%)`;
          setTimeout(() => {
            bookContent.style.transition = 'none';
            bookContent.style.transform = '';
            document.getElementById('book-next')?.click();
          }, 250);
        } else if (commitSwipe && touchDeltaX > 0 && currentPage > 0) {
          // Swipe right → prev page
          bookContent.style.transform = `translateX(100%)`;
          setTimeout(() => {
            bookContent.style.transition = 'none';
            bookContent.style.transform = '';
            document.getElementById('book-prev')?.click();
          }, 250);
        } else {
          // Rubber-band back
          bookContent.style.transform = 'translateX(0)';
          setTimeout(() => {
            bookContent.style.transition = '';
            bookContent.style.transform = '';
          }, 250);
        }

        isSwiping = false;
        gestureLocked = null;
        touchDeltaX = 0;
      }, { passive: true });

      bookContent.addEventListener('touchcancel', () => {
        bookContent.style.transition = '';
        bookContent.style.transform = '';
        isSwiping = false;
        gestureLocked = null;
        touchDeltaX = 0;
      }, { passive: true });
    }

    updatePage();
    // Auto-render captions on initial load (CC is ON by default). With CC off, the audio controls still show.
    {
      const s = getStoryById(storyId);
      if (s) renderCaptionsOverlay(s, currentPage);
    }

    // ─── First-Time Swipe Tutorial Overlay ───
    if (bookContent && totalPages > 1) {
      const TUTORIAL_KEY = 'drive_swipe_tutorial_seen';
      let hasSeen = false;
      try {
        hasSeen = localStorage.getItem(TUTORIAL_KEY) === 'true';
      } catch {
        hasSeen = true;
      }

      if (!hasSeen) {
        const overlay = document.createElement('div');
        overlay.className = 'reader-swipe-tutorial-overlay';
        overlay.id = 'reader-swipe-tutorial';
        overlay.innerHTML = `
          <div class="swipe-tutorial-card">
            <div class="swipe-tutorial-track">
              <span class="swipe-track-arrow">‹</span>
              <div class="swipe-hand-wrap">
                <svg class="swipe-hand-svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74a4.5 4.5 0 0 0-9 0c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26A1.98 1.98 0 0 0 13.4 13.5H13V7.5a1.5 1.5 0 0 0-3 0v9.75l-3.23-.67a1.52 1.52 0 0 0-1.57.57l-.87 1.15 4.9 4.9c.75.75 1.77 1.17 2.83 1.17h4.86c1.9 0 3.52-1.34 3.88-3.2l.67-3.48c.19-.98-.24-1.99-1.03-2.58z"/>
                </svg>
              </div>
              <span class="swipe-track-arrow">›</span>
            </div>
            <div class="swipe-tutorial-text">Swipe to turn pages</div>
            <div class="swipe-tutorial-sub">Tap anywhere to start reading</div>
          </div>
        `;

        bookContent.classList.add('reader__book-content--tutorial-peek');

        let dismissed = false;
        dismissSwipeTutorial = () => {
          if (dismissed) return;
          dismissed = true;
          try {
            localStorage.setItem(TUTORIAL_KEY, 'true');
          } catch {}
          bookContent.classList.remove('reader__book-content--tutorial-peek');
          overlay.classList.add('fade-out');
          setTimeout(() => overlay.remove(), 350);
        };

        overlay.addEventListener('click', dismissSwipeTutorial);
        overlay.addEventListener('touchstart', dismissSwipeTutorial, { passive: true });

        container.appendChild(overlay);
      }
    }
  }

  // Waterfall autoplay with IntersectionObserver
  if (story.format === 'scroll' && story.pageAudio) {
    let currentPlayingPanel = -1;

    // Wire up manual audio buttons
    document.querySelectorAll('[data-audio-panel]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-audio-panel') || '0');
        const sharedEl = getAutoplayAudio();
        const somethingPlaying = isSpeaking() || (!!sharedEl && !sharedEl.paused);
        if (somethingPlaying && currentPlayingPanel === idx) {
          stopSpeaking();
          stopAutoplayUrl();
          currentPlayingPanel = -1;
          (btn as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        } else {
          stopSpeaking();
          stopAutoplayUrl();
          // Reset all buttons
          document.querySelectorAll('[data-audio-panel]').forEach(b => {
            (b as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          });
          const audioUrl = story.pageAudio![idx];
          if (audioUrl) {
            playAudioUrl(audioUrl);
            currentPlayingPanel = idx;
            (btn as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
          }
        }
      });
    });

    // Auto-play on scroll into view (only while the episode's auto-play toggle is on)
    let waterfallTimer: ReturnType<typeof setTimeout> | null = null;
    const visiblePanels = new Set<number>();

    const startPanelAutoplay = (idx: number) => {
      if (waterfallTimer !== null) clearTimeout(waterfallTimer);
      waterfallTimer = setTimeout(async () => {
        waterfallTimer = null;
        if (!episodeAutoplay || !visiblePanels.has(idx) || idx === currentPlayingPanel) return;
        const url = story.pageAudio![idx];
        if (!url) return;
        stopSpeaking();
        document.querySelectorAll('[data-audio-panel]').forEach(b => {
          (b as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        });
        const ok = await playAutoplayUrl(url);
        if (!ok) {
          showActionToast('Tap ▶ to start the audio');
          return;
        }
        currentPlayingPanel = idx;
        const audioBtn = document.querySelector(`[data-audio-panel="${idx}"]`) as HTMLElement;
        if (audioBtn) {
          audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        }
      }, AUTOPLAY_DELAY_MS);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = parseInt((entry.target as HTMLElement).getAttribute('data-panel-index') || '-1');
        if (idx < 0) return;
        if (entry.isIntersecting) {
          visiblePanels.add(idx);
          if (episodeAutoplay && idx !== currentPlayingPanel && story.pageAudio![idx]) {
            startPanelAutoplay(idx);
          }
        } else {
          visiblePanels.delete(idx);
        }
      });
    }, { threshold: 0.8 }); // 80% visible triggers autoplay

    document.querySelectorAll('[data-panel-index]').forEach(panel => {
      observer.observe(panel);
    });

    // When the toggle is switched on, start with whatever panel is already on screen
    autoplayKick = () => {
      const idx = [...visiblePanels].sort((a, b) => a - b)[0];
      if (idx !== undefined && story.pageAudio![idx]) startPanelAutoplay(idx);
    };
    autoplayCancel = () => {
      if (waterfallTimer !== null) { clearTimeout(waterfallTimer); waterfallTimer = null; }
    };
  }

  // ─── Dynamic End Card for Scroll Format ───
  if (story.format === 'scroll') {
    const renderScrollEndCard = () => {
      const scrollEndCard = document.getElementById('scroll-end-card');
      if (!scrollEndCard) return;
      if (isGateEpisode) {
        scrollEndCard.innerHTML = renderGateInfoPage('scroll', soloEpCount);
        wireAdminSkip('btn-waterfall-lets-begin-admin');
        document.getElementById('btn-waterfall-lets-begin')?.addEventListener('click', () => {
          openSquadGateModal({
            storyId: story.id,
            storyTitle: story.title,
            storyCoverImage: story.coverImage,
            episodeNumber: episodeNumber,
            onReplay: () => {
              container.scrollTo({ top: 0, behavior: 'smooth' });
            },
          });
        });
      } else if (isPostGateEpisode) {
        scrollEndCard.innerHTML = renderSparcTransitionCard('scroll');
        wireAdminSkip('btn-waterfall-sparc-transition-admin');
        document.getElementById('btn-waterfall-sparc-transition')?.addEventListener('click', () => {
          stopSpeaking();
          navigate(`sparc/${squadId}/${storyGroupId}/${episodeNumber}`);
        });
      } else if (previewSparc) {
        const idx = siblingEpisodes.findIndex(e => e.episodeNumber === episodeNumber);
        scrollEndCard.innerHTML = renderSparcPreviewCard('scroll', previewSparcPrompt || {}, idx >= 0 && idx < siblingEpisodes.length - 1, soloCardMode);
        document.getElementById('btn-waterfall-sparc-preview-skip')?.addEventListener('click', previewSkip);
      }
    };
    renderScrollEndCard();
    refreshScrollEndCard = renderScrollEndCard;
  }

  // ─── Comment button → fullscreen comments ───
  const commentBtn = document.getElementById('btn-comments');
  commentBtn?.addEventListener('click', () => {
    openFullscreenComments(storyId, story);
  });

  // ─── CC captions toggle ───
  document.getElementById('btn-cc')?.addEventListener('click', () => {
    const story = getStoryById(storyId);
    if (!story) return;
    const pageDialogue = story.pageDialogue || {};
    const pageScripts = story.pageScripts || {};
    // Check if any page has dialogue or scripts
    const hasAnyCaptions = Object.values(pageDialogue).some(lines => lines && lines.length > 0)
      || Object.values(pageScripts).some(text => !!text);

    if (!hasAnyCaptions) {
      showActionToast('Captions are unavailable for this story');
      return;
    }

    captionsOpen = !captionsOpen;
    const ccBtn = document.getElementById('btn-cc');
    if (ccBtn) ccBtn.classList.toggle('active', captionsOpen);

    // Re-render: captions on = text + controls; captions off = just the audio controls (book pages with audio)
    renderCaptionsOverlay(story, currentPage);
  });

  // ─── Auto-play audio toggle (per episode, OFF by default) ───
  const autoplayBtn = document.getElementById('btn-autoplay');
  autoplayBtn?.addEventListener('click', () => {
    episodeAutoplay = !episodeAutoplay;
    autoplayBtn.classList.toggle('active', episodeAutoplay);
    autoplayBtn.setAttribute('aria-pressed', String(episodeAutoplay));
    autoplayBtn.title = episodeAutoplay ? 'Auto-play audio: On' : 'Auto-play audio: Off';
    if (episodeAutoplay) {
      ensureAutoplayAudio(); // inside the tap -> unlocks audio for the rest of the episode
      showActionToast('Auto-play audio on');
      // Start on the page/panel the reader is already looking at
      if (story.format === 'book') {
        const stillPlaying = !!activeKaraokeCtrl && !activeKaraokeCtrl.paused;
        if (!stillPlaying) scheduleAutoplay(currentPage);
      } else {
        autoplayKick?.();
      }
    } else {
      // Only stops FUTURE auto-starts; audio already playing is left alone
      cancelAutoplay();
      autoplayCancel?.();
      showActionToast('Auto-play audio off');
    }
  });

  function escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateAllPlayButtons(playing: boolean) {
    const textPlayIcon = document.getElementById('reader-text-play-icon');
    const textPlayLabel = document.getElementById('reader-text-play-label');
    if (textPlayIcon) {
      textPlayIcon.innerHTML = playing
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
    if (textPlayLabel) {
      textPlayLabel.textContent = playing ? 'Pause' : 'Play';
    }
  }

  // ─── Per-episode auto-play (off by default, resets every time an episode opens) ───
  function cancelAutoplay() {
    if (autoplayTimer !== null) {
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function scheduleAutoplay(pageIdx: number) {
    cancelAutoplay();
    if (!episodeAutoplay) return;
    autoplayTimer = setTimeout(() => {
      autoplayTimer = null;
      // Bail out if the toggle was turned off, the reader moved on, or something is already playing
      if (!episodeAutoplay || currentPage !== pageIdx) return;
      if (activeKaraokeCtrl && !activeKaraokeCtrl.paused) return;
      if (!pageHasAudio(pageIdx)) return; // page has no audio
      playAudioForPage(pageIdx, undefined, { autoplay: true });
    }, AUTOPLAY_DELAY_MS);
  }

  /** Does this book page have playable story audio? */
  function pageHasAudio(pageIdx: number): boolean {
    const s = story || getStoryById(storyId);
    if (!s || typeof pageIdx !== 'number' || pageIdx < 0 || pageIdx >= (s.panels?.length || 0)) return false;
    const src = s.pageAudioSource?.[pageIdx];
    const mode = src || (s.audioMode === 'simple_upload' ? 'upload' : 'ai');
    return mode !== 'silent' && mode !== 'native' && (
      !!s.pageAudio?.[pageIdx] ||
      !!(s.pageDialogue?.[pageIdx]?.some((l: any) => !!l.audioUrl))
    );
  }

  function playAudioForPage(pageIdx: number, startWordIdx?: number, opts?: { autoplay?: boolean }) {
    const s = story || getStoryById(storyId);
    if (!s) return;
    const pageAudioUrl = s.pageAudio?.[pageIdx];
    const dialogueLines = s.pageDialogue?.[pageIdx] || [];
    const scriptText = s.pageScripts?.[pageIdx] || '';

    // If karaoke controller is already active on this page:
    if (activeKaraokeCtrl) {
      if (typeof startWordIdx === 'number') {
        activeKaraokeCtrl.seekToWord(startWordIdx);
        updateAllPlayButtons(true);
        return;
      }
      if (activeKaraokeCtrl.paused) {
        activeKaraokeCtrl.resume();
        updateAllPlayButtons(true);
      } else {
        activeKaraokeCtrl.pause();
        updateAllPlayButtons(false);
      }
      return;
    }

    // Determine audio URL
    let audioUrlToPlay: string | undefined = pageAudioUrl || undefined;
    if (!audioUrlToPlay && dialogueLines.length > 0) {
      const lineWithAudio = dialogueLines.find((l: any) => !!l.audioUrl);
      if (lineWithAudio && lineWithAudio.audioUrl) audioUrlToPlay = lineWithAudio.audioUrl;
    }

    if (audioUrlToPlay) {
      stopSpeaking();

      // Build word map. Word numbers follow the DISPLAYED text (what the cc-word spans are numbered by).
      const displayWordCount = dialogueLines.length > 0
        ? dialogueLines.reduce((n: number, l: any) => n + String(l.text || '').split(/\s+/).filter(Boolean).length, 0)
        : String(scriptText).split(/\s+/).filter(Boolean).length;
      let wordMap: WordTimestamp[] = [];
      let estimatedMap = false;
      if (dialogueLines.length > 0) {
        // Real alignment where it exists; lines with a known audio length but no usable alignment are
        // spread over their own audio window. Includes the silence joined between lines.
        wordMap = KaraokeController.buildMultiLineWordMap(dialogueLines);
      }
      if (wordMap.length < displayWordCount || displayWordCount === 0) {
        // Not every word could be timed (e.g. uploaded audio with no alignment): spread ALL words over the
        // real audio length (fitted as soon as the browser knows it) instead of a flat guess per word.
        const allText = dialogueLines.length > 0
          ? dialogueLines.map((l: any) => l.text).join(' ')
          : scriptText;
        const words = allText.split(/\s+/).filter(Boolean);
        const est = KaraokeController.estimateWordTimes(words, 0, words.length * 0.35);
        wordMap = est.map((w, i) => ({ wordIdx: i, lineIdx: 0, startTime: w.startTime, endTime: w.endTime }));
        estimatedMap = true;
      }
      // When auto-play is armed, reuse the pre-unlocked element (iOS needs this). Always full volume.
      const sharedAudioEl = getAutoplayAudio();
      if (sharedAudioEl) resetAudioLevel();

      activeKaraokeCtrl = new KaraokeController(audioUrlToPlay, wordMap, {
        onWordChange: (wordIdx) => {
          const overlay = document.getElementById('reader-captions-overlay');
          if (!overlay) return;
          const activeSpans = overlay.querySelectorAll('.cc-word--active');
          activeSpans.forEach(span => span.classList.remove('cc-word--active'));
          if (wordIdx >= 0) {
            const target = overlay.querySelector(`.cc-word[data-word-idx="${wordIdx}"]`) as HTMLElement;
            if (target) {
              target.classList.add('cc-word--active');
              const color = target.getAttribute('data-highlight-color') || s.narratorHighlightColor || '#7C6FFA';
              target.style.setProperty('--word-active-color', color);
              // Never scrollIntoView (it can scroll the whole page). Only nudge the text box itself, and only
              // when the spoken word has left the visible area, so text that fits stays completely still.
              const body = target.closest('.reader-dialogue-body') as HTMLElement | null;
              if (body && body.scrollHeight > body.clientHeight + 1) {
                const bRect = body.getBoundingClientRect();
                const tRect = target.getBoundingClientRect();
                const margin = bRect.height * 0.2;
                if (tRect.bottom > bRect.bottom - margin || tRect.top < bRect.top + margin) {
                  body.scrollTo({ top: body.scrollTop + (tRect.top - bRect.top) - bRect.height / 2 + tRect.height / 2, behavior: 'smooth' });
                }
              }
            }
          }
        },
        onFinish: () => {
          updateAllPlayButtons(false);
          if (getSettings().autoAdvance && currentPage < s.panels.length - 1) {
            setTimeout(() => {
              document.getElementById('book-next')?.click();
            }, 650);
          }
        },
      }, sharedAudioEl, { fitToAudioDuration: estimatedMap });

      if (typeof startWordIdx === 'number') {
        activeKaraokeCtrl.seekToWord(startWordIdx);
      } else if (sharedAudioEl && opts?.autoplay) {
        // Auto-play: starts straight away at full volume (no fade)
        const ctrl = activeKaraokeCtrl;
        ctrl.tryPlay().then(ok => {
          if (!ok) {
            if (activeKaraokeCtrl === ctrl) {
              updateAllPlayButtons(false);
              showActionToast('Tap ▶ to start the audio');
            }
          }
        });
      } else {
        activeKaraokeCtrl.play();
      }
      updateAllPlayButtons(true);
    } else {
      // Fallback: sequence audio if separate line URLs exist
      const audioUrls = dialogueLines.map((l: any) => l.audioUrl || null);
      if (audioUrls.some((u: any) => !!u)) {
        stopSpeaking();
        playAudioSequence(audioUrls, (idx) => {
          (window as any).__activeCaptionLineIdx = idx;
        }, () => {
          updateAllPlayButtons(false);
        });
        updateAllPlayButtons(true);
      }
    }
  }

  function renderCaptionsOverlay(story: any, pageIdx: number) {
    const existing = document.getElementById('reader-captions-overlay');
    if (existing) existing.remove();
    // The Play / Restart buttons live in this panel (the button over the video was removed), so a book
    // page with audio still gets the controls when captions are off or the page has no text.
    const controlsOnlyAllowed = story.format === 'book' && pageHasAudio(pageIdx);
    if (!captionsOpen && !controlsOnlyAllowed) return;

    const dialogueLines = captionsOpen ? (story.pageDialogue?.[pageIdx] || []) : [];
    const scriptText = captionsOpen ? (story.pageScripts?.[pageIdx] || '') : '';
    const narratorColor = story.narratorHighlightColor || '#7C6FFA';

    let content = '';
    let globalWordIdx = 0;

    const wrapWords = (text: string, lineIdx: number, highlightColor: string) => {
      const words = text.split(/\s+/).filter(Boolean);
      return words.map(word => {
        const idx = globalWordIdx++;
        return `<span class="cc-word" data-line-idx="${lineIdx}" data-word-idx="${idx}" data-highlight-color="${highlightColor}">${escapeHtml(word)}</span>`;
      }).join(' ');
    };

    if (dialogueLines.length > 0) {
      content = dialogueLines.map((line: any, idx: number) => {
        const isNarrator = line.characterId === 'narrator' || !line.characterId || /^narrator$/i.test(line.characterName || '') || (line.characterName && line.characterName.toLowerCase().includes('narrator'));
        const matchedChar = isNarrator ? null : (story.characters || []).find((c: any) => c.id === line.characterId || c.name?.toLowerCase() === line.characterName?.toLowerCase());
        const charColor = isNarrator ? narratorColor : (matchedChar?.color || '#3b82f6');
        const wordsHtml = wrapWords(line.text, idx, charColor);

        if (isNarrator) {
          return `
            <div class="reader-dialogue-row reader-dialogue-row--narrator" data-line-idx="${idx}">
              <div class="reader-dialogue-text">${wordsHtml}</div>
            </div>
          `;
        } else {
          return `
            <div class="reader-dialogue-row" data-line-idx="${idx}">
              <div class="reader-dialogue-speaker" style="color:${charColor};" title="${escapeHtml(line.characterName)}">${escapeHtml(line.characterName)}:</div>
              <div class="reader-dialogue-text">${wordsHtml}</div>
            </div>
          `;
        }
      }).join('');
    } else if (scriptText) {
      const wordsHtml = wrapWords(scriptText, 0, narratorColor);
      content = `
        <div class="reader-dialogue-row reader-dialogue-row--narrator" data-line-idx="0">
          <div class="reader-dialogue-text">${wordsHtml}</div>
        </div>
      `;
    }

    if (!content && !controlsOnlyAllowed) return;
    const controlsOnly = !content;

    const overlay = document.createElement('div');
    overlay.id = 'reader-captions-overlay';
    if (controlsOnly) overlay.classList.add('reader-captions-overlay--controls-only');
    overlay.innerHTML = `
      <div class="reader-text-controls">
        <div class="reader-text-controls__tag">
          <span class="reader-text-dot"></span>
          <span class="reader-text-tag-label">${controlsOnly ? 'Story Audio' : 'Story Text'}</span>
        </div>
        <div class="reader-text-controls__actions">
          <button type="button" class="reader-text-ctrl-btn" id="reader-text-restart" title="Restart page audio">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Restart</span>
          </button>
          <button type="button" class="reader-text-ctrl-btn reader-text-ctrl-btn--primary" id="reader-text-play" title="Play / Pause">
            <span id="reader-text-play-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
            <span id="reader-text-play-label">Play</span>
          </button>
        </div>
      </div>
      ${controlsOnly ? '' : `<div class="reader-dialogue-body" id="reader-dialogue-body">
        ${content}
      </div>`}
    `;

    // Insert below page media inside .reader__book-content
    const bookContent = document.querySelector('.reader__book-content');
    const pageNav = document.querySelector('.reader__page-nav');
    if (bookContent && pageNav) {
      bookContent.insertBefore(overlay, pageNav);
    } else if (bookContent) {
      bookContent.appendChild(overlay);
    } else {
      const readerContent = document.getElementById('reader-content');
      if (readerContent) readerContent.appendChild(overlay);
    }

    // Controls wiring
    overlay.querySelector('#reader-text-play')?.addEventListener('click', (e) => {
      e.stopPropagation();
      playAudioForPage(pageIdx);
    });

    overlay.querySelector('#reader-text-restart')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeKaraokeCtrl) {
        activeKaraokeCtrl.restart();
        updateAllPlayButtons(true);
      } else {
        playAudioForPage(pageIdx, 0);
      }
    });

    // Click on any word to seek and play
    overlay.querySelectorAll('.cc-word').forEach(wordEl => {
      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const wIdx = parseInt((wordEl as HTMLElement).getAttribute('data-word-idx') || '0');
        playAudioForPage(pageIdx, wIdx);
      });
    });

    // Update play button state if audio is already active
    if (activeKaraokeCtrl && !activeKaraokeCtrl.paused) {
      updateAllPlayButtons(true);
    }
  }
}

function openFullscreenComments(storyId: string, story: any): void {
  // Create fullscreen comment view
  const overlay = document.createElement('div');
  overlay.className = 'comment-fullscreen';
  overlay.innerHTML = `
    <div class="comment-fullscreen__header">
      <button class="comment-fullscreen__back" id="comment-back" aria-label="Back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h3 class="comment-fullscreen__title">Comments</h3>
      <span class="comment-fullscreen__count" id="fs-comment-count">0 comments</span>
    </div>
    <div class="comment-fullscreen__feed" id="fs-comment-feed">
      <div class="comment-fullscreen__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>No comments yet. Be the first!</p>
      </div>
    </div>
    <div class="comment-fullscreen__input-area">
      <textarea class="comment-fullscreen__textarea" id="fs-comment-input" placeholder="Write a comment..." rows="1" maxlength="500"></textarea>
      <button class="comment-fullscreen__send" id="fs-comment-send" disabled aria-label="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Back button
  overlay.querySelector('#comment-back')?.addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });

  // Textarea input handling
  const textarea = overlay.querySelector('#fs-comment-input') as HTMLTextAreaElement;
  const sendBtn = overlay.querySelector('#fs-comment-send') as HTMLButtonElement;

  textarea?.addEventListener('input', () => {
    const len = textarea.value.trim().length;
    sendBtn.disabled = len === 0;
    // Auto-grow
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  // Send comment (stored in localStorage for now)
  sendBtn?.addEventListener('click', () => {
    const content = textarea.value.trim();
    if (!content) return;

    // Store comment locally
    const commentsKey = `drive_comments_${storyId}`;
    const existing = JSON.parse(localStorage.getItem(commentsKey) || '[]');
    existing.push({
      id: Date.now().toString(),
      author: localStorage.getItem('drive_username') || 'You',
      content,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(commentsKey, JSON.stringify(existing));

    // Add to feed
    const feed = overlay.querySelector('#fs-comment-feed');
    const emptyState = feed?.querySelector('.comment-fullscreen__empty');
    if (emptyState) emptyState.remove();

    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item fade-in';
    commentEl.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.06);';
    commentEl.innerHTML = `
      <div style="display:flex;gap:0.5rem;align-items:flex-start;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#0D9488);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#fff;font-weight:600;">${(localStorage.getItem('drive_username') || 'Y')[0].toUpperCase()}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:baseline;gap:0.5rem;">
            <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${localStorage.getItem('drive_username') || 'You'}</span>
            <span style="font-size:0.7rem;color:#94a3b8;">Just now</span>
          </div>
          <p style="margin:0.25rem 0 0;font-size:0.88rem;color:#cbd5e1;line-height:1.4;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      </div>
    `;
    feed?.appendChild(commentEl);

    // Update count
    const countEl = overlay.querySelector('#fs-comment-count');
    const allComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
    if (countEl) countEl.textContent = `${allComments.length} comment${allComments.length !== 1 ? 's' : ''}`;

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;
  });

  // Load existing comments from localStorage
  const commentsKey = `drive_comments_${storyId}`;
  const savedComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
  if (savedComments.length > 0) {
    const feed = overlay.querySelector('#fs-comment-feed');
    const emptyState = feed?.querySelector('.comment-fullscreen__empty');
    if (emptyState) emptyState.remove();

    const countEl = overlay.querySelector('#fs-comment-count');
    if (countEl) countEl.textContent = `${savedComments.length} comment${savedComments.length !== 1 ? 's' : ''}`;

    savedComments.forEach((c: any) => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-item fade-in';
      commentEl.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.06);';
      const timeAgo = getTimeAgo(c.created_at);
      commentEl.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#0D9488);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#fff;font-weight:600;">${(c.author || 'Y')[0].toUpperCase()}</div>
          <div style="flex:1;">
            <div style="display:flex;align-items:baseline;gap:0.5rem;">
              <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${c.author || 'You'}</span>
              <span style="font-size:0.7rem;color:#94a3b8;">${timeAgo}</span>
            </div>
            <p style="margin:0.25rem 0 0;font-size:0.88rem;color:#cbd5e1;line-height:1.4;">${(c.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>
        </div>
      `;
      feed?.appendChild(commentEl);
    });
  }
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
