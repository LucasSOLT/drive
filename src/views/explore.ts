import type { Story, UserStory } from '../types.ts';
import { stories as staticStories, genres, registerStories } from '../data/stories.ts';
import { renderStoryCard, renderEmptySlot, initVideoCovers } from '../components/story-card.ts';
import { navigate } from '../router.ts';
import { isContentManagementMode, getSlotOverride, initSlotOverrides } from '../state.ts';
import { openTileConfigModal } from '../components/tile-config-modal.ts';
import { fetchUnifiedExploreStories } from '../lib/db.ts';

/** Exact number of slots to always display on Explore (10 slots = 2 rows of 5 on desktop) */
export const EXPLORE_SLOT_COUNT = 10;

let isExploreExpanded = false;

function renderGrid(filteredStories: Story[], isExpanded: boolean = false): string {
  const count = isExpanded ? Math.max(EXPLORE_SLOT_COUNT, filteredStories.length) : EXPLORE_SLOT_COUNT;
  const cards: string[] = [];

  for (let i = 0; i < count; i++) {
    const override = getSlotOverride('explore-grid', i);
    if (override === null) {
      // Explicitly removed by admin: show empty tile on all devices
      cards.push(renderEmptySlot('explore-grid', i, 'full'));
      continue;
    }
    if (typeof override === 'string') {
      const story = filteredStories.find(s => s.id === override) || staticStories.find(s => s.id === override);
      if (story && !story.id.startsWith('placeholder-') && !story.id.startsWith('empty-')) {
        cards.push(renderStoryCard(story, 'full'));
      } else {
        cards.push(renderEmptySlot('explore-grid', i, 'full'));
      }
      continue;
    }

    const current = filteredStories[i];
    if (current && !current.id.startsWith('placeholder-') && !current.id.startsWith('empty-')) {
      cards.push(renderStoryCard(current, 'full'));
    } else {
      cards.push(renderEmptySlot('explore-grid', i, 'full'));
    }
  }

  return cards.join('');
}

export function render(): string {
  return `
    <div class="view-explore fade-in" id="explore-container">
      <div class="explore-header-block slide-up stagger-1" style="text-align: center; padding: 0.75rem var(--space-md) 0;">
        <p class="explore-tagline" style="font-family: var(--font-body); font-size: 0.88rem; color: var(--color-text-secondary); margin: 0; letter-spacing: 0.3px;">Interactive stories, where you never play alone</p>
      </div>
      <div class="search-section slide-up stagger-1" style="padding-top: 1.5rem;">
        <div class="search-bar">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="search-input" id="explore-search" placeholder="Search stories...">
        </div>
      </div>

      <div class="genre-section slide-up stagger-2" style="margin: 0 var(--space-md); overflow: hidden; padding: 0.75rem 0 1rem 0;">
        <div class="genre-pills scroll-row no-scrollbar" id="explore-genres" style="padding: 0 0 4px 0; margin: 0; gap: var(--space-sm); scroll-padding: 0 4px;">
          <button class="genre-pill active" data-genre="All">All</button>
          ${genres.map(genre => `<button class="genre-pill" data-genre="${genre}">${genre}</button>`).join('')}
        </div>
      </div>

      <div class="results-section slide-up stagger-3">
        <div class="story-grid" id="explore-grid" style="padding-bottom: 1.5rem;">
          ${renderGrid(staticStories, isExploreExpanded)}
        </div>
        <div class="explore-see-more-wrap" id="explore-see-more-wrap" style="text-align: center; padding-bottom: 3rem; display: none;">
          <button class="featured-see-all-btn" id="explore-see-more-btn" type="button" aria-expanded="false" style="padding: 8px 24px; font-size: 0.9rem;">
            <span>See more</span> <span class="see-all-caret">▾</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function init(): Promise<void> {
  const container = document.getElementById('explore-container');
  const searchInput = document.getElementById('explore-search') as HTMLInputElement;
  const genresContainer = document.getElementById('explore-genres');
  const gridContainer = document.getElementById('explore-grid');
  const seeMoreWrap = document.getElementById('explore-see-more-wrap');
  const seeMoreBtn = document.getElementById('explore-see-more-btn');

  if (!container || !searchInput || !genresContainer || !gridContainer) return;

  // Make explore title bigger
  const viewTitle = document.getElementById('view-title');
  if (viewTitle) {
    viewTitle.style.fontSize = '1.5rem';
    viewTitle.style.fontWeight = '700';
    viewTitle.style.letterSpacing = '0.5px';
  }

  let allStories: Story[] = [...staticStories];
  let currentSearch = '';
  let currentGenre = 'All';

  const updateGrid = () => {
    let filtered = allStories;
    
    if (currentGenre !== 'All') {
      filtered = filtered.filter(s => s.genre === currentGenre);
    }
    
    if (currentSearch) {
      const lowerSearch = currentSearch.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(lowerSearch) || 
        s.author.toLowerCase().includes(lowerSearch)
      );
    }
    
    const newHtml = renderGrid(filtered, isExploreExpanded);
    // Prevent screen flash / refresh pop-in if HTML is already identical
    if (gridContainer.innerHTML.trim() !== newHtml.trim()) {
      gridContainer.innerHTML = newHtml;
      initVideoCovers(gridContainer);
    }

    if (seeMoreWrap && seeMoreBtn) {
      if (filtered.length > EXPLORE_SLOT_COUNT) {
        seeMoreWrap.style.display = 'block';
        seeMoreBtn.innerHTML = isExploreExpanded
          ? '<span>See less</span> <span class="see-all-caret">▴</span>'
          : '<span>See more</span> <span class="see-all-caret">▾</span>';
        seeMoreBtn.setAttribute('aria-expanded', String(isExploreExpanded));
      } else {
        seeMoreWrap.style.display = 'none';
      }
    }
  };

  if (seeMoreBtn) {
    seeMoreBtn.onclick = (e) => {
      e.preventDefault();
      isExploreExpanded = !isExploreExpanded;
      updateGrid();
    };
  }

  // Wire events immediately so UI is responsive
  searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value.trim();
    updateGrid();
  });

  genresContainer.addEventListener('click', (e) => {
    const pill = (e.target as HTMLElement).closest('.genre-pill');
    if (!pill) return;
    
    genresContainer.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    
    currentGenre = pill.getAttribute('data-genre') || 'All';
    updateGrid();
  });

  gridContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.story-card');
    if (card) {
      const storyId = card.getAttribute('data-story-id');
      if (isContentManagementMode()) {
        e.preventDefault();
        const titleEl = card.querySelector('.story-title');
        const allCards = Array.from(gridContainer.querySelectorAll('.story-card'));
        const slotIndex = allCards.indexOf(card as Element);
        const isPlaceholder = !storyId || storyId.startsWith('placeholder-') || storyId.startsWith('empty-');

        openTileConfigModal({
          storyId: isPlaceholder ? null : storyId,
          slotType: 'explore-grid',
          slotIndex: slotIndex >= 0 ? slotIndex : 0,
          storyTitle: isPlaceholder ? undefined : (titleEl?.textContent || undefined),
        });
      } else {
        if (storyId && !storyId.startsWith('placeholder-') && !storyId.startsWith('empty-')) {
          sessionStorage.setItem('drive_pre_series_route', 'explore');
          navigate('series/' + storyId);
        }
      }
    }
  });

  // Sync slot overrides and fetch live stories in background without layout shifts
  try {
    await initSlotOverrides();
    const unifiedStories = await fetchUnifiedExploreStories();
    if (unifiedStories && unifiedStories.length > 0) {
      registerStories(unifiedStories);
      allStories = [...new Map([...unifiedStories, ...staticStories].map(s => [s.id, s])).values()];
    }
    // Update grid only if there are genuine differences
    updateGrid();
  } catch (err) {
    console.error('Failed to sync explore stories:', err);
    updateGrid();
  }
}
