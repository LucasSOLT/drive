import { getRouteParam, navigate } from '../router.ts';
import { getUserStories } from '../state.ts';
import { speakText, stopSpeaking, isSpeaking } from '../lib/tts.ts';

// ─── Types ───
interface StoryPage {
  image: string | null;
  text: string;
}

interface UserStoryWithPages {
  id: string;
  title: string;
  pages?: StoryPage[];
}

// ─── SVG Icons ───
const ICON = {
  back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  prevArrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  nextArrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  speaker: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  speakerActive: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
};

// ─── Helpers ───
function getStory(): UserStoryWithPages | null {
  const storyId = getRouteParam();
  if (!storyId) return null;
  const stories = getUserStories() as UserStoryWithPages[];
  return stories.find(s => s.id === storyId) || null;
}

function renderPageImage(page: StoryPage, pageIndex: number): string {
  if (page.image) {
    return `<img class="book-viewer__image" src="${page.image}" alt="Page ${pageIndex + 1}">`;
  }
  return `
    <div class="book-viewer__placeholder">
      <span class="book-viewer__placeholder-number">${pageIndex + 1}</span>
    </div>
  `;
}

function renderPageContent(page: StoryPage, pageIndex: number, totalPages: number, speaking: boolean): string {
  return `
    <div class="book-viewer__image-area" id="bv-image-area">
      ${renderPageImage(page, pageIndex)}
    </div>

    <nav class="book-viewer__nav" id="bv-nav">
      <span class="book-viewer__nav-label">TEXT</span>
      <div class="book-viewer__nav-controls">
        <button
          class="book-viewer__circle-btn book-viewer__circle-btn--prev"
          id="bv-prev"
          aria-label="Previous page"
          ${pageIndex === 0 ? 'disabled' : ''}
        >
          ${ICON.prevArrow}
        </button>
        <button
          class="book-viewer__circle-btn book-viewer__circle-btn--speaker ${speaking ? 'book-viewer__circle-btn--speaking' : ''}"
          id="bv-speaker"
          aria-label="${speaking ? 'Stop reading' : 'Read aloud'}"
        >
          ${speaking ? ICON.speakerActive : ICON.speaker}
        </button>
        <button
          class="book-viewer__circle-btn book-viewer__circle-btn--next"
          id="bv-next"
          aria-label="Next page"
          ${pageIndex >= totalPages - 1 ? 'disabled' : ''}
        >
          ${ICON.nextArrow}
        </button>
      </div>
    </nav>

    <div class="book-viewer__text-area" id="bv-text">
      <p class="book-viewer__text">${page.text}</p>
      <div class="book-viewer__page-indicator">${pageIndex + 1} / ${totalPages}</div>
    </div>
  `;
}

// ─── Render ───
export function render(): string {
  const story = getStory();

  if (!story) {
    return `<div class="book-viewer book-viewer--error"><p>Story not found.</p></div>`;
  }

  const pages = story.pages || [];
  if (pages.length === 0) {
    return `<div class="book-viewer book-viewer--error"><p>This story has no pages yet.</p></div>`;
  }

  return `
    <div class="book-viewer" id="book-viewer" data-story-id="${story.id}">
      <button class="book-viewer__back" id="bv-back" aria-label="Go back">
        ${ICON.back}
      </button>

      <div class="book-viewer__body" id="bv-body">
        ${renderPageContent(pages[0], 0, pages.length, false)}
      </div>
    </div>
  `;
}

// ─── Init ───
export function init(): void {
  const viewer = document.getElementById('book-viewer');
  if (!viewer) return;

  const story = getStory();
  if (!story || !story.pages || story.pages.length === 0) return;

  const pages = story.pages;
  const totalPages = pages.length;
  let currentPage = 0;
  let speaking = false;

  // ─── Back button ───
  document.getElementById('bv-back')?.addEventListener('click', () => {
    stopSpeaking();
    navigate('library');
  });

  // ─── Update page content without full re-render ───
  function updatePage() {
    const body = document.getElementById('bv-body');
    if (!body) return;

    body.innerHTML = renderPageContent(pages[currentPage], currentPage, totalPages, speaking);
    wirePageControls();
  }

  // ─── Wire up interactive controls on the current page ───
  function wirePageControls() {
    // Prev
    document.getElementById('bv-prev')?.addEventListener('click', () => {
      if (currentPage > 0) {
        stopSpeaking();
        speaking = false;
        currentPage--;
        updatePage();
      }
    });

    // Next
    document.getElementById('bv-next')?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        stopSpeaking();
        speaking = false;
        currentPage++;
        updatePage();
      }
    });

    // Speaker
    document.getElementById('bv-speaker')?.addEventListener('click', () => {
      if (isSpeaking()) {
        stopSpeaking();
        speaking = false;
        updatePage();
      } else {
        const text = pages[currentPage].text;
        if (text) {
          speaking = true;
          updatePage();
          speakText(text).then(() => {
            // When speech ends naturally, reset the speaking state
            if (speaking) {
              speaking = false;
              updatePage();
            }
          });
        }
      }
    });
  }

  // Initial wiring
  wirePageControls();
}
