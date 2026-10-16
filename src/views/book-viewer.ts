import { getRouteParam, navigate } from '../router.ts';
import { getUserStories } from '../state.ts';
import { getStoryById } from '../data/stories.ts';
import { speakText, stopSpeaking, isSpeaking, playAudioUrl, playAudioSequence } from '../lib/tts.ts';
import { getSettings } from '../lib/settings.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import type { DialogueLine } from '../types.ts';
import {
  isNarrationLine,
  narrationColorFor,
  isLineMuted,
  areAllLinesMuted,
  getAudibleDialogueLines,
  buildAudiblePageWordMap,
  getSilentRangeAction,
  PLAIN_TEXT_ID,
} from '../lib/cast-voices.ts';

// ─── Types ───
interface StoryPage {
  image: string | null;
  text: string;
}

interface UserStoryWithPages {
  id: string;
  title: string;
  pages?: StoryPage[];
  page_audio?: Record<number, string>;
  characters?: any[];
  page_dialogue?: Record<number, DialogueLine[]>;
  pageFocalPositions?: Record<number, string>;
  page_focal_positions?: Record<number, string>;
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
  const found = stories.find(s => s.id === storyId);
  if (found) return found;

  const official = getStoryById(storyId);
  if (official) {
    return {
      id: official.id,
      title: official.title,
      pages: official.panels.map((img, i) => ({
        image: img,
        text: official.pageScripts?.[i] || ''
      })),
      page_audio: official.pageAudio,
      characters: official.characters,
      page_dialogue: official.pageDialogue,
      pageFocalPositions: official.pageFocalPositions,
    } as UserStoryWithPages;
  }

  return null;
}

function renderPageImage(page: StoryPage, pageIndex: number, focalPosition?: string): string {
  const objPos = focalPosition && focalPosition !== 'center' ? `object-position:center ${focalPosition};` : '';
  if (page.image) {
    if (isVideoMedia(page.image)) {
      return `<video class="book-viewer__image book-viewer__video" src="${page.image}" autoplay loop playsinline webkit-playsinline style="width:100%;height:100%;object-fit:contain;${objPos}"></video>`;
    }
    return `<img class="book-viewer__image" src="${page.image}" alt="Page ${pageIndex + 1}" style="${objPos}">`;
  }
  return `
    <div class="book-viewer__placeholder">
      <span class="book-viewer__placeholder-number">${pageIndex + 1}</span>
    </div>
  `;
}

function renderPageContent(page: StoryPage, pageIndex: number, totalPages: number, speaking: boolean, hasAudio: boolean, textCollapsed: boolean, captionsOpen: boolean = false, dialogueLines: DialogueLine[] = [], manualCaptions: string = '', focalPosition?: string): string {
  return `
    <div class="book-viewer__image-area" id="bv-image-area">
      ${renderPageImage(page, pageIndex, focalPosition)}
      ${page.text ? `
        <button class="bv-text-toggle" id="bv-text-toggle" aria-label="${textCollapsed ? 'Show' : 'Hide'} text" title="${textCollapsed ? 'Show' : 'Hide'} story text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            ${textCollapsed
              ? '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>'
              : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
          </svg>
        </button>
      ` : ''}
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
        ${hasAudio ? `
          <button
            class="book-viewer__circle-btn book-viewer__circle-btn--speaker ${speaking ? 'book-viewer__circle-btn--speaking' : ''}"
            id="bv-audio-toggle"
            aria-label="${speaking ? 'Pause audio' : 'Play audio'}"
          >
            ${speaking ? ICON.speakerActive : ICON.speaker}
          </button>
        ` : `
          <button
            class="book-viewer__circle-btn book-viewer__circle-btn--speaker ${speaking ? 'book-viewer__circle-btn--speaking' : ''}"
            id="bv-speaker"
            aria-label="${speaking ? 'Stop reading' : 'Read aloud'}"
          >
            ${speaking ? ICON.speakerActive : ICON.speaker}
          </button>
        `}
        <button
          class="book-viewer__circle-btn book-viewer__circle-btn--cc ${captionsOpen ? 'book-viewer__circle-btn--cc-active' : ''}"
          id="bv-cc-toggle"
          aria-label="Toggle captions"
        >
          CC
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

    ${textCollapsed ? '' : (() => {
      const story = getStory();
      const chars = (story as any)?.storyCharacters || (story as any)?.characters || [];
      const pageTextMuted = areAllLinesMuted(dialogueLines, chars, page.text);
      return `
      <div class="book-viewer__text-area${pageTextMuted ? ' book-viewer__text-area--muted' : ''}" id="bv-text"${pageTextMuted ? ' data-muted="true"' : ''}>
        <p class="book-viewer__text${pageTextMuted ? ' book-viewer__text--muted' : ''}">${page.text}</p>
        <div class="book-viewer__page-indicator">${pageIndex + 1} / ${totalPages}</div>
      </div>
      `;
    })()}
    ${captionsOpen ? (() => {
      const story = getStory();
      const chars = (story as any)?.storyCharacters || (story as any)?.characters || [];
      // Check if dialogue lines or manual captions exist
      if (dialogueLines.length > 0) {
        const captionLines = dialogueLines.map((line: DialogueLine) => {
          const isNarrator = isNarrationLine(line);
          const isPlain = line.characterId === PLAIN_TEXT_ID;
          const isMuted = isLineMuted(line, chars);
          const mutedClass = isMuted ? ' bv-caption-line--muted' : '';
          const mutedAttr = isMuted ? ' data-muted="true"' : '';
          const speakerName = isNarrator ? '🎙️ Narrator' : (line.characterName || 'Speaker');
          const matchedChar = isNarrator ? null : chars.find((c: any) => c.id === line.characterId || c.name?.toLowerCase() === line.characterName?.toLowerCase());
          const charColor = isNarrator ? narrationColorFor(line, { characters: chars }) : (matchedChar?.color || '#3b82f6');
          return `<div class="bv-caption-line${mutedClass}"${mutedAttr}>
            ${isPlain ? '' : `<span class="bv-caption-speaker" style="color:var(--color-text-muted);">${speakerName}:</span>`}
            <span class="bv-caption-text" style="color:${charColor};">${line.text}</span>
          </div>`;
        }).join('');
        return `<div class="book-viewer__captions-card" id="bv-captions">
          <div class="bv-captions-header">
            <span>Dialogue Captions</span>
            <button class="bv-captions-close" id="bv-cc-close" aria-label="Close captions">✕</button>
          </div>
          ${captionLines}
        </div>`;
      } else if (manualCaptions) {
        const isMuted = areAllLinesMuted([], chars, manualCaptions);
        const mutedClass = isMuted ? ' bv-caption-line--muted' : '';
        const mutedAttr = isMuted ? ' data-muted="true"' : '';
        return `<div class="book-viewer__captions-card" id="bv-captions">
          <div class="bv-captions-header">
            <span>Dialogue Captions</span>
            <button class="bv-captions-close" id="bv-cc-close" aria-label="Close captions">✕</button>
          </div>
          <div class="bv-caption-line${mutedClass}"${mutedAttr}>
            <span class="bv-caption-text">${manualCaptions}</span>
          </div>
        </div>`;
      }
      return '';
    })() : ''}
  `;
}

// ─── Render ───
export function render(): string {
  const story = getStory();

  if (!story) {
    return `
      <div class="book-viewer book-viewer--error" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100dvh; gap:16px; padding:20px; text-align:center;">
        <button class="book-viewer__back" onclick="window.history.length > 1 ? window.history.back() : window.location.hash='home'" aria-label="Go back" style="position:absolute; top:16px; left:16px;">
          ${ICON.back}
        </button>
        <p style="color:var(--color-text-secondary); font-size:1.05rem;">Story not found.</p>
        <button class="btn btn--secondary" onclick="window.history.length > 1 ? window.history.back() : window.location.hash='home'" style="padding:8px 20px;">← Go Back</button>
      </div>
    `;
  }

  const pages = story.pages || [];
  if (pages.length === 0) {
    return `
      <div class="book-viewer book-viewer--error" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100dvh; gap:16px; padding:20px; text-align:center;">
        <button class="book-viewer__back" onclick="window.history.length > 1 ? window.history.back() : window.location.hash='home'" aria-label="Go back" style="position:absolute; top:16px; left:16px;">
          ${ICON.back}
        </button>
        <p style="color:var(--color-text-secondary); font-size:1.05rem;">This story has no pages yet.</p>
        <button class="btn btn--secondary" onclick="window.history.length > 1 ? window.history.back() : window.location.hash='home'" style="padding:8px 20px;">← Go Back</button>
      </div>
    `;
  }

  const chars0 = (story as any).storyCharacters || (story as any).characters || [];
  const lines0: DialogueLine[] = (story as any).page_dialogue?.[0] || (story as any).pageDialogue?.[0] || [];
  const hasAudio0 = !areAllLinesMuted(lines0, chars0, pages[0]?.text) && (
    !!(story as any).page_audio?.[0] ||
    lines0.some((l: DialogueLine) => !!l.audioUrl && !isLineMuted(l, chars0))
  );

  return `
    <div class="book-viewer" id="book-viewer" data-story-id="${story.id}">
      <button class="book-viewer__back" id="bv-back" aria-label="Go back">
        ${ICON.back}
      </button>

      <div class="book-viewer__body" id="bv-body">
        ${renderPageContent(pages[0], 0, pages.length, false, hasAudio0, true, false, lines0, '', ((story as any).pageFocalPositions?.[0] || (story as any).page_focal_positions?.[0]) as string | undefined)}
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
  let textCollapsed = true;
  let captionsOpen = false;
  const pageAudio = story.page_audio || {};

  // ─── Back button ───
  document.getElementById('bv-back')?.addEventListener('click', () => {
    stopSpeaking();
    navigate('library');
  });

  // Handler for when page narration finishes (used by both autoplay & manual play)
  const onAudioFinished = () => {
    speaking = false;
    const audioBtn = document.getElementById('bv-audio-toggle');
    if (audioBtn) audioBtn.classList.remove('book-viewer__circle-btn--speaking');
    // If hands-free auto-advance is enabled in settings, auto-turn to next page
    if (getSettings().autoAdvance && currentPage < totalPages - 1) {
      setTimeout(() => {
        if (currentPage < totalPages - 1) {
          currentPage++;
          updatePage();
        }
      }, 650);
    }
  };

  function playPageCombinedAudio(url: string, dialogueLines: DialogueLine[], scriptText: string, chars: any[]) {
    const { wordMap, silentRanges } = buildAudiblePageWordMap(dialogueLines, scriptText, chars);
    let audioEl: HTMLAudioElement | null = null;
    const handleSilentSkip = (cur: number, dur: number) => {
      if (!audioEl || !silentRanges.length) return;
      const action = getSilentRangeAction(cur, silentRanges, wordMap, dur);
      if (!action) return;
      if (action.type === 'finish') {
        stopSpeaking();
        onAudioFinished();
      } else if (typeof action.seekTo === 'number') {
        try {
          audioEl.currentTime = action.seekTo;
        } catch {}
      }
    };
    audioEl = playAudioUrl(url, onAudioFinished, handleSilentSkip);
    handleSilentSkip(0, audioEl.duration || 0);
  }

  // ─── Update page content without full re-render ───
  function updatePage() {
    const body = document.getElementById('bv-body');
    if (!body) return;

    const chars = (story as any).storyCharacters || (story as any).characters || [];
    const dialogueLines = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage] || [];
    const pageScripts = (story as any).pageScripts || (story as any).page_scripts || {};
    const manualCaptions = pageScripts[currentPage] || '';
    const pageAllMuted = areAllLinesMuted(dialogueLines, chars, pages[currentPage]?.text || manualCaptions);
    const hasAudibleDialogueAudio = dialogueLines.some((l: DialogueLine) => !!l.audioUrl && !isLineMuted(l, chars));
    const hasAudio = !pageAllMuted && (!!pageAudio[currentPage] || hasAudibleDialogueAudio);
    const focalPos = ((story as any).pageFocalPositions?.[currentPage] || (story as any).page_focal_positions?.[currentPage]) as string | undefined;
    body.innerHTML = renderPageContent(pages[currentPage], currentPage, totalPages, speaking, hasAudio, textCollapsed, captionsOpen, dialogueLines, manualCaptions, focalPos);
    wirePageControls();

    const vidEl = body.querySelector('.book-viewer__video') as HTMLVideoElement | null;
    if (vidEl) ensureVideoPlayback(vidEl);

    // Autoplay if setting is on and page has pre-recorded audio
    if (getSettings().autoPlay && hasAudio && !speaking) {
      speaking = true;
      const fallbackText = pages[currentPage]?.text || manualCaptions;
      if (dialogueLines && dialogueLines.length > 0) {
        const audioUrls = dialogueLines.map((l: DialogueLine) => isLineMuted(l, chars) ? null : (l.audioUrl || null));
        const hasDialogueAudio = audioUrls.some((u: string | null) => !!u);
        if (hasDialogueAudio) {
          playAudioSequence(audioUrls, undefined, onAudioFinished);
        } else if (pageAudio[currentPage]) {
          playPageCombinedAudio(pageAudio[currentPage], dialogueLines, fallbackText, chars);
        }
      } else if (pageAudio[currentPage]) {
        playPageCombinedAudio(pageAudio[currentPage], dialogueLines, fallbackText, chars);
      }
      // Update UI to show speaking state
      const audioBtn = document.getElementById('bv-audio-toggle');
      if (audioBtn) {
        audioBtn.classList.add('book-viewer__circle-btn--speaking');
      }
    }
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

    // Pre-recorded audio toggle
    document.getElementById('bv-audio-toggle')?.addEventListener('click', () => {
      if (isSpeaking()) {
        stopSpeaking();
        speaking = false;
        updatePage();
      } else {
        const chars = (story as any).storyCharacters || (story as any).characters || [];
        const dialogueLines: DialogueLine[] = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage] || [];
        const pageScripts = (story as any).pageScripts || (story as any).page_scripts || {};
        const manualCaptions = pageScripts[currentPage] || '';
        const fallbackText = pages[currentPage]?.text || manualCaptions;
        if (areAllLinesMuted(dialogueLines, chars, fallbackText)) return;

        const audioUrl = pageAudio[currentPage];
        const audioUrls = dialogueLines.map((l: DialogueLine) => isLineMuted(l, chars) ? null : (l.audioUrl || null));
        const hasDialogueAudio = audioUrls.some((u: string | null) => !!u);
        if (audioUrl || hasDialogueAudio) {
          speaking = true;
          if (hasDialogueAudio) {
            playAudioSequence(audioUrls, undefined, onAudioFinished);
          } else if (audioUrl) {
            playPageCombinedAudio(audioUrl, dialogueLines, fallbackText, chars);
          }
          updatePage();
        }
      }
    });

    // Live TTS fallback (no pre-recorded audio)
    document.getElementById('bv-speaker')?.addEventListener('click', () => {
      if (isSpeaking()) {
        stopSpeaking();
        speaking = false;
        updatePage();
      } else {
        const chars = (story as any).storyCharacters || (story as any).characters || [];
        const dialogueLines: DialogueLine[] = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage] || [];
        const pageAllMuted = areAllLinesMuted(dialogueLines, chars, pages[currentPage]?.text);
        if (pageAllMuted) return;
        const text = dialogueLines.length > 0
          ? getAudibleDialogueLines(dialogueLines, chars).map(l => l.text).join(' ')
          : pages[currentPage].text;
        if (text && text.trim()) {
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

    // Text collapse toggle
    document.getElementById('bv-text-toggle')?.addEventListener('click', () => {
      textCollapsed = !textCollapsed;
      updatePage();
    });

    // Captions (CC) toggle
    document.getElementById('bv-cc-toggle')?.addEventListener('click', () => {
      const dialogueLines = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage] || [];
      const pageScripts = (story as any).pageScripts || (story as any).page_scripts || {};
      const manualCaptions = pageScripts[currentPage] || '';
      const hasAnyCaptions = dialogueLines.length > 0 || !!manualCaptions;

      if (!hasAnyCaptions) {
        // Show toast: captions unavailable
        const existing = document.getElementById('bv-cc-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'bv-cc-toast';
        toast.className = 'book-viewer__cc-toast show';
        toast.textContent = 'Captions are unavailable for this story';
        document.getElementById('book-viewer')?.appendChild(toast);
        setTimeout(() => toast.classList.remove('show'), 2500);
        setTimeout(() => toast.remove(), 3000);
        return;
      }

      captionsOpen = !captionsOpen;
      updatePage();
    });

    // Captions close button
    document.getElementById('bv-cc-close')?.addEventListener('click', () => {
      captionsOpen = false;
      updatePage();
    });
  }

  // Initial wiring
  wirePageControls();

  const initialVid = viewer.querySelector('.book-viewer__video') as HTMLVideoElement | null;
  if (initialVid) ensureVideoPlayback(initialVid);
}
