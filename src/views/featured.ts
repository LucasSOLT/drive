import { getEditorPicks, stories } from '../data/stories.ts';
import { renderStoryCard, initVideoCovers } from '../components/story-card.ts';
import { navigate } from '../router.ts';
import { fetchFeaturedStories, fetchUnifiedExploreStories } from '../lib/db.ts';

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
        <div class="editor-pick-hero" style="position: relative; padding: 0 var(--space-md);" id="featured-hero">
          ${topPick ? renderStoryCard(topPick, 'hero') : ''}
        </div>
      </section>

      <section class="section slide-up stagger-2">
        <div class="section__header">
          <h2 class="section__title">Staff Picks</h2>
        </div>
        <div class="story-grid" id="featured-staff-picks">
          ${otherPicks.map(story => renderStoryCard(story, 'full')).join('')}
        </div>
      </section>

      <section class="section slide-up stagger-3">
        <div class="section__header">
          <h2 class="section__title">Rising Stars</h2>
          <p class="text-muted" style="font-size: 0.8rem; margin: 0;">Emerging creators</p>
        </div>
        <div class="scroll-row no-scrollbar" id="featured-rising-stars">
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

  // Fetch live stories and update sections
  (async () => {
    try {
      const [featuredStories, allStories] = await Promise.all([
        fetchFeaturedStories(),
        fetchUnifiedExploreStories()
      ]);

      const staticEditorPicks = getEditorPicks();
      const liveEditorPicks = featuredStories.filter(s => s.isEditorPick);
      const combinedEditorPicks = [...new Map([...liveEditorPicks, ...staticEditorPicks].map(s => [s.id, s])).values()];
      
      const topPick = combinedEditorPicks[0];
      const otherPicks = combinedEditorPicks.slice(1);

      const staticRising = stories.filter(s => !s.isFeatured && !s.isEditorPick);
      const liveRising = allStories.filter(s => !s.isFeatured && !s.isEditorPick);
      const risingStars = [...new Map([...liveRising, ...staticRising].map(s => [s.id, s])).values()].slice(0, 10);

      const heroContainer = document.getElementById('featured-hero');
      if (heroContainer && topPick) {
        heroContainer.innerHTML = renderStoryCard(topPick, 'hero');
        initVideoCovers(heroContainer);
      }

      const staffContainer = document.getElementById('featured-staff-picks');
      if (staffContainer && otherPicks.length > 0) {
        staffContainer.innerHTML = otherPicks.map(story => renderStoryCard(story, 'full')).join('');
        initVideoCovers(staffContainer);
      }

      const risingContainer = document.getElementById('featured-rising-stars');
      if (risingContainer && risingStars.length > 0) {
        risingContainer.innerHTML = risingStars.map(story => renderStoryCard(story, 'full')).join('');
        initVideoCovers(risingContainer);
      }
    } catch (err) {
      console.error('Failed to fetch live featured stories:', err);
    }
  })();

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

