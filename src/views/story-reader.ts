import { openSquadGateModal } from '../components/squad-gate-modal.ts';
import { trackStoryReading, updateTrackedStoryStatus } from '../lib/reading-tracker.ts';
import { getRouteParam, navigate } from '../router.ts';
import { getStoryById, registerStory } from '../data/stories.ts';
import { fetchStoryByIdFromDb, fetchOfficialStories } from '../lib/db.ts';
import {
  getStoryLikes, hasUserLiked, toggleStoryLike,
  isBookmarked, toggleBookmark
} from '../state.ts';
import { stopSpeaking, isSpeaking, playAudioUrl, playAudioSequence, getCurrentAudio, seekAudio, formatTime, getCurrentAlignment, setWordHighlightCallback } from '../lib/tts.ts';
import { getSettings } from '../lib/settings.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import { getSoloEpisodeCount, getEpisodeTimeRemaining, formatTimeRemaining } from '../lib/squad-engine.ts';
import { getSquadSession } from '../lib/db.ts';
import { type SquadSession } from '../types.ts';

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
    </div>
  `;
}

export function render(): string {
  const storyId = getRouteParam();
  if (!storyId) {
    return `
      <div class="reader-error" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100dvh; gap:16px; text-align:center; padding:20px;">
        <p style="font-size:1.1rem; color:var(--color-text-secondary);">No story ID provided.</p>
        <button class="btn btn--secondary" onclick="window.history.back()" style="padding:8px 20px;">← Go Back</button>
      </div>
    `;
  }

  const story = getStoryById(storyId);
  if (!story) {
    return `
      <div class="reader reader--loading" id="reader-container" data-story-id="${storyId}">
        <header class="reader__header" style="display:flex;">
          <button class="reader__header-btn reader__header-btn--back" id="reader-back" aria-label="Go back" onclick="window.history.back()">
            ${ICON.back}
          </button>
        </header>
        <div class="reader__content" id="reader-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:calc(100dvh - 60px); gap:16px;">
          <div style="width:36px; height:36px; border:3px solid rgba(255,255,255,0.15); border-top-color:var(--color-purple); border-radius:50%; animation:spin 1s linear infinite;"></div>
          <p style="color:var(--color-text-secondary); font-size:0.95rem;">Loading story...</p>
          <button class="btn btn--secondary" onclick="window.history.back()" style="margin-top:12px; font-size:0.85rem; padding:8px 16px;">← Back to Stories</button>
        </div>
      </div>
    `;
  }

  const liked = hasUserLiked(storyId);
  const likeCount = getStoryLikes(storyId);
  const bookmarked = isBookmarked(storyId);

  let contentHtml = '';

  if (story.format === 'scroll') {
    contentHtml = `
      <div class="reader__scroll-content">
        ${story.panels.map((panel: string, i: number) => {
          const isVideo = isVideoMedia(panel) || !!(story.pageVideos && story.pageVideos[i]);
          const mediaUrl = (story.pageVideos && story.pageVideos[i]) || panel;
          return `
          <div class="reader__panel" data-panel-index="${i}">
            ${isVideo
              ? `<video class="reader__panel-video" src="${mediaUrl}" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:auto;border-radius:8px;display:block;"></video>`
              : `<img src="${panel}" alt="Panel ${i + 1}" loading="lazy">`
            }
            ${story.pageAudio?.[i] ? `
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
    const isVideoPage = isVideoMedia(page0Media) || !!(story.pageVideos && story.pageVideos[0]);
    const scriptText = story.pageScripts && story.pageScripts[0] ? story.pageScripts[0] : '';
    const hasAudio = !!story.pageAudio?.[0];
    const firstPageMedia = isVideoPage
      ? `<video id="book-video" src="${page0Media}" autoplay loop muted playsinline webkit-playsinline style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;"></video>`
      : `<img id="book-img" src="${story.panels?.[0] || ''}" alt="Page 1" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;">`;

    contentHtml = `
      <div class="reader__book-content">
        <div class="reader__page" id="book-page" style="position:relative;">
          ${firstPageMedia}
          ${hasAudio ? `
            <button class="reader-audio-btn" id="reader-audio-toggle" type="button" title="Play audio">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          ` : ''}
        </div>
        ${scriptText ? `
          <button class="reader-text-toggle" id="reader-text-toggle" type="button" title="Show story text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>
            </svg>
          </button>
          <div class="reader__script reader__script--collapsed" id="book-script" style="padding:1rem 1.25rem;margin:0.5rem auto;max-width:600px;background:rgba(0,0,0,0.6);border-radius:12px;backdrop-filter:blur(6px);display:none;">
            ${scriptText.split('\n').map((line: string) => {
              if (!line.trim()) return '<br>';
              const match = line.match(/^(\w+)\s*\(([^)]+)\):\s*"([^"]*)"$/);
              if (match) {
                return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">
                  <span style="color:#60a5fa;font-weight:600;">${match[1]}</span>
                  <span style="color:#94a3b8;font-size:0.8rem;"> (${match[2]})</span>
                  <span style="color:#f1f5f9;font-style:italic;"> "${match[3]}"</span>
                </p>`;
              }
              return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">${line}</p>`;
            }).join('')}
          </div>
        ` : ''}
        <div class="reader__page-nav">
          <button class="reader__page-btn" id="book-prev" aria-label="Previous page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="reader__page-dots" id="book-dots">
            ${Array.from({ length: story.panels.length + 1 }).map((_, i) => `<span class="reader__dot ${i === 0 ? 'active' : ''} ${i >= story.panels.length ? 'reader__dot--info' : ''}" data-page="${i}" title="${i >= story.panels.length ? 'End' : 'Page ' + (i + 1)}"></span>`).join('')}
          </div>
          <button class="reader__page-btn" id="book-next" aria-label="Next page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
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
          <span class="reader__header-meta">${story.author} · ${story.genre}</span>
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
          <button class="reader__action-btn" id="btn-share" aria-label="Share">
            <span class="reader__action-icon">${ICON.share}</span>
          </button>
          <button class="reader__action-btn" id="btn-comments" aria-label="Comments">
            <span class="reader__action-icon">${ICON.comment}</span>
          </button>
          <button class="reader__action-btn active" id="btn-cc" aria-label="Captions">
            <span class="reader__action-icon reader__cc-icon">CC</span>
          </button>
        </div>
      </header>

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
            <button class="btn btn--secondary" onclick="window.history.length > 1 ? window.history.back() : window.location.hash = 'explore'" style="padding:8px 20px;">← Back to Stories</button>
          </div>
        `;
      }
    });
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
    siblingEpisodes = allStories
      .filter(s => s.storyGroupId === story.storyGroupId)
      .map(s => ({ id: s.id, episodeNumber: s.episodeNumber || 1 }))
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  if (siblingEpisodes.length > 1) {
    container.style.paddingBottom = '70px';
    
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
  const isPostGateEpisode = episodeNumber > soloEpCount;
  const isGateEpisode = episodeNumber === soloEpCount;
  const showEndCard = isGateEpisode || isPostGateEpisode;

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
        <button class="btn btn--secondary" onclick="window.history.length > 1 ? window.history.back() : window.location.hash = 'explore'" style="padding:8px 20px;">← Back</button>
      </div>
    `;
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

  // 48h Timer for post-gate episodes
  let activeSession: SquadSession | null = null;
  if (isPostGateEpisode && squadId) {
    getSquadSession(squadId).then(session => {
      activeSession = session;
      if (session) {
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

  // Ensure video playback for initial page video or scroll videos
  const initialBookVideo = document.getElementById('book-video') as HTMLVideoElement | null;
  if (initialBookVideo) {
    ensureVideoPlayback(initialBookVideo);
  }
  document.querySelectorAll<HTMLVideoElement>('.reader__panel-video').forEach(vid => {
    ensureVideoPlayback(vid);
  });

  const progressBar = document.getElementById('reader-progress');
  const header = document.getElementById('reader-header');

  // ─── Background Music (BGM) ───
  const bgmUrl = story.bgmUrl || (story as any).bgm_url;
  const bgmVolume = typeof story.bgmVolume === 'number' ? story.bgmVolume : (typeof (story as any).bgm_volume === 'number' ? (story as any).bgm_volume : 0.25);
  let bgmAudio: HTMLAudioElement | null = null;
  if (bgmUrl) {
    bgmAudio = new Audio(bgmUrl);
    bgmAudio.loop = true;
    bgmAudio.volume = bgmVolume;
    const playBgmWithGestureFallback = () => {
      if (bgmAudio && bgmAudio.paused) {
        bgmAudio.play().catch(() => {
          const onUserGesture = () => {
            if (bgmAudio && bgmAudio.paused) bgmAudio.play().catch(() => {});
            document.removeEventListener('click', onUserGesture);
            document.removeEventListener('keydown', onUserGesture);
            document.removeEventListener('touchstart', onUserGesture);
          };
          document.addEventListener('click', onUserGesture, { once: true });
          document.addEventListener('keydown', onUserGesture, { once: true });
          document.addEventListener('touchstart', onUserGesture, { once: true });
        });
      }
    };
    playBgmWithGestureFallback();
  }

  const stopBgm = () => {
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio = null;
    }
  };

  // ─── Back button ───
  document.getElementById('reader-back')?.addEventListener('click', () => {
    stopBgm();
    stopSpeaking();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('home');
    }
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
    } else if (e.code === 'Space') {
      e.preventDefault();
      const bookAudioBtn = document.getElementById('reader-audio-toggle');
      if (bookAudioBtn) {
        bookAudioBtn.click();
      }
    }
  };

  window.addEventListener('keydown', handleKeyNav);

  const cleanupReader = () => {
    stopBgm();
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

  // ─── Share ───
  const shareBtn = document.getElementById('btn-share');
  shareBtn?.addEventListener('click', async () => {
    const shareData = {
      title: story.title,
      text: `Check out "${story.title}" by ${story.author} on DRiVE!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showActionToast('Link copied!');
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      showActionToast('Link copied!');
    }
  });

  // ─── Book format page navigation ───
  captionsOpen = true; // CC ON by default — declared here so it's available in book page navigation
  if (story.format === 'book') {
    var currentPage = 0;
    let scriptVisible = false;
    const totalPages = showEndCard ? story.panels.length + 1 : story.panels.length;
    const pageContainer = document.getElementById('book-page');
    const dotsContainer = document.getElementById('book-dots');
    let scriptContainer = document.getElementById('book-script');

    const updatePage = () => {
      const toggleBtn = document.getElementById('reader-text-toggle');
      const isInfoPage = showEndCard && currentPage === story.panels.length;

      if (pageContainer) {
        if (isInfoPage) {
          if (toggleBtn) toggleBtn.style.display = 'none';
          if (scriptContainer) scriptContainer.style.display = 'none';

          if (isGateEpisode) {
            // Squad Gate info page
            pageContainer.innerHTML = renderGateInfoPage('book', soloEpCount);
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
                  if (captionsOpen) renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
                },
              });
            });
          } else if (isPostGateEpisode) {
            // SPARC transition page
            pageContainer.innerHTML = renderSparcTransitionCard('book');
            document.getElementById('btn-book-sparc-transition')?.addEventListener('click', () => {
              stopBgm();
              stopSpeaking();
              navigate(`sparc/${squadId}/${storyGroupId}/${episodeNumber}`);
            });
          }
        } else {
          // Render regular book panel
          if (toggleBtn) toggleBtn.style.display = 'flex';
          const currentMedia = (story.pageVideos && story.pageVideos[currentPage]) || (story.panels && story.panels[currentPage]) || '';
          const isVideo = isVideoMedia(currentMedia) || !!(story.pageVideos && story.pageVideos[currentPage]);
          const hasAudio = !!story.pageAudio?.[currentPage];
          const focalPos = story.pageFocalPositions?.[currentPage];
          const objPosStyle = focalPos && focalPos !== 'center' ? `object-position:center ${focalPos};` : '';
          if (isVideo) {
            pageContainer.innerHTML = `<video id="book-video" src="${currentMedia}" autoplay loop muted playsinline webkit-playsinline style="max-width:100%;max-height:100%;object-fit:contain;${objPosStyle}border-radius:8px;"></video>`;
            const bv = pageContainer.querySelector('#book-video') as HTMLVideoElement | null;
            if (bv) ensureVideoPlayback(bv);
          } else {
            pageContainer.innerHTML = `<img id="book-img" src="${story.panels?.[currentPage] || ''}" alt="Page ${currentPage + 1}" style="max-width:100%;max-height:100%;object-fit:contain;${objPosStyle}border-radius:8px;">`;
          }
          // Add audio play button if page has audio
          if (hasAudio) {
            const audioBtn = document.createElement('button');
            audioBtn.className = 'reader-audio-btn';
            audioBtn.id = 'reader-audio-toggle';
            audioBtn.title = isSpeaking() ? 'Pause audio' : 'Play audio';
            audioBtn.innerHTML = isSpeaking()
              ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
              : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            pageContainer.appendChild(audioBtn);

            // Floating audio scrubber pill
            const scrubberPill = document.createElement('div');
            scrubberPill.className = 'reader-audio-scrubber-pill';
            scrubberPill.innerHTML = `
              <span class="reader-scrubber-time" id="reader-time-current">0:00</span>
              <input type="range" class="audio-scrubber__slider" id="reader-audio-slider" min="0" max="100" value="0" step="0.1" aria-label="Audio progress">
              <span class="reader-scrubber-time" id="reader-time-duration">--:--</span>
            `;
            pageContainer.appendChild(scrubberPill);

            const updateScrubberDisplay = (current: number, duration: number) => {
              const slider = document.getElementById('reader-audio-slider') as HTMLInputElement | null;
              const curEl = document.getElementById('reader-time-current');
              const durEl = document.getElementById('reader-time-duration');
              if (duration > 0 && !isNaN(duration)) {
                const pct = ((current / duration) * 100).toFixed(1);
                if (slider && document.activeElement !== slider) {
                  slider.value = pct;
                }
                if (durEl) durEl.textContent = formatTime(duration);
              }
              if (curEl) curEl.textContent = formatTime(current);
            };

            // Pre-load audio duration for current page
            const currentAudioSrc = story.pageAudio?.[currentPage];
            if (currentAudioSrc) {
              const pre = new Audio(currentAudioSrc);
              pre.addEventListener('loadedmetadata', () => {
                const durEl = document.getElementById('reader-time-duration');
                if (durEl && pre.duration && !isNaN(pre.duration)) {
                  durEl.textContent = formatTime(pre.duration);
                }
              });
            }

            // Scrubber range input seeking
            const sliderEl = scrubberPill.querySelector('#reader-audio-slider') as HTMLInputElement | null;
            sliderEl?.addEventListener('input', (e) => {
              e.stopPropagation();
              const audio = getCurrentAudio();
              const dur = audio?.duration || 0;
              const target = (parseFloat(sliderEl.value) / 100) * dur;
              seekAudio(target);
              const curEl = document.getElementById('reader-time-current');
              if (curEl) curEl.textContent = formatTime(target);
            });
            sliderEl?.addEventListener('click', (e) => {
              e.stopPropagation();
            });

            const onAudioFinished = () => {
              audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
              audioBtn.title = 'Play audio';
              const slider = document.getElementById('reader-audio-slider') as HTMLInputElement | null;
              const curEl = document.getElementById('reader-time-current');
              if (slider) slider.value = '0';
              if (curEl) curEl.textContent = '0:00';

              // Hands-free auto-advance
              if (getSettings().autoAdvance && currentPage < story.panels.length - 1) {
                setTimeout(() => {
                  document.getElementById('book-next')?.click();
                }, 650);
              }
            };

            audioBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (isSpeaking()) {
                stopSpeaking();
                audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
                audioBtn.title = 'Play audio';
              } else {
                const dialogueLines = story.pageDialogue?.[currentPage];
                if (dialogueLines && dialogueLines.length > 0) {
                  const audioUrls = dialogueLines.map((l: any) => l.audioUrl || null);
                  const hasDialogueAudio = audioUrls.some((u: any) => !!u);
                  if (hasDialogueAudio) {
                    playAudioSequence(audioUrls, (idx) => { (window as any).__activeCaptionLineIdx = idx; }, onAudioFinished);
                  } else {
                    playAudioUrl(story.pageAudio![currentPage], onAudioFinished, updateScrubberDisplay);
                  }
                } else {
                  playAudioUrl(story.pageAudio![currentPage], onAudioFinished, updateScrubberDisplay);
                }
                audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
                audioBtn.title = 'Pause audio';
              }
            });

            // Autoplay if setting is on
            if (getSettings().autoPlay) {
              const dialogueLines = story.pageDialogue?.[currentPage];
              if (dialogueLines && dialogueLines.length > 0) {
                const audioUrls = dialogueLines.map((l: any) => l.audioUrl || null);
                const hasDialogueAudio = audioUrls.some((u: any) => !!u);
                if (hasDialogueAudio) {
                  playAudioSequence(audioUrls, (idx) => { (window as any).__activeCaptionLineIdx = idx; }, onAudioFinished);
                } else {
                  playAudioUrl(story.pageAudio![currentPage], onAudioFinished, updateScrubberDisplay);
                }
              } else {
                playAudioUrl(story.pageAudio![currentPage], onAudioFinished, updateScrubberDisplay);
              }
              audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
              audioBtn.title = 'Pause audio';
            }
          }

          // Update script text
          scriptContainer = document.getElementById('book-script');
          if (scriptContainer) {
            const scriptText = story.pageScripts && story.pageScripts[currentPage] ? story.pageScripts[currentPage] : '';
            if (scriptText) {
              scriptContainer.innerHTML = scriptText.split('\n').map((line: string) => {
                if (!line.trim()) return '<br>';
                const match = line.match(/^(\w+)\s*\(([^)]+)\):\s*"([^"]*)"$/);
                if (match) {
                  return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">
                    <span style="color:#60a5fa;font-weight:600;">${match[1]}</span>
                    <span style="color:#94a3b8;font-size:0.8rem;"> (${match[2]})</span>
                    <span style="color:#f1f5f9;font-style:italic;"> "${match[3]}"</span>
                  </p>`;
                }
                return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">${line}</p>`;
              }).join('');
              scriptContainer.style.display = scriptVisible ? 'block' : 'none';
            } else {
              scriptContainer.style.display = 'none';
            }
          }
        }

        // Re-add position:relative for audio button positioning
        pageContainer.style.position = 'relative';
      }
      
      // Update text toggle button icon
      if (toggleBtn && !isInfoPage) {
        toggleBtn.innerHTML = scriptVisible
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>`;
        toggleBtn.title = scriptVisible ? 'Hide story text' : 'Show story text';
      }
      if (dotsContainer) {
        dotsContainer.querySelectorAll('.reader__dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === currentPage);
        });
      }
      if (progressBar) {
        progressBar.style.width = `${((currentPage + 1) / totalPages) * 100}%`;
      }
    };

    document.getElementById('book-prev')?.addEventListener('click', () => {
      if (currentPage > 0) { stopSpeaking(); currentPage--; updatePage(); if (captionsOpen) renderCaptionsOverlay(getStoryById(storyId)!, currentPage); }
    });
    document.getElementById('book-next')?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        stopSpeaking();
        currentPage++;
        updatePage();
        if (captionsOpen) renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
      } else {
        // Reached end — trigger appropriate action
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
              if (captionsOpen) renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
            },
          });
        } else if (isPostGateEpisode) {
          stopBgm();
          navigate(`sparc/${squadId}/${storyGroupId}/${episodeNumber}`);
        }
      }
    });

    // Text toggle
    document.getElementById('reader-text-toggle')?.addEventListener('click', () => {
      scriptVisible = !scriptVisible;
      updatePage();
    });

    // Dot click navigation
    dotsContainer?.addEventListener('click', (e) => {
      const dot = (e.target as HTMLElement).closest('.reader__dot') as HTMLElement;
      if (dot) {
        stopSpeaking();
        currentPage = parseInt(dot.dataset.page || '0', 10);
        updatePage();
        if (captionsOpen) renderCaptionsOverlay(getStoryById(storyId)!, currentPage);
      }
    });

    updatePage();
    // Auto-render captions on initial load (CC is ON by default)
    if (captionsOpen) {
      const s = getStoryById(storyId);
      if (s) renderCaptionsOverlay(s, currentPage);
    }
  }

  // Waterfall autoplay with IntersectionObserver
  if (story.format === 'scroll' && story.pageAudio) {
    const settings = getSettings();
    let currentPlayingPanel = -1;

    // Wire up manual audio buttons
    document.querySelectorAll('[data-audio-panel]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-audio-panel') || '0');
        if (isSpeaking() && currentPlayingPanel === idx) {
          stopSpeaking();
          currentPlayingPanel = -1;
          (btn as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        } else {
          stopSpeaking();
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

    // Autoplay on scroll into view
    if (settings.autoPlay) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt((entry.target as HTMLElement).getAttribute('data-panel-index') || '-1');
            if (idx >= 0 && idx !== currentPlayingPanel && story.pageAudio![idx]) {
              stopSpeaking();
              // Reset all buttons
              document.querySelectorAll('[data-audio-panel]').forEach(b => {
                (b as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
              });
              playAudioUrl(story.pageAudio![idx]);
              currentPlayingPanel = idx;
              const audioBtn = document.querySelector(`[data-audio-panel="${idx}"]`) as HTMLElement;
              if (audioBtn) {
                audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
              }
            }
          }
        });
      }, { threshold: 0.8 }); // 80% visible triggers autoplay

      document.querySelectorAll('[data-panel-index]').forEach(panel => {
        observer.observe(panel);
      });
    }
  }

  // ─── Dynamic End Card for Scroll Format ───
  if (story.format === 'scroll') {
    const scrollEndCard = document.getElementById('scroll-end-card');
    if (scrollEndCard) {
      if (isGateEpisode) {
        scrollEndCard.innerHTML = renderGateInfoPage('scroll', soloEpCount);
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
        document.getElementById('btn-waterfall-sparc-transition')?.addEventListener('click', () => {
          stopBgm();
          stopSpeaking();
          navigate(`sparc/${squadId}/${storyGroupId}/${episodeNumber}`);
        });
      }
    }
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

    // Toggle captions overlay
    const existingOverlay = document.getElementById('reader-captions-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
      if (!captionsOpen) return;
    }

    if (captionsOpen) {
      renderCaptionsOverlay(story, currentPage);
    }
  });

  function wrapWordsInSpans(text: string, lineIdx: number): string {
    return text.split(/\s+/).map((word, i) => 
      `<span class="cc-word" data-line-idx="${lineIdx}" data-word-idx="${i}">${word}</span>`
    ).join(' ');
  }

  function renderCaptionsOverlay(story: any, pageIdx: number) {
    const existing = document.getElementById('reader-captions-overlay');
    if (existing) existing.remove();
    if (!captionsOpen) return;

    const dialogueLines = story.pageDialogue?.[pageIdx] || [];
    const scriptText = story.pageScripts?.[pageIdx] || '';

    let content = '';
    if (dialogueLines.length > 0) {
      content = dialogueLines.map((line: any, idx: number) => {
        const isNarrator = line.characterId === 'narrator';
        const name = isNarrator ? 'Narrator' : (line.characterName || 'Speaker');
        const nameColor = isNarrator ? '#a78bfa' : '#60a5fa';
        return `
          <div style="margin-bottom:8px;">
            <span style="font-size:0.7rem; font-weight:700; color:${nameColor}; text-transform:uppercase; letter-spacing:0.5px;">${name}</span>
            <div class="cc-caption-text" style="font-size:0.88rem; color:#e2e8f0; line-height:1.55; margin-top:2px;">${wrapWordsInSpans(line.text, idx)}</div>
          </div>
        `;
      }).join('');
    } else if (scriptText) {
      content = `<div class="cc-caption-text" style="font-size:0.88rem; color:#e2e8f0; line-height:1.55;">${wrapWordsInSpans(scriptText, 0)}</div>`;
    }

    if (!content) return;

    const overlay = document.createElement('div');
    overlay.id = 'reader-captions-overlay';
    overlay.style.cssText = 'padding: 12px 20px 16px; max-width: 600px; margin: 0 auto;';
    overlay.innerHTML = content;

    // Insert below the page image inside .reader__book-content
    const bookContent = document.querySelector('.reader__book-content');
    const pageNav = document.querySelector('.reader__page-nav');
    if (bookContent && pageNav) {
      bookContent.insertBefore(overlay, pageNav);
    } else if (bookContent) {
      bookContent.appendChild(overlay);
    } else {
      // Fallback: append to reader content
      const readerContent = document.getElementById('reader-content');
      if (readerContent) readerContent.appendChild(overlay);
    }

    setWordHighlightCallback((charIndex: number) => {
      const alignment = getCurrentAlignment();
      if (!alignment) return;
      let wordIdx = 0;
      for (let i = 0; i < charIndex; i++) {
        if (alignment.characters[i] === ' ') wordIdx++;
      }
      
      const activeSpans = overlay.querySelectorAll('.cc-word--active');
      activeSpans.forEach(span => span.classList.remove('cc-word--active'));
      const targetSpan = overlay.querySelector(`.cc-word[data-line-idx="${(window as any).__activeCaptionLineIdx || 0}"][data-word-idx="${wordIdx}"]`);
      if (targetSpan) {
        targetSpan.classList.add('cc-word--active');
      }
    });
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
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#fff;font-weight:600;">${(localStorage.getItem('drive_username') || 'Y')[0].toUpperCase()}</div>
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
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#fff;font-weight:600;">${(c.author || 'Y')[0].toUpperCase()}</div>
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
