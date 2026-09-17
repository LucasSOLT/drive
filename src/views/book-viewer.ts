import { getRouteParam, navigate } from '../router.ts';
import { getUserStories } from '../state.ts';
import { getStoryById } from '../data/stories.ts';
import { speakText, stopSpeaking, isSpeaking, playAudioUrl, playAudioSequence, getCurrentAudio, seekAudio, formatTime } from '../lib/tts.ts';
import { getSettings } from '../lib/settings.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import type { DialogueLine } from '../types.ts';

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
  bgmUrl?: string;
  bgm_url?: string;
  bgmVolume?: number;
  bgm_volume?: number;
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
      bgmUrl: official.bgmUrl,
      bgmVolume: official.bgmVolume,
    } as UserStoryWithPages;
  }

  return null;
}

function renderPageImage(page: StoryPage, pageIndex: number): string {
  if (page.image) {
    if (isVideoMedia(page.image)) {
      return `<video class="book-viewer__image book-viewer__video" src="${page.image}" autoplay loop muted playsinline webkit-playsinline style="width:100%;height:100%;object-fit:contain;"></video>`;
    }
    return `<img class="book-viewer__image" src="${page.image}" alt="Page ${pageIndex + 1}">`;
  }
  return `
    <div class="book-viewer__placeholder">
      <span class="book-viewer__placeholder-number">${pageIndex + 1}</span>
    </div>
  `;
}

function renderPageContent(page: StoryPage, pageIndex: number, totalPages: number, speaking: boolean, hasAudio: boolean, textCollapsed: boolean, captionsOpen: boolean = false, dialogueLines: DialogueLine[] = [], manualCaptions: string = ''): string {
  return `
    <div class="book-viewer__image-area" id="bv-image-area">
      ${renderPageImage(page, pageIndex)}
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

    ${hasAudio ? `
      <div class="bv-audio-scrubber" id="bv-scrubber-bar">
        <span class="bv-audio-scrubber__time" id="bv-time-current">0:00</span>
        <input type="range" class="audio-scrubber__slider" id="bv-audio-slider" min="0" max="100" value="0" step="0.1" aria-label="Audio progress">
        <span class="bv-audio-scrubber__time" id="bv-time-duration">--:--</span>
      </div>
    ` : ''}

    ${textCollapsed ? '' : `
      <div class="book-viewer__text-area" id="bv-text">
        <p class="book-viewer__text">${page.text}</p>
        <div class="book-viewer__page-indicator">${pageIndex + 1} / ${totalPages}</div>
      </div>
    `}
    ${captionsOpen ? (() => {
      // Check if dialogue lines or manual captions exist
      if (dialogueLines.length > 0) {
        const captionLines = dialogueLines.map((line: DialogueLine) => {
          const isNarrator = line.characterId === 'narrator';
          const speakerName = isNarrator ? '🎙️ Narrator' : (line.characterName || 'Speaker');
          return `<div class="bv-caption-line">
            <span class="bv-caption-speaker">${speakerName}</span>
            <span class="bv-caption-text">${line.text}</span>
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
        return `<div class="book-viewer__captions-card" id="bv-captions">
          <div class="bv-captions-header">
            <span>Dialogue Captions</span>
            <button class="bv-captions-close" id="bv-cc-close" aria-label="Close captions">✕</button>
          </div>
          <div class="bv-caption-line">
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

  return `
    <div class="book-viewer" id="book-viewer" data-story-id="${story.id}">
      <button class="book-viewer__back" id="bv-back" aria-label="Go back">
        ${ICON.back}
      </button>

      <div class="book-viewer__body" id="bv-body">
        ${renderPageContent(pages[0], 0, pages.length, false, !!(story as any).page_audio?.[0], true, false, [], '')}
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

  // ─── Background Music (BGM) ───
  const bgmUrl = story.bgmUrl || story.bgm_url;
  const bgmVolume = typeof story.bgmVolume === 'number' ? story.bgmVolume : (typeof story.bgm_volume === 'number' ? story.bgm_volume : 0.25);
  let bgmAudio: HTMLAudioElement | null = null;
  if (bgmUrl) {
    bgmAudio = new Audio(bgmUrl);
    bgmAudio.loop = true;
    bgmAudio.volume = bgmVolume;
    const playBgmWithGestureFallback = () => {
      if (bgmAudio && bgmAudio.paused) {
        bgmAudio.play().catch(() => {
          const onUserGesture = () => {
            if (bgmAudio && bgmAudio.paused) bgmAudio.play().catch(() => {});
            document.removeEventListener('click', onUserGesture);
            document.removeEventListener('keydown', onUserGesture);
            document.removeEventListener('touchstart', onUserGesture);
          };
          document.addEventListener('click', onUserGesture, { once: true });
          document.addEventListener('keydown', onUserGesture, { once: true });
          document.addEventListener('touchstart', onUserGesture, { once: true });
        });
      }
    };
    playBgmWithGestureFallback();
  }

  const stopBgm = () => {
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio = null;
    }
  };

  // ─── Back button ───
  document.getElementById('bv-back')?.addEventListener('click', () => {
    stopBgm();
    stopSpeaking();
    navigate('library');
  });

  window.addEventListener('hashchange', stopBgm, { once: true });
  window.addEventListener('popstate', stopBgm, { once: true });

  // Scrubber display updater
  const updateScrubberDisplay = (current: number, duration: number) => {
    const slider = document.getElementById('bv-audio-slider') as HTMLInputElement | null;
    const curEl = document.getElementById('bv-time-current');
    const durEl = document.getElementById('bv-time-duration');
    if (slider && duration > 0) {
      slider.value = ((current / duration) * 100).toFixed(1);
    }
    if (curEl) curEl.textContent = formatTime(current);
    if (durEl && duration > 0) durEl.textContent = formatTime(duration);
  };

  // Handler for when page narration finishes (used by both autoplay & manual play)
  const onAudioFinished = () => {
    speaking = false;
    const audioBtn = document.getElementById('bv-audio-toggle');
    if (audioBtn) audioBtn.classList.remove('book-viewer__circle-btn--speaking');
    const slider = document.getElementById('bv-audio-slider') as HTMLInputElement | null;
    const curEl = document.getElementById('bv-time-current');
    if (slider) slider.value = '0';
    if (curEl) curEl.textContent = '0:00';

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

  // ─── Update page content without full re-render ───
  function updatePage() {
    const body = document.getElementById('bv-body');
    if (!body) return;

    const hasAudio = !!pageAudio[currentPage];
    const dialogueLines = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage] || [];
    const pageScripts = (story as any).pageScripts || (story as any).page_scripts || {};
    const manualCaptions = pageScripts[currentPage] || '';
    body.innerHTML = renderPageContent(pages[currentPage], currentPage, totalPages, speaking, hasAudio, textCollapsed, captionsOpen, dialogueLines, manualCaptions);
    wirePageControls();

    const vidEl = body.querySelector('.book-viewer__video') as HTMLVideoElement | null;
    if (vidEl) ensureVideoPlayback(vidEl);

    // Autoplay if setting is on and page has pre-recorded audio
    if (getSettings().autoPlay && hasAudio && !speaking) {
      speaking = true;
      const dialogueLines = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage];
      if (dialogueLines && dialogueLines.length > 0) {
        const audioUrls = dialogueLines.map((l: DialogueLine) => l.audioUrl || null);
        const hasDialogueAudio = audioUrls.some((u: string | null) => !!u);
        if (hasDialogueAudio) {
          playAudioSequence(audioUrls, undefined, onAudioFinished);
        } else {
          playAudioUrl(pageAudio[currentPage], onAudioFinished, updateScrubberDisplay);
        }
      } else {
        playAudioUrl(pageAudio[currentPage], onAudioFinished, updateScrubberDisplay);
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
    // Pre-load audio duration for current page
    const currentAudioUrl = pageAudio[currentPage];
    if (currentAudioUrl) {
      const pre = new Audio(currentAudioUrl);
      pre.addEventListener('loadedmetadata', () => {
        const durEl = document.getElementById('bv-time-duration');
        if (durEl && pre.duration && !isNaN(pre.duration)) {
          durEl.textContent = formatTime(pre.duration);
        }
      });
    }

    // Scrubber range input seeking
    const audioSlider = document.getElementById('bv-audio-slider') as HTMLInputElement | null;
    audioSlider?.addEventListener('input', () => {
      const audio = getCurrentAudio();
      const dur = audio?.duration || 0;
      const target = (parseFloat(audioSlider.value) / 100) * dur;
      seekAudio(target);
      const curEl = document.getElementById('bv-time-current');
      if (curEl) curEl.textContent = formatTime(target);
    });

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
        const audioUrl = pageAudio[currentPage];
        if (audioUrl) {
          speaking = true;
          const dialogueLines = (story as any).page_dialogue?.[currentPage] || (story as any).pageDialogue?.[currentPage];
          if (dialogueLines && dialogueLines.length > 0) {
            const audioUrls = dialogueLines.map((l: DialogueLine) => l.audioUrl || null);
            const hasDialogueAudio = audioUrls.some((u: string | null) => !!u);
            if (hasDialogueAudio) {
              playAudioSequence(audioUrls, undefined, onAudioFinished);
            } else {
              playAudioUrl(audioUrl, onAudioFinished, updateScrubberDisplay);
            }
          } else {
            playAudioUrl(audioUrl, onAudioFinished, updateScrubberDisplay);
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
