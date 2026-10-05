const fs = require('fs');
const path = 'src/views/home.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace renderFeaturedRows
const regexFeaturedRows = /async function renderFeaturedRows.*?return \s*<!-- Row 1[\s\S]*?;\s*}/;
const newFeaturedRows = \
function renderFeaturedLayout(card1: Story | null, card2: Story | null, card3: Story | null, card4: Story | null): string {
  return \\\
  <!-- Row 1: Big left, Small right -->
  <div class="featured-row" style="display:flex; gap:var(--space-md); padding:0 var(--space-md); margin-bottom:var(--space-md);">
    <div style="flex:3; position:relative;">
      \\\
    </div>
    <div style="flex:2;">
      \\\
    </div>
  </div>
  <!-- Row 2: Small left, Big right (inverted!) -->
  <div class="featured-row" style="display:flex; gap:var(--space-md); padding:0 var(--space-md);">
    <div style="flex:2;">
      \\\
    </div>
    <div style="flex:3; position:relative;">
      \\\
    </div>
  </div>
  \\\;
}

async function renderFeaturedRows(allCards: Story[]): Promise<string> {
  const getStoryForSlot = async (index: number): Promise<Story | null> => {
    const override = getSlotOverride('home-featured', index);
    if (override === null) return null;
    if (typeof override === 'string') {
      let story = allCards.find(s => s.id === override);
      if (!story) {
        try {
          const { fetchStoryByIdFromDb } = await import('../lib/db.ts');
          story = await fetchStoryByIdFromDb(override) || undefined;
          if (story) allCards.push(story);
        } catch (err) {
          console.error('Fallback story fetch failed:', err);
        }
      }
      if (story && !isContentManagementMode()) {
        const isLive = !story.officialStatus || story.officialStatus === 'live' || (story as any).status === 'live';
        if (!isLive) return null;
      }
      return story || null;
    }
    const candidate = allCards[index];
    if (candidate && !isContentManagementMode()) {
      const isLive = !candidate.officialStatus || candidate.officialStatus === 'live' || (candidate as any).status === 'live';
      if (!isLive) return null;
    }
    return candidate || null;
  };

  const [card1, card2, card3, card4] = await Promise.all([
    getStoryForSlot(0),
    getStoryForSlot(1),
    getStoryForSlot(2),
    getStoryForSlot(3)
  ]);
  return renderFeaturedLayout(card1, card2, card3, card4);
}

function renderFeaturedRowsSync(allCards: Story[]): string {
  const getStoryForSlot = (index: number): Story | null => {
    const override = getSlotOverride('home-featured', index);
    if (override === null) return null;
    if (typeof override === 'string') {
      let story = allCards.find(s => s.id === override);
      if (story && !isContentManagementMode()) {
        const isLive = !story.officialStatus || story.officialStatus === 'live' || (story as any).status === 'live';
        if (!isLive) return null;
      }
      return story || null;
    }
    const candidate = allCards[index];
    if (candidate && !isContentManagementMode()) {
      const isLive = !candidate.officialStatus || candidate.officialStatus === 'live' || (candidate as any).status === 'live';
      if (!isLive) return null;
    }
    return candidate || null;
  };

  return renderFeaturedLayout(
    getStoryForSlot(0),
    getStoryForSlot(1),
    getStoryForSlot(2),
    getStoryForSlot(3)
  );
}
\;

code = code.replace(regexFeaturedRows, newFeaturedRows);

// Replace renderBestsellingRow
const regexBestselling = /const count = Math\.max\(allBestselling\.length, isContentManagementMode\(\) \? 5 : allBestselling\.length\);/;
code = code.replace(regexBestselling, "const count = Math.max(allBestselling.length, isContentManagementMode() ? 5 : 4);");

// Import getCachedOfficialStories
code = code.replace("import { fetchFeaturedStories, fetchUnifiedExploreStories } from '../lib/db.ts';",
"import { fetchFeaturedStories, fetchUnifiedExploreStories, getCachedOfficialStories } from '../lib/db.ts';");

// Inside export function render(): string {
const renderStartRegex = /export function render\(\): string \{\s*return \s*<div class="view-home/;
const renderStartReplacement = \export function render(): string {
  const isLiveStory = (s: Story) => {
    if (isContentManagementMode()) return true;
    const status = (s as any).officialStatus || (s as any).status;
    return !status || status === 'live';
  };
  const cachedStories = getCachedOfficialStories() || [];
  const editorPicks = getEditorPicks().filter(isLiveStory);
  const staticFeatured = getFeaturedStories().filter(isLiveStory);
  const allCardsSync = [...new Map([...cachedStories, ...editorPicks, ...staticFeatured].map(s => [s.id, s])).values()].filter(isLiveStory);
  const allBestsellingSync = [...new Map([...cachedStories].map(s => [s.id, s])).values()].filter(isLiveStory).sort((a, b) => b.readCount - a.readCount);

  return \\\
    <div class="view-home\;
code = code.replace(renderStartRegex, renderStartReplacement);

// Replace the Trending Games placeholder
const trendingRegex = /<div id="home-featured-grid">[\s\S]*?<\/div>/;
code = code.replace(trendingRegex, \<div id="home-featured-grid">
          \\\
        </div>\);

// Replace the Top Games placeholder
const bestsellingRegex = /\\\$\\{renderBestsellingRow\\(\\[\\]\\)\\}/;
code = code.replace(bestsellingRegex, \\\);

fs.writeFileSync(path, code);
console.log('done');
