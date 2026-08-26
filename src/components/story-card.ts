import type { Story } from '../types.ts';

const FORMAT_ICONS: Record<string, string> = {
  'scroll': '📜 Waterfall Storyboard',
  'book': '📖 Book'
};

function renderCover(story: Story, cssClass: string = 'story-card__cover'): string {
  if (story.coverVideo) {
    const posterAttr = story.coverImage ? ` poster="${story.coverImage}"` : '';
    return `<video class="${cssClass} story-card__video" src="${story.coverVideo}"${posterAttr} muted loop playsinline preload="auto" style="width:100%;height:100%;object-fit:cover;"></video>`;
  }
  if (story.coverImage) {
    return `<img class="${cssClass}" src="${story.coverImage}" alt="${story.title}" loading="lazy" />`;
  }
  // No cover — show a gradient placeholder
  return `<div class="${cssClass}" style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a2e,#16213e);"></div>`;
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
        ${renderCover(story)}
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
      ${renderCover(story)}
      <div class="story-card__overlay"></div>
      <div class="story-card__info">
        <h3 class="story-title">${story.title}</h3>
        <p class="story-author">by ${story.author}</p>
      </div>
    </div>
  `;
}

/** Attach hover-to-play for all video story cards inside a container */
export function initVideoCovers(container: HTMLElement): void {
  container.querySelectorAll('.story-card__video').forEach(video => {
    const videoEl = video as HTMLVideoElement;
    const card = videoEl.closest('.story-card');
    if (!card) return;

    card.addEventListener('mouseenter', () => {
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
    });
    card.addEventListener('mouseleave', () => {
      videoEl.pause();
      videoEl.currentTime = 0;
    });
  });
}
