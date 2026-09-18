import type { Story } from '../types.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import { isBookmarked, toggleBookmark, isContentManagementMode } from '../state.ts';

const FORMAT_ICONS: Record<string, string> = {
  'scroll': '📜 Waterfall Storyboard',
  'book': '📖 Book'
};

const BOOKMARK_SVG_OFF = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const BOOKMARK_SVG_ON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

/**
 * Render a dedicated empty slot tile.
 * In Content Management mode: interactive dashed slot with a '+' to insert stories.
 * In Normal Visitor mode (all devices): a styled 'Empty Slot' placeholder tile.
 */
export function renderEmptySlot(slotType: string, slotIndex: number, variant: 'full' | 'compact' | 'hero' = 'full'): string {
  const inCM = isContentManagementMode();
  const variantClass = variant === 'hero' ? 'story-card--hero' : variant === 'compact' ? 'story-card--compact' : 'story-card--full';
  const minHeight = variant === 'hero' ? 'min-height:220px;' : 'min-height:160px;';

  if (inCM) {
    return `
      <div class="story-card ${variantClass} story-card--cm-empty fade-in" data-story-id="placeholder-${slotIndex}" data-slot-type="${slotType}" data-slot-index="${slotIndex}" style="display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(139,92,246,0.06); border:2px dashed rgba(139,92,246,0.4); cursor:pointer; ${minHeight} border-radius:var(--radius-lg); text-align:center; padding:16px; transition:all 0.2s;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple, #8b5cf6)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span style="font-size:0.75rem; font-weight:700; color:var(--color-purple, #8b5cf6); text-transform:uppercase; letter-spacing:0.5px;">Empty Slot • Insert</span>
      </div>
    `;
  }

  // Normal viewer mode on all devices:
  return `
    <div class="story-card ${variantClass} story-card--empty fade-in" data-story-id="empty-${slotType}-${slotIndex}" style="display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.08); ${minHeight} border-radius:var(--radius-lg); text-align:center; padding:16px; opacity:0.6; pointer-events:none;">
      <span style="font-size:1.8rem; margin-bottom:4px; opacity:0.5;">📖</span>
      <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Empty Slot</span>
    </div>
  `;
}

function renderCover(story: Story, cssClass: string = 'story-card__cover', eager: boolean = false): string {
  // Determine if there is a cover video: explicit coverVideo, or coverImage is video, or panels[0] is video
  const videoSrc = (story.coverVideo && isVideoMedia(story.coverVideo))
    ? story.coverVideo
    : (story.coverImage && isVideoMedia(story.coverImage))
      ? story.coverImage
      : (story.panels && story.panels[0] && isVideoMedia(story.panels[0]))
        ? story.panels[0]
        : null;

  if (videoSrc) {
    const poster = (story.coverImage && !isVideoMedia(story.coverImage)) ? story.coverImage : '';
    const posterAttr = poster ? ` poster="${poster}"` : '';
    return `<video class="${cssClass} story-card__video" src="${videoSrc}"${posterAttr} loop muted playsinline webkit-playsinline preload="${eager ? 'auto' : 'metadata'}"${eager ? ' fetchpriority="high"' : ''} style="width:100%;height:100%;object-fit:cover;"></video>`;
  }

  const imgSrc = (story.coverImage && !isVideoMedia(story.coverImage))
    ? story.coverImage
    : (story.panels && story.panels[0] && !isVideoMedia(story.panels[0]))
      ? story.panels[0]
      : null;

  if (imgSrc) {
    return `<img class="${cssClass}" src="${imgSrc}" alt="${story.title}" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} decoding="async" />`;
  }

  // No cover — show a gradient placeholder
  return `<div class="${cssClass}" style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a2e,#16213e);"></div>`;
}

function renderBookmarkBtn(story: Story): string {
  const saved = isBookmarked(story.id);
  return `<button class="story-card__bookmark-btn ${saved ? 'story-card__bookmark-btn--active' : ''}" data-bookmark-toggle="${story.id}" type="button" title="${saved ? 'Remove bookmark' : 'Bookmark'}" aria-label="Bookmark">${saved ? BOOKMARK_SVG_ON : BOOKMARK_SVG_OFF}</button>`;
}

export function renderStoryCard(story: Story, variant: 'full' | 'compact' | 'hero' = 'full'): string {
  if (story.id.startsWith('placeholder-') || story.id.startsWith('empty-')) {
    return renderEmptySlot('default', 0, variant);
  }

  if (variant === 'hero') {
    return `
      <div class="story-card story-card--hero fade-in" data-story-id="${story.id}">
        ${renderCover(story, 'story-card__cover', true)}
        ${renderBookmarkBtn(story)}
        <div class="story-card__overlay"></div>
        <div class="story-card__info">
          <h2 class="story-title slide-up stagger-1">${story.title}</h2>
          <p class="story-author slide-up stagger-2">by ${story.author}</p>
        </div>
      </div>
    `;
  }
  
  if (variant === 'compact') {
    return `
      <div class="story-card story-card--compact fade-in" data-story-id="${story.id}">
        <div class="story-card__cover-wrapper">
          ${renderCover(story)}
          ${renderBookmarkBtn(story)}
        </div>
        <div class="story-card__info">
          <h3 class="story-title">${story.title}</h3>
          <p class="story-author">by ${story.author}</p>
          <span class="genre-pill active" style="font-size: 0.7rem; padding: 2px 6px; margin-top: 4px; display: inline-block;">${story.genre}</span>
        </div>
      </div>
    `;
  }

  // full variant
  return `
    <div class="story-card story-card--full fade-in" data-story-id="${story.id}">
      ${renderCover(story, 'story-card__cover', true)}
      ${renderBookmarkBtn(story)}
      <div class="story-card__overlay"></div>
      <div class="story-card__info">
        <h3 class="story-title">${story.title}</h3>
        <p class="story-author">by ${story.author}</p>
      </div>
    </div>
  `;
}

/** Wire bookmark toggle clicks within a container and re-render the button on toggle */
export function initBookmarkButtons(container: HTMLElement): void {
  container.querySelectorAll('[data-bookmark-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const storyId = (btn as HTMLElement).getAttribute('data-bookmark-toggle')!;
      const nowBookmarked = toggleBookmark(storyId);
      btn.className = `story-card__bookmark-btn ${nowBookmarked ? 'story-card__bookmark-btn--active' : ''}`;
      (btn as HTMLElement).innerHTML = nowBookmarked ? BOOKMARK_SVG_ON : BOOKMARK_SVG_OFF;
      (btn as HTMLElement).title = nowBookmarked ? 'Remove bookmark' : 'Bookmark';
    });
  });
}

let videoObserver: IntersectionObserver | null = null;

function getVideoObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!videoObserver) {
    videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const videoEl = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          ensureVideoPlayback(videoEl);
        } else {
          videoEl.pause();
        }
      });
    }, { threshold: 0.15 });
  }
  return videoObserver;
}

/** Attach auto-play in view and hover-to-play for all video story cards inside a container */
export function initVideoCovers(container: HTMLElement): void {
  const observer = getVideoObserver();

  container.querySelectorAll('.story-card__video').forEach(video => {
    const videoEl = video as HTMLVideoElement;

    if (observer) {
      observer.observe(videoEl);
    } else {
      ensureVideoPlayback(videoEl);
    }

    const card = videoEl.closest('.story-card');
    if (!card) return;

    card.addEventListener('mouseenter', () => {
      videoEl.currentTime = 0;
      ensureVideoPlayback(videoEl);
    });
    card.addEventListener('mouseleave', () => {
      videoEl.pause();
      videoEl.currentTime = 0;
    });
  });
}
