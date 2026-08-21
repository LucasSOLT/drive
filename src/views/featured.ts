import { getEditorPicks, stories } from '../data/stories.ts';
import { renderStoryCard, initVideoCovers } from '../components/story-card.ts';
import { navigate } from '../router.ts';

export function render(): string {
  const editorPicks = getEditorPicks();
  const topPick = editorPicks[0];
  const otherPicks = editorPicks.slice(1);
  const risingStars = stories.filter(s => !s.isFeatured && !s.isEditorPick).slice(0, 5);

  return `
    <div class="view-featured fade-in" id="featured-container">
      <section class="section slide-up stagger-1">
        <div class="section__header">
          <h2 class="section__title">Editor's Pick</h2>
        </div>
        <div class="editor-pick-hero" style="position: relative;">
          ${topPick ? renderStoryCard(topPick, 'hero') : ''}
        </div>
      </section>

      <section class="section slide-up stagger-2">
        <div class="section__header">
          <h2 class="section__title">Staff Picks</h2>
        </div>
        <div class="story-grid">
          ${otherPicks.map(story => renderStoryCard(story, 'full')).join('')}
        </div>
      </section>

      <section class="section slide-up stagger-3">
        <div class="section__header">
          <h2 class="section__title">Rising Stars</h2>
          <p class="text-muted" style="font-size: 0.8rem; margin: 0;">Emerging creators</p>
        </div>
        <div class="scroll-row no-scrollbar">
          ${risingStars.map(story => renderStoryCard(story, 'full')).join('')}
        </div>
      </section>
    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('featured-container');
  if (!container) return;

  // Enable hover-to-play on video covers
  initVideoCovers(container);

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.story-card');
    if (card) {
      const storyId = card.getAttribute('data-story-id');
      if (storyId) {
        navigate('story/' + storyId);
      }
    }
  });
}

