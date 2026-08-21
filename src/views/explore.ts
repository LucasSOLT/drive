import type { Story, UserStory } from '../types.ts';
import { stories as staticStories, genres } from '../data/stories.ts';
import { renderStoryCard, initVideoCovers } from '../components/story-card.ts';
import { navigate } from '../router.ts';
import { fetchPublishedExploreStories } from '../lib/db.ts';

function mapUserStoryToStory(us: UserStory): Story {
  return {
    id: us.id,
    title: us.title,
    author: us.author_name || 'DRiVE Author',
    genre: us.genre,
    format: us.format,
    synopsis: us.synopsis || '',
    coverImage: us.pages?.[0]?.image || us.live_pages?.[0]?.image || '',
    readCount: us.readCount || 0,
    isFeatured: us.isFeatured || false,
    isEditorPick: us.isEditorsPick || false,
    panels: (us.live_pages || us.pages || []).map(p => p.image).filter(Boolean) as string[],
  };
}

function renderGrid(filteredStories: Story[]): string {
  if (filteredStories.length === 0) {
    return `<div class="empty-state text-center text-muted fade-in" style="padding: 2rem; grid-column: 1 / -1;">No stories found.</div>`;
  }
  return filteredStories.map(story => renderStoryCard(story, 'full')).join('');
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

      <div class="genre-section slide-up stagger-2" style="padding: 0.75rem 0 1rem 0;">
        <div class="genre-pills scroll-row no-scrollbar" id="explore-genres" style="padding: 0 1rem;">
          <button class="genre-pill active" data-genre="All">All</button>
          ${genres.map(genre => `<button class="genre-pill" data-genre="${genre}">${genre}</button>`).join('')}
        </div>
      </div>

      <div class="results-section slide-up stagger-3">
        <div class="story-grid" id="explore-grid" style="padding-bottom: 2rem;">
          ${renderGrid(staticStories)}
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

  if (!container || !searchInput || !genresContainer || !gridContainer) return;

  // Make explore title bigger
  const viewTitle = document.getElementById('view-title');
  if (viewTitle) {
    viewTitle.style.fontSize = '1.5rem';
    viewTitle.style.fontWeight = '700';
    viewTitle.style.letterSpacing = '0.5px';
  }

  // Combine static stories with live published user stories from Supabase
  let allStories: Story[] = [...staticStories];
  try {
    const publishedUserStories = await fetchPublishedExploreStories();
    const mapped = publishedUserStories.map(mapUserStoryToStory);
    allStories = [...mapped, ...staticStories];
  } catch (err) {
    console.error('Failed to fetch published user stories:', err);
  }

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
    
    gridContainer.innerHTML = renderGrid(filtered);
    initVideoCovers(gridContainer);
  };

  updateGrid();

  searchInput.addEventListener('input', (e) => {
    currentSearch = (e.target as HTMLInputElement).value;
    updateGrid();
  });

  genresContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const pill = target.closest('.genre-pill');
    
    if (pill) {
      genresContainer.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      currentGenre = pill.getAttribute('data-genre') || 'All';
      updateGrid();
    }
  });

  gridContainer.addEventListener('click', (e) => {
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
