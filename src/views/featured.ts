import { getEditorPicks, stories } from '../data/stories.ts';
import { renderStoryCard, renderEmptySlot, initVideoCovers } from '../components/story-card.ts';
import { navigate } from '../router.ts';
import { isContentManagementMode, getSlotOverride, initSlotOverrides } from '../state.ts';
import { openTileConfigModal } from '../components/tile-config-modal.ts';
import { fetchFeaturedStories, fetchUnifiedExploreStories } from '../lib/db.ts';
import type { Story } from '../types.ts';

function renderFeaturedHero(topPick: Story | null, allStoriesList: Story[] = []): string {
  const override = getSlotOverride('featured-hero', 0);
  if (override === null) {
    return renderEmptySlot('featured-hero', 0, 'hero');
  }
  if (typeof override === 'string') {
    const story = allStoriesList.find(s => s.id === override) || stories.find(s => s.id === override) || topPick;
    return story ? renderStoryCard(story, 'hero') : renderEmptySlot('featured-hero', 0, 'hero');
  }
  return topPick ? renderStoryCard(topPick, 'hero') : renderEmptySlot('featured-hero', 0, 'hero');
}

function renderStaffPicks(picks: Story[], allStoriesList: Story[] = []): string {
  const count = Math.max(4, picks.length);
  const cards: string[] = [];

  for (let i = 0; i < count; i++) {
    const override = getSlotOverride('featured-staff', i);
    if (override === null) {
      cards.push(renderEmptySlot('featured-staff', i, 'full'));
      continue;
    }
    if (typeof override === 'string') {
      const story = allStoriesList.find(s => s.id === override) || stories.find(s => s.id === override) || picks.find(s => s.id === override);
      if (story && !story.id.startsWith('placeholder-') && !story.id.startsWith('empty-')) {
        cards.push(renderStoryCard(story, 'full'));
      } else {
        cards.push(renderEmptySlot('featured-staff', i, 'full'));
      }
      continue;
    }
    const cur = picks[i];
    if (cur && !cur.id.startsWith('placeholder-') && !cur.id.startsWith('empty-')) {
      cards.push(renderStoryCard(cur, 'full'));
    } else {
      cards.push(renderEmptySlot('featured-staff', i, 'full'));
    }
  }

  return cards.join('');
}

function renderRisingStars(stars: Story[], allStoriesList: Story[] = []): string {
  const count = Math.max(4, stars.length);
  const cards: string[] = [];

  for (let i = 0; i < count; i++) {
    const override = getSlotOverride('featured-rising', i);
    if (override === null) {
      cards.push(renderEmptySlot('featured-rising', i, 'full'));
      continue;
    }
    if (typeof override === 'string') {
      const story = allStoriesList.find(s => s.id === override) || stories.find(s => s.id === override) || stars.find(s => s.id === override);
      if (story && !story.id.startsWith('placeholder-') && !story.id.startsWith('empty-')) {
        cards.push(renderStoryCard(story, 'full'));
      } else {
        cards.push(renderEmptySlot('featured-rising', i, 'full'));
      }
      continue;
    }
    const cur = stars[i];
    if (cur && !cur.id.startsWith('placeholder-') && !cur.id.startsWith('empty-')) {
      cards.push(renderStoryCard(cur, 'full'));
    } else {
      cards.push(renderEmptySlot('featured-rising', i, 'full'));
    }
  }

  return cards.join('');
}

export function render(): string {
  const editorPicks = getEditorPicks();
  const topPick = editorPicks[0] || null;
  const otherPicks = editorPicks.slice(1);
  const risingStars = stories.filter(s => !s.isFeatured && !s.isEditorPick).slice(0, 5);

  return `
    <div class="view-featured fade-in" id="featured-container">
      <section class="section slide-up stagger-1">
        <div class="section__header">
          <h2 class="section__title">Editor's Pick</h2>
        </div>
        <div class="editor-pick-hero" style="position: relative; padding: 0 var(--space-md);" id="featured-hero">
          ${renderFeaturedHero(topPick, stories)}
        </div>
      </section>

      <section class="section slide-up stagger-2">
        <div class="section__header">
          <h2 class="section__title">Staff Picks</h2>
        </div>
        <div class="story-grid" id="featured-staff-picks">
          ${renderStaffPicks(otherPicks, stories)}
        </div>
      </section>

      <section class="section slide-up stagger-3">
        <div class="section__header">
          <h2 class="section__title">Rising Stars</h2>
          <p class="text-muted" style="font-size: 0.8rem; margin: 0;">Emerging creators</p>
        </div>
        <div class="scroll-row no-scrollbar" id="featured-rising-stars">
          ${renderRisingStars(risingStars, stories)}
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

  // Fetch live stories and update sections with cloud sync
  (async () => {
    try {
      await initSlotOverrides();

      const [featuredStories, allStories] = await Promise.all([
        fetchFeaturedStories(),
        fetchUnifiedExploreStories()
      ]);

      const staticEditorPicks = getEditorPicks();
      const liveEditorPicks = featuredStories.filter(s => s.isEditorPick);
      const combinedEditorPicks = [...new Map([...liveEditorPicks, ...staticEditorPicks].map(s => [s.id, s])).values()];
      
      const topPick = combinedEditorPicks[0] || null;
      const otherPicks = combinedEditorPicks.slice(1);

      const staticRising = stories.filter(s => !s.isFeatured && !s.isEditorPick);
      const liveRising = allStories.filter(s => !s.isFeatured && !s.isEditorPick);
      const risingStars = [...new Map([...liveRising, ...staticRising].map(s => [s.id, s])).values()].slice(0, 10);
      const allCombined = [...new Map([...featuredStories, ...allStories, ...stories].map(s => [s.id, s])).values()];

      const heroContainer = document.getElementById('featured-hero');
      if (heroContainer) {
        const newHero = renderFeaturedHero(topPick, allCombined);
        if (heroContainer.innerHTML.trim() !== newHero.trim()) {
          heroContainer.innerHTML = newHero;
          initVideoCovers(heroContainer);
        }
      }

      const staffContainer = document.getElementById('featured-staff-picks');
      if (staffContainer) {
        const newStaff = renderStaffPicks(otherPicks, allCombined);
        if (staffContainer.innerHTML.trim() !== newStaff.trim()) {
          staffContainer.innerHTML = newStaff;
          initVideoCovers(staffContainer);
        }
      }

      const risingContainer = document.getElementById('featured-rising-stars');
      if (risingContainer) {
        const newRising = renderRisingStars(risingStars, allCombined);
        if (risingContainer.innerHTML.trim() !== newRising.trim()) {
          risingContainer.innerHTML = newRising;
          initVideoCovers(risingContainer);
        }
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
      if (isContentManagementMode()) {
        e.preventDefault();
        const titleEl = card.querySelector('.story-title');
        
        let slotType = 'featured-rising';
        let gridEl = document.getElementById('featured-rising-stars');
        
        if (card.closest('#featured-hero')) {
          slotType = 'featured-hero';
          gridEl = document.getElementById('featured-hero');
        } else if (card.closest('#featured-staff-picks')) {
          slotType = 'featured-staff';
          gridEl = document.getElementById('featured-staff-picks');
        }

        const cardsInGrid = gridEl ? Array.from(gridEl.querySelectorAll('.story-card')) : [];
        const slotIndex = cardsInGrid.indexOf(card as Element);
        const isPlaceholder = !storyId || storyId.startsWith('placeholder-') || storyId.startsWith('empty-');

        openTileConfigModal({
          storyId: isPlaceholder ? null : storyId,
          slotType,
          slotIndex: slotIndex >= 0 ? slotIndex : 0,
          storyTitle: isPlaceholder ? undefined : (titleEl?.textContent || undefined),
        });
      } else {
        if (storyId && !storyId.startsWith('placeholder-') && !storyId.startsWith('empty-')) {
          navigate('story/' + storyId);
        }
      }
    }
  });
}
