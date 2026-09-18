import type { Story } from '../types.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import { isBookmarked, toggleBookmark } from '../state.ts';

const FORMAT_ICONS: Record<string, string> = {
  'scroll': '📜 Waterfall Storyboard',
  'book': '📖 Book'
};

const BOOKMARK_SVG_OFF = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const BOOKMARK_SVG_ON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

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
  if (story.id.startsWith('placeholder-')) {
    const variantClass = variant === 'hero' ? 'story-card--hero' : variant === 'compact' ? 'story-card--compact' : 'story-card--full';
    const minHeight = variant === 'hero' ? 'min-height:200px;' : '';

    return `
      <div class="story-card ${variantClass} fade-in" style="display:flex; justify-content:center; align-items:center; background:var(--color-surface); border:2px dashed var(--color-border); cursor:pointer; ${minHeight}" onclick="window.location.hash='create'">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </div>
    `;
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
