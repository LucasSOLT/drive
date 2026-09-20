import type { StoryFormat, Genre, Story, StoryCharacter, DialogueLine, StoryAudioMode } from '../types.ts';
import { genres } from '../data/stories.ts';
import { navigate, getCurrentRoute, getRouteParam } from '../router.ts';
import { showModal, hideModal } from '../components/modal.ts';
import { stopSpeaking, isSpeaking, preRecordAudio, playAudioUrl, previewVoice, playAudioSequence, extractAudioFromMediaFile, getCurrentAudio, seekAudio, formatTime } from '../lib/tts.ts';

import { saveOfficialStory, fetchOfficialStories } from '../lib/db.ts';
import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import { uploadMedia } from '../lib/storage.ts';
import { uploadAudioData } from '../lib/storage.ts';
import { VOICE_OPTIONS } from '../lib/settings.ts';

type CreatePhase = 'canvas' | 'details';

let phase: CreatePhase = 'canvas';
let selectedFormat: StoryFormat = 'book';
let storyTitle = '';
let storyGenre: Genre = 'Fantasy';
let storySynopsis = '';
let storyAuthorName = 'DRiVE Studios';
let storyContentRating: 'All Ages' | 'PG-13' | 'Mature' = 'All Ages';
let storyCoverVideo = '';
let storyCustomGenre = '';

// Squad Gate & SPARC Checkpoint State
let soloEpisodeCount: 1 | 2 | 3 = 1;
let sparcPromptText = '';
let sparcPromptMediaUrls: string[] = [];

// Endless Scroll state
interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  locked: boolean;
  fontSize: number;
  color: string;
}

interface ScrollPanel {
  image: string | null;
  notes: string;
  layout: string;
  tiles: (string | null)[];
  textOverlays: TextOverlay[][];
  audioUrl: string | null;
}
let scrollPanels: ScrollPanel[] = [
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
];
// Character Sheet Studio state
interface StudioCharacter {
  name: string;
  image: string | null;
  description: string;
}
let characters: StudioCharacter[] = [
  { name: 'A', image: null, description: '' },
  { name: 'B', image: null, description: '' },
  { name: 'C', image: null, description: '' },
];
let studioOpen = false;
let isGeneratingScript = false;
let scriptText = '';
let scriptPdfName = '';
let activeCharPopup: number | null = null;
let selectedLayout: string = 'single';
let layoutPickerOpen = false;
let panelLayoutOverlay: number | null = null;

// Illustrated Book state
interface BookPage {
  image: string | null;
  text: string;
  stability: number;
  deeperDiveContent: string;
  audioUrl: string | null;
  audioFileName?: string | null;
  dialogText: string;
  dialogAudioUrl: string | null;
  dialogueLines?: DialogueLine[];
  focalPosition?: 'top' | 'center' | 'bottom';
}
const defaultBookPage = (): BookPage => ({ image: null, text: '', stability: 0.5, deeperDiveContent: '', audioUrl: null, audioFileName: null, dialogText: '', dialogAudioUrl: null, dialogueLines: [], focalPosition: 'center' });
let bookPages: BookPage[] = [
  defaultBookPage(), defaultBookPage(), defaultBookPage(),
  defaultBookPage(), defaultBookPage(),
];

// Story Characters for multi-voice dialogue
const CHAR_COLORS = ['#8a63d2','#3b82f6','#ef4444','#22c55e','#f59e0b','#ec4899','#06b6d4','#f97316','#6366f1','#14b8a6'];
let storyCharacters: StoryCharacter[] = [];
let currentPage = 0;
let activeDraftId: string | null = null;
let _coverThumbnail: string | null = null;
let editStoryId: string | null = null;
let episodeStoryGroupId: string | null = null;  // Links this episode to a story group
let episodeNumber: number = 1;                  // Which episode number in the group
let episodeParentTitle: string | null = null;    // Parent story title for context display
let storyAudioMode: StoryAudioMode = 'make_audio';
let storyNarratorVoiceId: string = '21m00Tcm4TlvDq8ikWAM'; // Rachel (default narrator)
let storyBgmUrl: string = '';
let storyBgmVolume: number = 0.25;
let updateView: () => void;
// â”€â”€â”€ SVG Icons â”€â”€â”€
const ICON = {
  scroll: `<svg width="40" height="40" viewBox="0 0 48 48" fill="none"><rect x="12" y="4" width="24" height="40" rx="4" stroke="currentColor" stroke-width="2.5"/><line x1="18" y1="14" x2="30" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="26" x2="26" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="32" x2="30" y2="32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M24 38v4M24 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/></svg>`,
  book: `<svg width="40" height="40" viewBox="0 0 48 48" fill="none"><path d="M6 8c0-2 2-4 6-4h6c4 0 6 2 6 2s2-2 6-2h6c4 0 6 2 6 4v28c0 2-2 4-6 4h-6c-4 0-6 2-6 2s-2-2-6-2h-6c-4 0-6-2-6-4V8z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 6v34" stroke="currentColor" stroke-width="2"/></svg>`,
  chevLeft: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>`,
  upload: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  sparkle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>`,
  add: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  redo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  collapse: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  speaker: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  // Canvas toolbar icons
  backArrow: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  checkSave: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  dots: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`,
};


function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// â”€â”€â”€ Helpers â”€â”€â”€

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }).then(url => compressImage(url as string));
}

async function compressImage(dataUrl: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl.startsWith('data:image/')) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}


// â”€â”€â”€ DRAFT PERSISTENCE â”€â”€â”€
interface DraftEntry {
  id: string;
  phase: CreatePhase;
  selectedFormat: StoryFormat;
  storyTitle: string;
  storyGenre: Genre;
  storySynopsis: string;
  storyAuthorName?: string;
  storyCoverVideo?: string;
  storyContentRating?: 'All Ages' | 'PG-13' | 'Mature';
  scrollPanels: { image: string | null; notes: string }[];
  characters?: StudioCharacter[];
  scriptText?: string;
  studioOpen?: boolean;
  bookPages: BookPage[];
  currentPage: number;
  updatedAt: string;
  coverThumbnail?: string | null;
  editStoryId?: string | null;
  storyCharacters?: StoryCharacter[];
  bgmUrl?: string;
  bgmVolume?: number;
  soloEpisodeCount?: 1 | 2 | 3;
  sparcPromptText?: string;
  sparcPromptMediaUrls?: string[];
}

function getDraft(): DraftEntry | null {
  try {
    const data = localStorage.getItem('drive_admin_create_draft');
    if (!data) return null;
    return JSON.parse(data) as DraftEntry;
  } catch {
    return null;
  }
}

function saveDraft() {
  const entry: DraftEntry = {
    id: activeDraftId || 'draft-' + Date.now(),
    phase,
    selectedFormat,
    storyTitle,
    storyGenre,
    storySynopsis,
    storyAuthorName,
    storyCoverVideo,
    storyContentRating,
    scrollPanels,
    characters,
    scriptText,
    studioOpen,
    bookPages,
    currentPage,
    updatedAt: new Date().toISOString(),
    coverThumbnail: _coverThumbnail,
    editStoryId,
    storyCharacters,
    bgmUrl: storyBgmUrl,
    bgmVolume: storyBgmVolume,
    soloEpisodeCount,
    sparcPromptText,
    sparcPromptMediaUrls,
  };
  try {
    localStorage.setItem('drive_admin_create_draft', JSON.stringify(entry));
  } catch {
    try {
      const sanitized = {
        ...entry,
        coverThumbnail: entry.coverThumbnail && entry.coverThumbnail.length > 500000 ? '' : entry.coverThumbnail,
        bookPages: entry.bookPages.map(p => ({
          ...p,
          image: p.image && p.image.length > 500000 ? (isVideoMedia(p.image) ? '' : p.image) : p.image
        }))
      };
      localStorage.setItem('drive_admin_create_draft', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('Failed to save admin draft to localStorage (quota exceeded)', e);
    }
  }
}

function loadDraft(draft: DraftEntry) {
  activeDraftId = draft.id;
  phase = draft.phase;
  selectedFormat = draft.selectedFormat || 'book';
  storyTitle = draft.storyTitle || '';
  storyGenre = draft.storyGenre || 'Fantasy';
  storySynopsis = draft.storySynopsis || '';
  storyAuthorName = draft.storyAuthorName || 'DRiVE Studios';
  storyCoverVideo = draft.storyCoverVideo || '';
  storyContentRating = draft.storyContentRating || 'All Ages';
  
  scrollPanels = (draft.scrollPanels || Array.from({ length: 5 }, () => ({ image: null, notes: '' }))).map((p: any) => ({
    image: p.image || null,
    notes: p.notes || '',
    layout: p.layout || 'single',
    tiles: p.tiles || [p.image || null],
    textOverlays: p.textOverlays || [[]],
    audioUrl: p.audioUrl || null,
  }));
  characters = draft.characters || [
    { name: 'A', image: null, description: '' },
    { name: 'B', image: null, description: '' },
    { name: 'C', image: null, description: '' },
  ];
  scriptText = draft.scriptText || '';
  studioOpen = draft.studioOpen || false;
  bookPages = draft.bookPages || Array.from({ length: 5 }, () => defaultBookPage());
  // Ensure dialogueLines and focalPosition exist on each page (backward compat)
  bookPages.forEach(p => { if (!p.dialogueLines) p.dialogueLines = []; if (!p.focalPosition) p.focalPosition = 'center'; });
  currentPage = draft.currentPage || 0;
  _coverThumbnail = draft.coverThumbnail || null;
  editStoryId = draft.editStoryId || null;
  storyCharacters = draft.storyCharacters || [];
  storyBgmUrl = draft.bgmUrl || '';
  storyBgmVolume = typeof draft.bgmVolume === 'number' ? draft.bgmVolume : 0.25;
  soloEpisodeCount = draft.soloEpisodeCount || 1;
  sparcPromptText = draft.sparcPromptText || '';
  sparcPromptMediaUrls = draft.sparcPromptMediaUrls || [];
}

function clearDraft() {
  localStorage.removeItem('drive_admin_create_draft');
  activeDraftId = null;
  editStoryId = null;
  soloEpisodeCount = 1;
  sparcPromptText = '';
  sparcPromptMediaUrls = [];
}

function getFormData(): void {
  const ssTitle = (document.getElementById('ss-title') as HTMLInputElement)?.value;
  const page0Title = (document.getElementById('page0-title') as HTMLInputElement)?.value;
  storyTitle = ssTitle || page0Title || storyTitle || '';
  storyAuthorName = (document.getElementById('ss-author') as HTMLInputElement)?.value || storyAuthorName || 'DRiVE Studios';
  storyGenre = (((document.getElementById('ss-genre') as HTMLSelectElement)?.value || storyGenre || 'Fantasy')) as Genre;
  storySynopsis = (document.getElementById('ss-synopsis') as HTMLTextAreaElement)?.value || storySynopsis || '';
  storyContentRating = (((document.getElementById('ss-rating') as HTMLSelectElement)?.value || storyContentRating || 'All Ages')) as any;
}

function buildStory(status: 'draft' | 'live'): Story {
  getFormData();
  const pages = selectedFormat === 'book'
    ? bookPages.map(p => ({ image: p.image, text: p.text, stability: p.stability, deeperDiveContent: p.deeperDiveContent, dialogText: p.dialogText }))
    : scrollPanels.map(p => ({ image: p.image, text: p.notes }));
  const storyId = editStoryId || crypto.randomUUID();

  const allMedia = selectedFormat === 'book' ? pages.map(p => p.image || '') : scrollPanels.map(p => p.image || '');
  const pageVideos: Record<number, string> = {};
  allMedia.forEach((media, i) => {
    if (isVideoMedia(media)) {
      pageVideos[i] = media;
    }
  });

  const page0 = allMedia[0] || '';
  const coverVideo = storyCoverVideo
    || (isVideoMedia(_coverThumbnail) ? _coverThumbnail || '' : undefined)
    || (isVideoMedia(page0) ? page0 : undefined);

  const coverImage = (!isVideoMedia(_coverThumbnail) && _coverThumbnail)
    || (!isVideoMedia(page0) && page0)
    || '';

  // Build pageAudio from bookPages (pre-recorded audio per page)
  const pageAudio: Record<number, string> = {};
  if (selectedFormat === 'book') {
    bookPages.forEach((bp, i) => {
      if (bp.audioUrl) pageAudio[i] = bp.audioUrl;
    });
  }

  // Build pageDialogue from bookPages dialogueLines
  const pageDialogue: Record<number, DialogueLine[]> = {};
  if (selectedFormat === 'book') {
    bookPages.forEach((bp, i) => {
      if (bp.dialogueLines && bp.dialogueLines.length > 0) {
        pageDialogue[i] = bp.dialogueLines;
      }
    });
  }

  // Build pageFocalPositions from bookPages
  const pageFocalPositions: Record<number, string> = {};
  if (selectedFormat === 'book') {
    bookPages.forEach((bp, i) => {
      if (bp.focalPosition && bp.focalPosition !== 'center') pageFocalPositions[i] = bp.focalPosition;
    });
  }

  return {
    id: storyId,
    title: storyTitle,
    author: storyAuthorName,
    genre: storyGenre,
    format: selectedFormat as StoryFormat,
    synopsis: storySynopsis,
    coverImage,
    coverVideo,
    readCount: 0,
    isFeatured: false,
    isEditorPick: false,
    panels: allMedia,
    pageVideos,
    pageScripts: selectedFormat === 'book' ? Object.fromEntries(pages.map((p, i) => [i, p.text])) : Object.fromEntries(scrollPanels.map((p, i) => [i, p.notes])),
    pageAudio,
    contentRating: storyContentRating,
    isOfficial: true,
    officialStatus: status,
    storyGroupId: episodeStoryGroupId || storyId,
    episodeNumber: episodeNumber,
    characters: storyCharacters.length > 0 ? storyCharacters : undefined,
    pageDialogue: Object.keys(pageDialogue).length > 0 ? pageDialogue : undefined,
    audioMode: storyAudioMode,
    narratorVoiceId: storyNarratorVoiceId,
    bgmUrl: storyBgmUrl || undefined,
    bgmVolume: storyBgmVolume,
    pageFocalPositions: Object.keys(pageFocalPositions).length > 0 ? pageFocalPositions : undefined,
    soloEpisodeCount,
    sparcPrompt: (sparcPromptText.trim() || sparcPromptMediaUrls.length > 0) ? {
      text: sparcPromptText.trim(),
      mediaUrls: sparcPromptMediaUrls.length > 0 ? sparcPromptMediaUrls : undefined,
    } : undefined,
  };
}

function openStorySettings(options?: { preserveScroll?: boolean }): void {
  const wizard = document.getElementById('admin-admin-create-wizard');
  if (!wizard) return;

  if (!options?.preserveScroll) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('app-content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  const formatLabels: Record<string, string> = {
    'scroll': 'Waterfall Storyboard',
    'book': 'Illustrated Book',
  };
  const formatLabel = formatLabels[selectedFormat || 'scroll'] || selectedFormat || 'Unknown';

  const allGenres = ['Fantasy','Sci-Fi','Romance','Horror','Comedy','Drama','Mystery','Slice of Life','Action','Adventure','Thriller','Historical','Superhero','Sports','Psychological','Supernatural','Mecha','Musical','Custom'];
  
  wizard.innerHTML = `
    <div class="story-settings-fs">
      <div class="story-settings-fs__header">
        <button class="story-settings-fs__back" id="ss-back" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <h2 class="story-settings-fs__title">Story Settings</h2>
        <div style="width:36px;"></div>
      </div>

      <div class="story-settings-fs__body">
        <div class="ss-section">
          <div class="ss-section__label">Thumbnail Image/Video</div>
          <div class="ss-field">
            <div id="modal-cover-thumb-zone" style="width: 100%; height: 180px; border-radius: 16px; border: 2px dashed var(--color-border); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; background: var(--color-surface);">
              <div id="modal-cover-thumb-placeholder" style="text-align: center; color: var(--color-text-muted); ${(_coverThumbnail || storyCoverVideo) ? 'display: none;' : ''}">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style="font-size: 0.75rem; margin-top: 6px;">Tap to upload thumbnail image or video</p>
              </div>
              <img id="modal-cover-thumb-preview" style="width: 100%; height: 100%; object-fit: cover; ${(_coverThumbnail && !isVideoMedia(_coverThumbnail, storyCoverVideo)) ? 'display: block;' : 'display: none;'}" ${_coverThumbnail ? `src="${_coverThumbnail}"` : ''} />
              <video id="modal-cover-video-preview" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; ${(storyCoverVideo || isVideoMedia(_coverThumbnail, storyCoverVideo)) ? 'display: block;' : 'display: none;'}" ${(storyCoverVideo || _coverThumbnail) ? `src="${storyCoverVideo || _coverThumbnail}"` : ''}></video>
            </div>
            <input type="file" id="modal-cover-thumb-input" accept="image/*,video/*" style="display: none;" />
          </div>
        </div>

        <div class="ss-section">
          <div class="ss-section__label">Story Information</div>
          <div class="ss-field">
            <label class="ss-field__label" for="ss-title">Title <span class="ss-required">*</span></label>
            <input type="text" id="ss-title" class="ss-field__input" value="${storyTitle}" placeholder="Give your story a name..." maxlength="80" />
          </div>
          <div class="ss-field">
            <label class="ss-field__label" for="ss-author">Author Name</label>
            <input type="text" id="ss-author" class="ss-field__input" value="${storyAuthorName}" placeholder="Your pen name or display name..." maxlength="40" />
          </div>
          <div class="ss-field">
            <label class="ss-field__label" for="ss-synopsis">Synopsis</label>
            <textarea id="ss-synopsis" class="ss-field__textarea" placeholder="Give readers a preview of your story..." rows="3" maxlength="500">${storySynopsis}</textarea>
            <div class="ss-field__hint" style="text-align:right;">${storySynopsis.length}/500</div>
          </div>
        </div>

        <div class="ss-section">
          <div class="ss-section__label">Classification & Media</div>
          <div class="ss-field">
            <label class="ss-field__label" for="ss-genre">Genre</label>
            <select id="ss-genre" class="ss-field__select">
              ${allGenres.map(g => `<option value="${g}" ${storyGenre === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
          <div class="ss-field">
            <label class="ss-field__label" for="ss-rating">Content Rating</label>
            <select id="ss-rating" class="ss-field__select">
              <option value="All Ages" ${storyContentRating === 'All Ages' ? 'selected' : ''}>All Ages</option>
              <option value="PG-13" ${storyContentRating === 'PG-13' ? 'selected' : ''}>PG-13</option>
              <option value="Mature" ${storyContentRating === 'Mature' ? 'selected' : ''}>Mature</option>
            </select>
          </div>
        </div>

        <div class="ss-section" id="ss-squad-gate-section">
          <div class="ss-section__label">🛡️ Squad Gate Configuration</div>
          <div class="ss-field">
            <label class="ss-field__label">Episodes Playable Solo BEFORE Squad Gate Hits</label>
            <div class="ss-gate-selector" id="ss-gate-selector" style="display: flex; gap: 10px; margin-top: 8px;">
              <button type="button" class="btn-gate-option ${soloEpisodeCount === 1 ? 'btn-gate-option--active' : ''}" data-gate-count="1" style="flex: 1; padding: 12px 14px; border-radius: 12px; border: 2px solid ${soloEpisodeCount === 1 ? '#6366f1' : 'var(--color-border)'}; background: ${soloEpisodeCount === 1 ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface)'}; color: var(--color-text); font-weight: 700; cursor: pointer; text-align: center; transition: all 0.2s;">
                1 Episode
              </button>
              <button type="button" class="btn-gate-option ${soloEpisodeCount === 2 ? 'btn-gate-option--active' : ''}" data-gate-count="2" style="flex: 1; padding: 12px 14px; border-radius: 12px; border: 2px solid ${soloEpisodeCount === 2 ? '#6366f1' : 'var(--color-border)'}; background: ${soloEpisodeCount === 2 ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface)'}; color: var(--color-text); font-weight: 700; cursor: pointer; text-align: center; transition: all 0.2s;">
                2 Episodes
              </button>
              <button type="button" class="btn-gate-option ${soloEpisodeCount === 3 ? 'btn-gate-option--active' : ''}" data-gate-count="3" style="flex: 1; padding: 12px 14px; border-radius: 12px; border: 2px solid ${soloEpisodeCount === 3 ? '#6366f1' : 'var(--color-border)'}; background: ${soloEpisodeCount === 3 ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface)'}; color: var(--color-text); font-weight: 700; cursor: pointer; text-align: center; transition: all 0.2s;">
                3 Episodes
              </button>
            </div>
            <div class="ss-field__hint" id="ss-gate-hint" style="font-size: 0.76rem; color: var(--color-text-muted); margin-top: 8px; line-height: 1.45;">
              ℹ️ Players can read Episode${soloEpisodeCount > 1 ? `s 1–${soloEpisodeCount}` : ' 1'} solo for free. Starting at Episode ${soloEpisodeCount + 1}, a squad of 3–5 players is required to unlock and read together.
            </div>
          </div>
        </div>

        <div class="ss-section">
          <div class="ss-section__label">Audio Experience Mode</div>
          <div class="ss-audio-mode-selector" id="ss-audio-mode-selector">
            <button class="ss-audio-mode-btn ${storyAudioMode === 'make_audio' ? 'ss-audio-mode-btn--active' : ''}" data-audio-mode="make_audio" type="button">
              <span class="ss-audio-mode-icon">🎙️</span>
              <span class="ss-audio-mode-title">Make audio as you go</span>
              <span class="ss-audio-mode-desc">Multi-character AI voice dialogue & narration with punctuation expression</span>
            </button>
            <button class="ss-audio-mode-btn ${storyAudioMode === 'simple_upload' ? 'ss-audio-mode-btn--active' : ''}" data-audio-mode="simple_upload" type="button">
              <span class="ss-audio-mode-icon">📁</span>
              <span class="ss-audio-mode-title">Simple audio upload</span>
              <span class="ss-audio-mode-desc">Upload your own audio files per page with optional manual captions</span>
            </button>
          </div>
        </div>

        <div class="ss-section" id="ss-narrator-section" style="${storyAudioMode === 'make_audio' ? '' : 'display:none;'}">
          <div class="ss-section__label">🎙️ Narrator Voice</div>
          <div class="ss-field" style="display:flex; gap:8px; align-items:center;">
            <select id="ss-narrator-voice" class="ss-field__select" style="flex:1;">
              ${VOICE_OPTIONS.map(v =>
                `<option value="${v.voiceId}" ${storyNarratorVoiceId === v.voiceId ? 'selected' : ''}>${v.name} — ${v.description}</option>`
              ).join('')}
            </select>
            <button type="button" id="ss-narrator-audition" class="ss-char-audition-btn" style="white-space:nowrap;">🔊 Audition</button>
          </div>
          <div class="ss-field__hint" style="font-size:0.72rem; color:var(--color-text-muted); margin-top:4px;">Used for dialogue lines assigned to "🎙️ Narrator" in the page editor.</div>
        </div>

        <div class="ss-section" id="ss-characters-section" style="${storyAudioMode === 'make_audio' ? '' : 'display:none;'}">
          <div class="ss-section__label">Characters & Cast Voices</div>
          <div class="ss-characters-card" id="ss-characters-card">
            ${storyCharacters.map((ch, ci) => {
              const voiceOptionsHtml = VOICE_OPTIONS.map(v =>
                `<option value="${v.voiceId}" ${ch.voiceId === v.voiceId ? 'selected' : ''}>${v.name} — ${v.description}</option>`
              ).join('');
              return `
              <div class="ss-char-row" data-char-idx="${ci}">
                <div class="ss-char-badge" style="background:${ch.color || CHAR_COLORS[ci % CHAR_COLORS.length]}">${ch.name.charAt(0)}</div>
                <input class="ss-char-name-input" data-char-name="${ci}" value="${ch.name}" placeholder="Character name" maxlength="30" />
                <select class="ss-char-voice-select" data-char-voice="${ci}">${voiceOptionsHtml}</select>
                <button class="ss-char-audition-btn" data-char-audition="${ci}" type="button">🔊 Audition</button>
                <button class="ss-char-delete-btn" data-char-delete="${ci}" type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>`;
            }).join('')}
            <button class="ss-add-char-btn" id="ss-add-char-btn" type="button">+ Add Character</button>
          </div>
        </div>

        <!-- Background Music (BGM) -->
        <div class="ss-section" id="ss-bgm-section">
          <div class="ss-section__label">🎵 Background Music (BGM)</div>
          <p style="font-size:0.78rem; color:var(--color-text-muted); margin: 0 0 10px 0;">Loops softly across all pages underneath dialogue.</p>
          <div style="display:flex; flex-direction:column; gap:10px; background:var(--color-bg); padding:12px; border-radius:12px; border:1px solid var(--color-border);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span id="ss-bgm-name" style="font-size:0.82rem; font-weight:600; color:var(--color-text-primary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${storyBgmUrl ? '🎵 Music attached' : 'No music uploaded'}
              </span>
              <div style="display:flex; gap:6px;">
                <button id="ss-bgm-upload-btn" class="btn btn--sm btn--secondary" type="button">Upload BGM</button>
                ${storyBgmUrl ? `
                  <button id="ss-bgm-play-btn" class="btn btn--sm btn--ghost" type="button">▶</button>
                  <button id="ss-bgm-remove-btn" class="btn btn--sm btn--ghost" type="button" style="color:#ef4444;">✕</button>
                ` : ''}
              </div>
              <input type="file" id="ss-bgm-file-input" accept="audio/*,video/*" hidden>
            </div>
            ${storyBgmUrl ? `
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.75rem; color:var(--color-text-secondary); width:55px;">Volume:</span>
                <input type="range" id="ss-bgm-vol-slider" min="5" max="60" value="${Math.round(storyBgmVolume * 100)}" style="flex:1;">
                <span id="ss-bgm-vol-val" style="font-size:0.75rem; font-weight:700; color:var(--color-purple); width:32px;">${Math.round(storyBgmVolume * 100)}%</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="ss-actions">
          <button id="ss-save-draft-btn" type="button" class="ss-action-btn ss-action-btn--secondary">Save as Draft</button>
          <button id="ss-go-live-btn" type="button" class="ss-action-btn ss-action-btn--primary">Go Live</button>
        </div>
      </div>
    </div>
  `;

  const modalThumbZone = document.getElementById('modal-cover-thumb-zone');
  const modalThumbInput = document.getElementById('modal-cover-thumb-input') as HTMLInputElement;
  const modalThumbPreview = document.getElementById('modal-cover-thumb-preview') as HTMLImageElement;
  const modalThumbVideoPreview = document.getElementById('modal-cover-video-preview') as HTMLVideoElement;
  const modalThumbPlaceholder = document.getElementById('modal-cover-thumb-placeholder');

  if (modalThumbZone && modalThumbInput) {
    modalThumbZone.addEventListener('click', () => modalThumbInput.click());
    modalThumbInput.addEventListener('change', async () => {
      const file = modalThumbInput.files?.[0];
      if (file) {
        try {
          const isVid = file.type.startsWith('video/');
          const res = await uploadMedia(file, 'covers');
          const mediaUrl = res.url;

          if (isVid) {
            storyCoverVideo = mediaUrl;
            _coverThumbnail = mediaUrl;
            if (modalThumbVideoPreview && modalThumbPreview && modalThumbPlaceholder) {
              modalThumbVideoPreview.src = mediaUrl;
              modalThumbVideoPreview.style.display = 'block';
              modalThumbPreview.style.display = 'none';
              modalThumbPlaceholder.style.display = 'none';
              ensureVideoPlayback(modalThumbVideoPreview);
            }
          } else {
            _coverThumbnail = mediaUrl;
            storyCoverVideo = '';
            if (modalThumbPreview && modalThumbVideoPreview && modalThumbPlaceholder) {
              modalThumbPreview.src = mediaUrl;
              modalThumbPreview.style.display = 'block';
              modalThumbVideoPreview.style.display = 'none';
              modalThumbPlaceholder.style.display = 'none';
            }
          }
          saveDraft();
        } catch (e) {
          console.error('Error uploading cover media', e);
        }
      }
    });
  }



  document.getElementById('ss-back')?.addEventListener('click', () => {
    getFormData();
    updateView();
  });

  // --- Audio Mode Switching ---
  wizard.querySelectorAll('[data-audio-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).getAttribute('data-audio-mode') as StoryAudioMode;
      storyAudioMode = mode;
      // Update active states
      wizard.querySelectorAll('.ss-audio-mode-btn').forEach(b => b.classList.remove('ss-audio-mode-btn--active'));
      (btn as HTMLElement).classList.add('ss-audio-mode-btn--active');
      // Show/hide narrator + characters sections
      const narratorSection = document.getElementById('ss-narrator-section');
      const charsSection = document.getElementById('ss-characters-section');
      if (narratorSection) narratorSection.style.display = mode === 'make_audio' ? '' : 'none';
      if (charsSection) charsSection.style.display = mode === 'make_audio' ? '' : 'none';
      saveDraft();
    });
  });

  // --- Narrator Voice ---
  document.getElementById('ss-narrator-voice')?.addEventListener('change', (e) => {
    storyNarratorVoiceId = (e.target as HTMLSelectElement).value;
    saveDraft();
  });
  document.getElementById('ss-narrator-audition')?.addEventListener('click', async () => {
    const btn = document.getElementById('ss-narrator-audition') as HTMLButtonElement;
    if (!btn) return;
    btn.textContent = '🔊 Playing...';
    btn.disabled = true;
    try {
      await previewVoice(storyNarratorVoiceId, 'The journey begins here. Let me narrate your story.');
    } catch {}
    setTimeout(() => { btn.textContent = '🔊 Audition'; btn.disabled = false; }, 3000);
  });

  // --- Character Cast Management ---
  // Rename
  wizard.querySelectorAll('[data-char-name]').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt((input as HTMLElement).getAttribute('data-char-name') || '0');
      storyCharacters[idx].name = (input as HTMLInputElement).value;
      const badge = (input as HTMLElement).parentElement?.querySelector('.ss-char-badge') as HTMLElement;
      if (badge) badge.textContent = storyCharacters[idx].name.charAt(0) || '?';
      saveDraft();
    });
  });
  // Voice change
  wizard.querySelectorAll('[data-char-voice]').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt((sel as HTMLElement).getAttribute('data-char-voice') || '0');
      storyCharacters[idx].voiceId = (sel as HTMLSelectElement).value;
      saveDraft();
    });
  });
  // Audition
  wizard.querySelectorAll('[data-char-audition]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt((btn as HTMLElement).getAttribute('data-char-audition') || '0');
      const ch = storyCharacters[idx];
      if (!ch) return;
      const b = btn as HTMLButtonElement;
      b.textContent = '🔊 Playing...';
      b.disabled = true;
      try {
        await previewVoice(ch.voiceId, `Hi, I'm ${ch.name}. Ready to bring your story to life.`);
      } catch {}
      setTimeout(() => { b.textContent = '🔊 Audition'; b.disabled = false; }, 3000);
    });
  });
  // Delete
  wizard.querySelectorAll('[data-char-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).getAttribute('data-char-delete') || '0');
      const scrollY = window.scrollY;
      const appContent = document.getElementById('app-content');
      const appScrollY = appContent?.scrollTop || 0;
      storyCharacters.splice(idx, 1);
      getFormData();
      saveDraft();
      openStorySettings({ preserveScroll: true }); // re-render
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
        if (appContent) appContent.scrollTop = appScrollY;
      });
    });
  });
  // Add character
  document.getElementById('ss-add-char-btn')?.addEventListener('click', () => {
    const scrollY = window.scrollY;
    const appContent = document.getElementById('app-content');
    const appScrollY = appContent?.scrollTop || 0;
    const newId = 'char_' + Date.now();
    const defaultVoice = VOICE_OPTIONS[storyCharacters.length % VOICE_OPTIONS.length];
    storyCharacters.push({
      id: newId,
      name: 'Character ' + (storyCharacters.length + 1),
      voiceId: defaultVoice.voiceId,
      color: CHAR_COLORS[storyCharacters.length % CHAR_COLORS.length],
    });
    getFormData(); // sync form fields before re-render
    saveDraft();
    openStorySettings({ preserveScroll: true }); // re-render
    
    // Restore scroll position after re-render
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      if (appContent) appContent.scrollTop = appScrollY;
    });
  });

  // Squad Gate Episodes Before Gate Selector
  wizard.querySelectorAll('[data-gate-count]').forEach(btn => {
    btn.addEventListener('click', () => {
      const count = parseInt((btn as HTMLElement).getAttribute('data-gate-count') || '1', 10) as 1 | 2 | 3;
      soloEpisodeCount = count;
      wizard.querySelectorAll('[data-gate-count]').forEach(b => {
        const c = parseInt((b as HTMLElement).getAttribute('data-gate-count') || '1', 10);
        const isActive = c === count;
        (b as HTMLElement).style.borderColor = isActive ? '#6366f1' : 'var(--color-border)';
        (b as HTMLElement).style.background = isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-surface)';
      });
      const hint = document.getElementById('ss-gate-hint');
      if (hint) {
        hint.innerHTML = `ℹ️ Players can read Episode${soloEpisodeCount > 1 ? `s 1–${soloEpisodeCount}` : ' 1'} solo for free. Starting at Episode ${soloEpisodeCount + 1}, a squad of 3–5 players is required to unlock and read together.`;
      }
      saveDraft();
    });
  });

  // --- Background Music (BGM) Wiring ---
  let bgmAudioPreview: HTMLAudioElement | null = null;
  const stopBgmAudioPreview = () => {
    if (bgmAudioPreview) {
      bgmAudioPreview.pause();
      bgmAudioPreview = null;
    }
    const playBtn = document.getElementById('ss-bgm-play-btn') as HTMLButtonElement | null;
    if (playBtn) playBtn.textContent = '▶';
  };

  const bgmUploadBtn = document.getElementById('ss-bgm-upload-btn') as HTMLButtonElement | null;
  const bgmFileInput = document.getElementById('ss-bgm-file-input') as HTMLInputElement | null;
  const bgmPlayBtn = document.getElementById('ss-bgm-play-btn') as HTMLButtonElement | null;
  const bgmRemoveBtn = document.getElementById('ss-bgm-remove-btn');
  const bgmVolSlider = document.getElementById('ss-bgm-vol-slider') as HTMLInputElement | null;
  const bgmVolVal = document.getElementById('ss-bgm-vol-val');

  bgmUploadBtn?.addEventListener('click', () => bgmFileInput?.click());

  bgmFileInput?.addEventListener('change', async () => {
    const file = bgmFileInput.files?.[0];
    if (!file) return;
    const scrollY = window.scrollY;
    const appContent = document.getElementById('app-content');
    const appScrollY = appContent?.scrollTop || 0;
    if (bgmUploadBtn) {
      bgmUploadBtn.textContent = 'Uploading...';
      bgmUploadBtn.disabled = true;
    }
    try {
      const res = await uploadMedia(file, 'bgm');
      storyBgmUrl = res.url;
      getFormData(); // sync any other form fields before re-render
      saveDraft();
      openStorySettings({ preserveScroll: true });
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
        if (appContent) appContent.scrollTop = appScrollY;
      });
    } catch (err: any) {
      console.error('BGM upload failed:', err);
      alert('BGM upload failed: ' + (err?.message || 'Unknown error'));
      if (bgmUploadBtn) {
        bgmUploadBtn.textContent = 'Upload BGM';
        bgmUploadBtn.disabled = false;
      }
    }
  });

  bgmPlayBtn?.addEventListener('click', () => {
    if (bgmAudioPreview && !bgmAudioPreview.paused) {
      stopBgmAudioPreview();
    } else {
      if (!storyBgmUrl) return;
      stopBgmAudioPreview();
      bgmAudioPreview = new Audio(storyBgmUrl);
      bgmAudioPreview.volume = storyBgmVolume;
      bgmAudioPreview.loop = true;
      bgmAudioPreview.play().catch(() => {});
      if (bgmPlayBtn) bgmPlayBtn.textContent = '⏸';
      bgmAudioPreview.onended = () => {
        if (bgmPlayBtn) bgmPlayBtn.textContent = '▶';
      };
    }
  });

  bgmRemoveBtn?.addEventListener('click', () => {
    const scrollY = window.scrollY;
    const appContent = document.getElementById('app-content');
    const appScrollY = appContent?.scrollTop || 0;
    stopBgmAudioPreview();
    storyBgmUrl = '';
    getFormData();
    saveDraft();
    openStorySettings({ preserveScroll: true });
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      if (appContent) appContent.scrollTop = appScrollY;
    });
  });

  bgmVolSlider?.addEventListener('input', () => {
    const val = parseInt(bgmVolSlider.value) / 100;
    storyBgmVolume = val;
    if (bgmVolVal) bgmVolVal.textContent = `${Math.round(val * 100)}%`;
    if (bgmAudioPreview) bgmAudioPreview.volume = val;
    saveDraft();
  });

  document.getElementById('ss-back')?.addEventListener('click', () => {
    stopBgmAudioPreview();
  });

  // Auto-save on text field changes
  ['ss-title', 'ss-author', 'ss-synopsis'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      getFormData();
      saveDraft();
    });
  });

  document.getElementById('ss-save-draft-btn')?.addEventListener('click', async (e) => {
    stopBgmAudioPreview();
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await saveOfficialStory(buildStory('draft'));
      clearDraft();
      navigate('admin');
    } catch (err) {
      console.error(err);
      alert('Failed to save draft.');
      btn.disabled = false;
      btn.textContent = 'Save as Draft';
    }
  });

  document.getElementById('ss-go-live-btn')?.addEventListener('click', async (e) => {
    stopBgmAudioPreview();
    getFormData();
    if (!storyTitle.trim()) {
      (document.getElementById('ss-title') as HTMLInputElement)?.focus();
      return;
    }
    const pageCount = selectedFormat === 'book' ? bookPages.length : scrollPanels.length;
    if (pageCount < 12 || pageCount > 36) {
      alert(`Episodes must contain between 12 and 36 pages to go live (currently: ${pageCount} pages). Please adjust your pages or save as a draft.`);
      return;
    }
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Publishing...';
    try {
      await saveOfficialStory(buildStory('live'));
      clearDraft();
      navigate('admin');
    } catch (err) {
      console.error(err);
      alert('Failed to publish story.');
      btn.disabled = false;
      btn.textContent = 'Go Live';
    }
  });
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CANVAS RENDERING (from create.ts)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const layoutOptions = [
  { id: 'single', label: 'Single', cells: '<rect x="8" y="4" width="32" height="40" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2-stack', label: '2 Stack', cells: '<rect x="8" y="4" width="32" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="8" y="26" width="32" height="18" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2-side', label: '2 Side', cells: '<rect x="4" y="6" width="18" height="36" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="6" width="18" height="36" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2x2', label: '2\u00d72', cells: '<rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2top-1bot', label: '2T+1B', cells: '<rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="4" y="26" width="40" height="18" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '1top-2bot', label: '1T+2B', cells: '<rect x="4" y="4" width="40" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/>'},
];

function getTileCount(layout: string): number {
  switch (layout) {
    case '2-stack': case '2-side': return 2;
    case '2x2': return 4;
    case '2top-1bot': case '1top-2bot': return 3;
    default: return 1;
  }
}

function renderTileGrid(panelIndex: number, layout: string, tiles: (string | null)[]): string {
  const count = getTileCount(layout);
  
  // Ensure tiles array has enough entries
  while (tiles.length < count) tiles.push(null);

  const renderSingleTile = (tileIdx: number) => {
    const tileImage = tiles[tileIdx];

    if (tileImage) {
      const overlays = (scrollPanels[panelIndex]?.textOverlays?.[tileIdx]) || [];
      const overlayHtml = overlays.map(ov => {
        if (ov.locked) {
          return `
            <div class="text-overlay text-overlay--locked" data-ov-id="${ov.id}" data-ov-panel="${panelIndex}" data-ov-tile="${tileIdx}"
              style="left:${ov.x}%; top:${ov.y}%; font-size:${ov.fontSize}px; color:${ov.color};">
              <span class="text-overlay__content">${ov.text}</span>
              <button class="text-overlay__edit-hint" data-unlock-ov="${ov.id}" data-unlock-panel="${panelIndex}" data-unlock-tile="${tileIdx}" type="button" title="Edit">✏</button>
            </div>`;
        }
        return `
          <div class="text-overlay text-overlay--editing" data-ov-id="${ov.id}" data-ov-panel="${panelIndex}" data-ov-tile="${tileIdx}"
            style="left:${ov.x}%; top:${ov.y}%; font-size:${ov.fontSize}px; color:${ov.color};">
            <div class="text-overlay__handle" data-drag-ov="${ov.id}" data-drag-panel="${panelIndex}" data-drag-tile="${tileIdx}" title="Drag to move">⠿</div>
            <div class="text-overlay__actions">
              <button class="text-overlay__color" data-color-ov="${ov.id}" data-color-panel="${panelIndex}" data-color-tile="${tileIdx}" type="button" title="Change color">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ov.color};border:1.5px solid rgba(255,255,255,0.5);"></span>
              </button>
              <button class="text-overlay__delete" data-del-ov="${ov.id}" data-del-panel="${panelIndex}" data-del-tile="${tileIdx}" type="button" title="Delete">🗑</button>
              <button class="text-overlay__commit" data-commit-ov="${ov.id}" data-commit-panel="${panelIndex}" data-commit-tile="${tileIdx}" type="button" title="Done">✓</button>
            </div>
            <div class="text-overlay__content" contenteditable="true" data-edit-ov="${ov.id}" data-edit-panel="${panelIndex}" data-edit-tile="${tileIdx}">${ov.text}</div>
          </div>`;
      }).join('');

      return `
        <div class="panel-tile panel-tile--filled" data-tile="${tileIdx}" data-panel="${panelIndex}">
          <img src="${tileImage}" alt="Tile ${tileIdx + 1}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" />
          <button class="panel-tile__add-text" data-addtext-tile="${tileIdx}" data-addtext-panel="${panelIndex}" type="button" title="Add text">T</button>
          <button class="panel-tile__remove" data-remove-tile="${tileIdx}" data-remove-panel="${panelIndex}" type="button" title="Remove image">&times;</button>
          ${overlayHtml}
        </div>
      `;
    }
    return `
      <div class="panel-tile" data-tile="${tileIdx}" data-panel="${panelIndex}">
        <div class="panel-tile__placeholder">
          ${ICON.upload}
          <span style="font-size:0.7rem; color:var(--color-text-muted);">Tile ${tileIdx + 1}</span>
        </div>
      </div>
    `;
  };
  
  let gridClass = 'tile-grid';
  switch (layout) {
    case '2-stack': gridClass += ' tile-grid--2stack'; break;
    case '2-side': gridClass += ' tile-grid--2side'; break;
    case '2x2': gridClass += ' tile-grid--2x2'; break;
    case '2top-1bot': gridClass += ' tile-grid--2t1b'; break;
    case '1top-2bot': gridClass += ' tile-grid--1t2b'; break;
    default: gridClass += ' tile-grid--single'; break;
  }
  
  return `<div class="${gridClass}">${Array.from({length: count}, (_, i) => renderSingleTile(i)).join('')}</div>`;
}

// ═══════════════════════════════════════════════════════════
// SPARC Checkpoint Admin Authoring (End of Episode Challenge)
// ═══════════════════════════════════════════════════════════

function renderSparcAdminEditor(): string {
  return `
    <div class="sparc-admin-editor" id="sparc-admin-editor" style="margin-top: 28px; margin-bottom: 24px; background: linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%); border: 2px solid rgba(99, 102, 241, 0.25); border-radius: 18px; padding: 20px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.4rem;">⚡</span>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--color-text);">SPARC Checkpoint Challenge</h3>
            <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-muted);">End of Episode ${episodeNumber} Squad Challenge</p>
          </div>
        </div>
        <span style="font-size: 0.72rem; padding: 4px 10px; border-radius: 12px; background: rgba(99, 102, 241, 0.2); color: #818cf8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
          Social Feed Checkpoint
        </span>
      </div>

      <p style="font-size: 0.82rem; color: var(--color-text-secondary); margin-bottom: 14px; line-height: 1.45;">
        When squad members reach the end of this episode, they will be stopped at this SPARC checkpoint. They must respond to your challenge in the social feed before advancing.
      </p>

      <div style="margin-bottom: 14px;">
        <label style="display: block; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 6px;">
          Challenge / Prompt Text
        </label>
        <textarea id="admin-sparc-text" class="ss-field__textarea" rows="3" placeholder="Enter the SPARC challenge prompt (e.g. Reflect on what you experienced, share a life moment, write a poem...)" style="width: 100%; border-radius: 10px; padding: 12px; font-size: 0.88rem; box-sizing: border-box; line-height: 1.4; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text);">${escapeHtml(sparcPromptText)}</textarea>
      </div>

      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); margin-bottom: 6px;">
          Attached Reference Media (Images, Videos, Links)
        </label>
        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px;" id="admin-sparc-media-list">
          ${sparcPromptMediaUrls.map((url, uIdx) => `
            <div class="sparc-admin-thumb" style="position: relative; width: 84px; height: 84px; border-radius: 10px; overflow: hidden; border: 1px solid var(--color-border); background: #000;">
              ${isVideoMedia(url)
                ? `<video src="${url}" style="width: 100%; height: 100%; object-fit: cover;" autoplay muted loop playsinline></video>`
                : `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" />`
              }
              <button type="button" class="sparc-admin-remove-media" data-remove-media="${uIdx}" title="Remove media" style="position: absolute; top: 3px; right: 3px; background: rgba(0, 0, 0, 0.75); color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">✕</button>
            </div>
          `).join('')}
          <button type="button" id="btn-sparc-upload-media" style="width: 84px; height: 84px; border-radius: 10px; border: 2px dashed var(--color-border); background: var(--color-surface); color: var(--color-text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; font-size: 0.72rem; transition: border-color 0.2s;">
            <span style="font-size: 1.3rem;">📎</span>
            <span>Attach File</span>
          </button>
          <input type="file" id="sparc-media-file-input" accept="image/*,video/*" style="display: none;" />
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="sparc-media-url-input" class="ss-field__input" placeholder="Or paste media URL (https://...) and click Add..." style="flex: 1; font-size: 0.82rem; height: 36px;" />
          <button type="button" id="btn-sparc-add-url" class="btn btn--secondary" style="height: 36px; padding: 0 14px; font-size: 0.8rem; white-space: nowrap;">Add URL</button>
        </div>
      </div>
    </div>
  `;
}

function attachSparcAdminListeners(container: HTMLElement | Document): void {
  const sparcTextEl = container.querySelector('#admin-sparc-text') as HTMLTextAreaElement | null;
  if (sparcTextEl) {
    sparcTextEl.addEventListener('input', () => {
      sparcPromptText = sparcTextEl.value;
      saveDraft();
    });
  }

  const uploadBtn = container.querySelector('#btn-sparc-upload-media') as HTMLElement | null;
  const fileInput = container.querySelector('#sparc-media-file-input') as HTMLInputElement | null;
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) {
        try {
          uploadBtn.innerHTML = '<span style="font-size:0.75rem;">Uploading...</span>';
          const res = await uploadMedia(file, 'covers');
          if (res?.url) {
            sparcPromptMediaUrls.push(res.url);
            saveDraft();
            rerenderSparcEditor();
          }
        } catch (e) {
          console.error('Failed to upload SPARC media:', e);
          alert('Failed to upload media attachment.');
        } finally {
          fileInput.value = '';
        }
      }
    });
  }

  const addUrlBtn = container.querySelector('#btn-sparc-add-url') as HTMLElement | null;
  const urlInput = container.querySelector('#sparc-media-url-input') as HTMLInputElement | null;
  if (addUrlBtn && urlInput) {
    addUrlBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        sparcPromptMediaUrls.push(url);
        urlInput.value = '';
        saveDraft();
        rerenderSparcEditor();
      }
    });
  }

  container.querySelectorAll('.sparc-admin-remove-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt((btn as HTMLElement).getAttribute('data-remove-media') || '-1', 10);
      if (idx >= 0 && idx < sparcPromptMediaUrls.length) {
        sparcPromptMediaUrls.splice(idx, 1);
        saveDraft();
        rerenderSparcEditor();
      }
    });
  });
}

function rerenderSparcEditor(): void {
  const currentEditor = document.getElementById('sparc-admin-editor');
  if (currentEditor && currentEditor.parentElement) {
    const parent = currentEditor.parentElement;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderSparcAdminEditor();
    const newEl = tempDiv.firstElementChild;
    if (newEl) {
      parent.replaceChild(newEl, currentEditor);
      attachSparcAdminListeners(parent);
    }
  }
}

function renderStudioOrbs(): string {
  return `
    <div class="studio-orbs">
      <div class="studio-orb studio-orb--1"></div>
      <div class="studio-orb studio-orb--2"></div>
      <div class="studio-orb studio-orb--3"></div>
      <div class="studio-orb studio-orb--4"></div>
      <div class="studio-orb studio-orb--5"></div>
      <div class="studio-orb studio-orb--6"></div>
      <div class="studio-orb studio-orb--7"></div>
    </div>
  `;
}

function renderCanvasToolbar(formatLabel: string): string {
  const isBook = formatLabel.startsWith('Illustrated Book');
  const pageCount = selectedFormat === 'book' ? bookPages.length : scrollPanels.length;
  const isValidLength = pageCount >= 12 && pageCount <= 36;
  
  return `
    <div class="canvas-toolbar" id="canvas-toolbar">
      <div class="canvas-toolbar__left" style="display:flex; align-items:center; gap:6px;">
        <button class="canvas-toolbar__btn" id="btn-toolbar-quit" title="Quit without saving">
          ${ICON.backArrow}
        </button>
        <button class="canvas-toolbar__btn" id="btn-toolbar-complete" title="Mark episode as completed" style="background:rgba(34,197,94,0.15); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="canvas-toolbar__title">${formatLabel}</span>
        <span class="canvas-toolbar__page-counter" title="${isValidLength ? 'Page count satisfies 12–36 page requirement' : pageCount < 12 ? 'Need at least 12 pages' : 'Maximum 36 pages'}" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:12px; background:${isValidLength ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.18)'}; color:${isValidLength ? '#22c55e' : '#eab308'}; border:1px solid ${isValidLength ? 'rgba(34,197,94,0.35)' : 'rgba(234,179,8,0.35)'};">
          <span>${isValidLength ? '✓' : '⚠️'}</span>
          <span>${pageCount}/12–36</span>
        </span>
      </div>
      <div class="canvas-toolbar__right" style="position:relative; display:flex; align-items:center; gap:8px;">
        ${(isBook && !isDesktopScreen()) ? `
          <button class="canvas-toolbar__btn-storyboard" id="btn-toolbar-switch-storyboard" type="button" title="Switch to Content Storyboard desktop view">
            🖥️ Storyboard View
          </button>
        ` : ''}
        <button class="canvas-toolbar__btn" id="btn-toolbar-menu" title="Menu">
          ${ICON.dots}
        </button>
        <div class="canvas-toolbar__dropdown" id="toolbar-dropdown" style="display:none;">
          <button class="canvas-toolbar__dd-item" id="btn-dd-story-settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Story Settings
          </button>
          ${isBook ? `
            <button class="canvas-toolbar__dd-item" id="btn-dd-add-page">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Page
            </button>
            ${!isDesktopScreen() ? `
              <button class="canvas-toolbar__dd-item" id="btn-dd-storyboard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Storyboard View
              </button>
            ` : ''}
          ` : `
            <button class="canvas-toolbar__dd-item" id="btn-dd-add-panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Panel
            </button>
          `}
        </div>
      </div>
    </div>
    <div class="canvas-toolbar__spacer"></div>
  `;
}

function renderScrollCanvas(): string {
  const filledCount = characters.filter(c => c.image).length;

  return `
    <div class="create-phase create-phase--canvas fade-in">
      ${renderStudioOrbs()}
      ${renderCanvasToolbar('Waterfall Storyboard - Ep.' + episodeNumber)}

      <!-- ─── CHARACTER SHEET STUDIO ─── -->
      <div class="cs-studio">
        <button class="cs-studio-toggle" id="cs-studio-toggle" type="button">
          <div style="display:flex; align-items:center;">
            <span class="cs-studio-title">Character Sheet Studio</span>
            <span class="cs-studio-count">${filledCount}/${characters.length}</span>
          </div>
          <span class="cs-studio-caret ${studioOpen ? 'cs-studio-caret--open' : ''}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </button>
        <div class="cs-studio-body ${studioOpen ? 'cs-studio-body--open' : ''}">
          <div class="cs-carousel-wrap">
            <div class="cs-carousel" id="cs-carousel">
              ${characters.map((char, i) => `
                <div class="cs-char-tile ${char.image ? 'cs-char-tile--filled' : ''}" data-char-idx="${i}">
                  ${char.image
                    ? `<img class="cs-char-tile__img" src="${char.image}" alt="${char.name}" />`
                    : `<div class="cs-char-tile__empty"><span class="cs-char-tile__plus">+</span></div>`
                  }
                  <span class="cs-char-tile__label">${char.name}</span>
                </div>
              `).join('')}
              ${characters.length < 10 ? `
                <div class="cs-char-tile cs-char-tile--add" id="btn-add-character">
                  <div class="cs-char-tile__empty"><span class="cs-char-tile__plus">+</span></div>
                  <span class="cs-char-tile__label">Add</span>
                </div>
              ` : ''}
            </div>
          </div>
          <button class="cs-script-btn" id="btn-open-script" type="button">ðŸ“ Script</button>
        </div>
      </div>

      <!-- â”€â”€â”€ PANELS LIST â”€â”€â”€ -->
      <div class="create-canvas">
        ${scrollPanels.map((panel, i) => {
          return `
            <div class="create-panel-row" data-panel="${i}" data-longpress="${i}" style="flex-direction:column; gap:12px; background:var(--color-surface); padding:16px; border-radius:16px; border:1px solid var(--color-border); margin-bottom:16px; position:relative;">
              
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span class="create-upload-block__badge" style="position:static;">Panel ${i + 1}</span>
                <button class="panel-gear-btn" data-gear-panel="${i}" title="Panel layout" type="button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
              </div>

              <!-- Tile Grid Area -->
              <div class="webtoon-panel-wrap" style="position:relative;">
                ${renderTileGrid(i, panel.layout || 'single', panel.tiles || [panel.image])}
                <input type="file" class="create-upload-block__input" data-file="${i}" accept="image/*" hidden>
                
                ${panel.notes && (panel.tiles?.[0] || panel.image) ? `
                  <div class="speech-bubble-overlay">
                    ${panel.notes}
                  </div>
                ` : ''}
                
                <!-- Panel Layout Overlay -->
                ${panelLayoutOverlay === i ? `
                  <div class="panel-layout-overlay" data-overlay-panel="${i}">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                      <button class="panel-overlay-back" data-close-overlay="${i}" type="button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                      </button>
                      <span style="font-family:var(--font-heading); font-size:0.88rem; font-weight:700; color:var(--color-text-primary);">Panel Layout</span>
                    </div>
                    <div class="panel-overlay-grid">
                      ${layoutOptions.map(opt => `
                        <div class="panel-overlay-option ${(panel.layout || 'single') === opt.id ? 'panel-overlay-option--active' : ''}" data-set-layout="${opt.id}" data-for-panel="${i}" title="${opt.label}">
                          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="none">${opt.cells}</svg>
                          <span style="font-size:0.68rem; font-weight:600; color:var(--color-text-secondary);">${opt.label}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Dialogue / Speech Bubble Notes -->
              <div class="create-annotation" style="margin-top:4px;">
                <label style="font-family:var(--font-heading); font-size:0.78rem; font-weight:600; color:var(--color-text-muted); display:block; margin-bottom:4px;">
                  Dialogue
                </label>
                <div>
                  <textarea class="create-annotation__inline" data-notes="${i}"
                    placeholder="Add dialogue..."
                    rows="2" maxlength="1000" style="width:100%; box-sizing:border-box;">${panel.notes}</textarea>
                </div>
                <div class="prerecord-row" style="margin-top:6px;">
                  <button class="prerecord-btn ${panel.audioUrl ? 'prerecord-btn--done' : 'prerecord-btn--pending'}" data-prerecord-scroll="${i}" type="button">
                    ${panel.audioUrl
                      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Pre-recorded</span>`
                      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> <span>Pre-record</span>`}
                  </button>
                  ${panel.audioUrl ? `
                    <button class="prerecord-play-btn" data-prerecord-play-scroll="${i}" type="button" title="Preview audio">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                  ` : ''}
                </div>
              </div>

            </div>
          `;
        }).join('')}

        <!-- Add panel tile -->
        <div class="create-add-tile" id="btn-add-tile">
          <div class="create-add-tile__inner">
            ${ICON.add}
            <span>Add Panel</span>
          </div>
        </div>

        ${renderSparcAdminEditor()}

        <!-- Bottom Actions -->
        <div class="scroll-bottom-actions">
          <button type="button" class="scroll-bottom-btn scroll-bottom-btn--secondary" id="btn-save-exit">
            Save & Exit
          </button>
          <button type="button" class="scroll-bottom-btn scroll-bottom-btn--primary" id="btn-submit-review">
            Submit for Review
          </button>
        </div>
      </div>
    </div>
  `;
}

/** Render multi-character dialogue lines UI for a page (used in both mobile + storyboard views) */
function renderDialogueLines(pageIdx: number, lines: DialogueLine[], prefix: string): string {
  const charOptions = storyCharacters.map(ch =>
    `<option value="${ch.id}">${ch.name}</option>`
  ).join('') + '<option value="__new__">+ Add New Character...</option>';

  const linesHtml = lines.map((line, li) => {
    const isNarrator = line.characterId === 'narrator';
    const charColor = isNarrator ? '#f59e0b' : (storyCharacters.find(c => c.id === line.characterId)?.color || CHAR_COLORS[li % CHAR_COLORS.length]);
    const hasAudio = !!line.audioUrl;
    return `
    <div class="sb-dialog-line" data-${prefix}-line="${pageIdx}-${li}">
      <div class="sb-dialog-line__top">
        <select class="sb-dialog-line__char-select" data-${prefix}-line-char="${pageIdx}-${li}" style="border-left: 3px solid ${charColor};">
          <option value="narrator" ${isNarrator ? 'selected' : ''}>🎙️ Narrator</option>
          ${storyCharacters.map(ch =>
            `<option value="${ch.id}" ${ch.id === line.characterId ? 'selected' : ''}>${ch.name}</option>`
          ).join('')}
          <option value="__new__">+ Add New...</option>
        </select>
        <div class="sb-dialog-line__actions">
          <button class="sb-dialog-line__btn ${hasAudio ? 'sb-dialog-line__btn--done' : ''}" data-${prefix}-line-rec="${pageIdx}-${li}" type="button">${hasAudio ? '✅ Recorded' : '🎙️ Record'}</button>
          ${hasAudio ? `<button class="sb-dialog-line__btn" data-${prefix}-line-play="${pageIdx}-${li}" type="button">▶</button>` : ''}
          <button class="sb-dialog-line__btn sb-dialog-line__btn--delete" data-${prefix}-line-del="${pageIdx}-${li}" type="button">✕</button>
        </div>
      </div>
      <textarea class="sb-dialog-line__text" data-${prefix}-line-text="${pageIdx}-${li}" rows="2" placeholder="Write dialogue..." maxlength="500">${line.text}</textarea>
    </div>`;
  }).join('');

  const hasAnyAudio = lines.some(l => !!l.audioUrl);

  return `
  <div class="sb-dialog-lines" data-${prefix}-lines="${pageIdx}">
    ${storyCharacters.length === 0 ? `
      <div style="background:rgba(138,99,210,0.08); border:1.5px dashed var(--color-purple); border-radius:10px; padding:12px; margin-bottom:8px; font-size:0.75rem; color:var(--color-text-secondary); text-align:center;">
        <div style="font-weight:700; color:var(--color-purple); font-size:0.85rem; margin-bottom:4px;">🎭 Characters & Cast Voices</div>
        <div>Define named characters and give each their own voice from 26 ElevenLabs options.</div>
        <div style="margin-top:8px;">
          <button data-open-char-settings="true" type="button" style="background:var(--color-purple); color:white; border:none; border-radius:8px; padding:6px 14px; font-size:0.75rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(138,99,210,0.3);">
            Open Cast Voices Manager
          </button>
        </div>
      </div>
    ` : ''}
    ${linesHtml}
    <div style="display:flex; gap:6px; margin-top:4px;">
      <button class="sb-dialog-add-line" data-${prefix}-add-line="${pageIdx}" type="button" style="flex:1;">+ Add Dialogue Line</button>
      <button class="sb-dialog-line__btn" data-open-char-settings="true" type="button" title="Manage character voices in Story Settings" style="white-space:nowrap; padding:6px 10px; font-size:0.72rem; font-weight:700;">🎭 Cast & Voices</button>
    </div>
    ${lines.length > 0 ? `
      <button class="sb-dialog-batch-btn" data-${prefix}-batch-rec="${pageIdx}" type="button">🎙️ Pre-record Page Dialogue</button>
      ${hasAnyAudio ? `<button class="sb-dialog-play-all" data-${prefix}-play-all="${pageIdx}" type="button">▶ Play All Dialogue</button>` : ''}
    ` : ''}
  </div>`;
}

/** Show quick-add character modal and return the new character (or null if cancelled) */
function showQuickAddCharacterModal(callback: (ch: StoryCharacter | null) => void): void {
  const voiceOptionsHtml = VOICE_OPTIONS.map(v =>
    `<option value="${v.voiceId}">${v.name} — ${v.description}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'char-quick-add-modal';
  overlay.innerHTML = `
    <div class="char-quick-add-modal__card">
      <div class="char-quick-add-modal__title">Add New Character</div>
      <div class="char-quick-add-modal__field">
        <label class="char-quick-add-modal__label">Character Name</label>
        <input class="char-quick-add-modal__input" id="qa-char-name" placeholder="e.g. Sarah, Detective Vance..." maxlength="30" />
      </div>
      <div class="char-quick-add-modal__field">
        <label class="char-quick-add-modal__label">Voice</label>
        <select class="char-quick-add-modal__select" id="qa-char-voice">${voiceOptionsHtml}</select>
      </div>
      <div class="char-quick-add-modal__actions">
        <button class="char-quick-add-modal__btn char-quick-add-modal__btn--cancel" id="qa-cancel" type="button">Cancel</button>
        <button class="char-quick-add-modal__btn char-quick-add-modal__btn--save" id="qa-save" type="button">Add Character</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('qa-cancel')?.addEventListener('click', () => { overlay.remove(); callback(null); });
  document.getElementById('qa-save')?.addEventListener('click', () => {
    const nameInput = document.getElementById('qa-char-name') as HTMLInputElement | null;
    const voiceSelect = document.getElementById('qa-char-voice') as HTMLSelectElement | null;
    const name = nameInput?.value.trim();
    if (!name) return;

    const voiceId = voiceSelect?.value || VOICE_OPTIONS[0]?.voiceId || '';
    const color = CHAR_COLORS[storyCharacters.length % CHAR_COLORS.length];
    const ch: StoryCharacter = { id: 'char_' + Date.now(), name, voiceId, color };
    storyCharacters.push(ch);
    saveDraft();
    overlay.remove();
    callback(ch);
  });

  setTimeout(() => (document.getElementById('qa-char-name') as HTMLInputElement)?.focus(), 100);
}

/** Wire event handlers for multi-character dialogue lines on a given container.
 *  prefix: 'mob' for mobile canvas, 'sbd' for storyboard overlay */
function wireDialogueLineEvents(container: HTMLElement | Document, prefix: string, refreshView: () => void): void {
  // Open Story Settings for characters
  container.querySelectorAll('[data-open-char-settings]').forEach(btn => {
    btn.addEventListener('click', () => {
      getFormData();
      openStorySettings();
      setTimeout(() => {
        const card = document.querySelector('.ss-characters-card');
        if (card) card.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    });
  });

  // Add dialogue line
  container.querySelectorAll(`[data-${prefix}-add-line]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const pageIdx = parseInt((btn as HTMLElement).getAttribute(`data-${prefix}-add-line`) || '0');
      if (!bookPages[pageIdx].dialogueLines) bookPages[pageIdx].dialogueLines = [];

      // Default to narrator (always available), or first character if any exist
      const defaultCharId = storyCharacters.length > 0 ? storyCharacters[0].id : 'narrator';
      const defaultCharName = storyCharacters.length > 0 ? storyCharacters[0].name : '🎙️ Narrator';

      bookPages[pageIdx].dialogueLines!.push({
        id: 'line_' + Date.now(),
        characterId: defaultCharId,
        characterName: defaultCharName,
        text: '',
      });
      saveDraft();
      refreshView();
    });
  });

  // Delete line
  container.querySelectorAll(`[data-${prefix}-line-del]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const [pStr, lStr] = ((btn as HTMLElement).getAttribute(`data-${prefix}-line-del`) || '0-0').split('-');
      const pageIdx = parseInt(pStr); const lineIdx = parseInt(lStr);
      bookPages[pageIdx].dialogueLines?.splice(lineIdx, 1);
      // Sync dialogText for backward compat
      syncDialogText(pageIdx);
      saveDraft();
      refreshView();
    });
  });

  // Text input
  container.querySelectorAll(`[data-${prefix}-line-text]`).forEach(ta => {
    ta.addEventListener('input', () => {
      const [pStr, lStr] = ((ta as HTMLElement).getAttribute(`data-${prefix}-line-text`) || '0-0').split('-');
      const pageIdx = parseInt(pStr); const lineIdx = parseInt(lStr);
      if (bookPages[pageIdx].dialogueLines?.[lineIdx]) {
        bookPages[pageIdx].dialogueLines![lineIdx].text = (ta as HTMLTextAreaElement).value;
        syncDialogText(pageIdx);
        saveDraft();
      }
    });
  });

  // Character change
  container.querySelectorAll(`[data-${prefix}-line-char]`).forEach(sel => {
    sel.addEventListener('change', () => {
      const [pStr, lStr] = ((sel as HTMLElement).getAttribute(`data-${prefix}-line-char`) || '0-0').split('-');
      const pageIdx = parseInt(pStr); const lineIdx = parseInt(lStr);
      const val = (sel as HTMLSelectElement).value;
      if (val === '__new__') {
        showQuickAddCharacterModal((ch) => {
          if (ch && bookPages[pageIdx].dialogueLines?.[lineIdx]) {
            bookPages[pageIdx].dialogueLines![lineIdx].characterId = ch.id;
            bookPages[pageIdx].dialogueLines![lineIdx].characterName = ch.name;
            syncDialogText(pageIdx);
            saveDraft();
          }
          refreshView();
        });
        return;
      }
      if (val === 'narrator') {
        if (bookPages[pageIdx].dialogueLines?.[lineIdx]) {
          bookPages[pageIdx].dialogueLines![lineIdx].characterId = 'narrator';
          bookPages[pageIdx].dialogueLines![lineIdx].characterName = '🎙️ Narrator';
          syncDialogText(pageIdx);
          saveDraft();
          refreshView();
        }
        return;
      }
      const ch = storyCharacters.find(c => c.id === val);
      if (ch && bookPages[pageIdx].dialogueLines?.[lineIdx]) {
        bookPages[pageIdx].dialogueLines![lineIdx].characterId = ch.id;
        bookPages[pageIdx].dialogueLines![lineIdx].characterName = ch.name;
        syncDialogText(pageIdx);
        saveDraft();
      }
    });
  });

  // Per-line record
  container.querySelectorAll(`[data-${prefix}-line-rec]`).forEach(btn => {
    btn.addEventListener('click', async () => {
      const [pStr, lStr] = ((btn as HTMLElement).getAttribute(`data-${prefix}-line-rec`) || '0-0').split('-');
      const pageIdx = parseInt(pStr); const lineIdx = parseInt(lStr);
      const line = bookPages[pageIdx].dialogueLines?.[lineIdx];
      if (!line || !line.text.trim()) {
        showModal({ title: 'No Text', content: '<p>Write some dialogue text first.</p>', confirmText: 'OK' });
        return;
      }
      const isNarrator = line.characterId === 'narrator';
      const ch = isNarrator ? null : storyCharacters.find(c => c.id === line.characterId);
      const voiceId = isNarrator ? storyNarratorVoiceId : ch?.voiceId;
      const b = btn as HTMLButtonElement;
      b.disabled = true;
      b.textContent = '⏳ Recording...';
      try {
        const audioData = await preRecordAudio(line.text, 0.5, voiceId);
        const storyId = editStoryId || activeDraftId || 'draft';
        const cdnUrl = await uploadAudioData(audioData, storyId, line.id);
        line.audioUrl = cdnUrl;
        saveDraft();
      } catch (err: any) {
        showModal({ title: 'Record Failed', content: `<p>${err.message || 'Something went wrong.'}</p>`, confirmText: 'OK' });
      }
      refreshView();
    });
  });

  // Per-line play
  container.querySelectorAll(`[data-${prefix}-line-play]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const [pStr, lStr] = ((btn as HTMLElement).getAttribute(`data-${prefix}-line-play`) || '0-0').split('-');
      const pageIdx = parseInt(pStr); const lineIdx = parseInt(lStr);
      const url = bookPages[pageIdx].dialogueLines?.[lineIdx]?.audioUrl;
      if (url) {
        if (isSpeaking()) { stopSpeaking(); } else { playAudioUrl(url); }
      }
    });
  });

  // Batch pre-record all lines on page
  container.querySelectorAll(`[data-${prefix}-batch-rec]`).forEach(btn => {
    btn.addEventListener('click', async () => {
      const pageIdx = parseInt((btn as HTMLElement).getAttribute(`data-${prefix}-batch-rec`) || '0');
      const lines = bookPages[pageIdx].dialogueLines || [];
      if (lines.length === 0) return;
      const b = btn as HTMLButtonElement;
      b.disabled = true;
      b.classList.add('sb-dialog-batch-btn--recording');
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (!line.text.trim()) continue;
        b.textContent = `🎙️ Recording line ${li + 1} of ${lines.length} (${line.characterName})...`;
        const isNarrator = line.characterId === 'narrator';
        const ch = isNarrator ? null : storyCharacters.find(c => c.id === line.characterId);
        const voiceId = isNarrator ? storyNarratorVoiceId : ch?.voiceId;
        try {
          const audioData = await preRecordAudio(line.text, 0.5, voiceId);
          const storyId = editStoryId || activeDraftId || 'draft';
          line.audioUrl = await uploadAudioData(audioData, storyId, line.id);
        } catch (err: any) {
          console.warn(`[Batch] Failed line ${li}:`, err);
        }
      }
      b.textContent = `✅ All ${lines.length} lines recorded!`;
      b.classList.remove('sb-dialog-batch-btn--recording');
      saveDraft();
      setTimeout(() => refreshView(), 1500);
    });
  });

  // Play all dialogue
  container.querySelectorAll(`[data-${prefix}-play-all]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const pageIdx = parseInt((btn as HTMLElement).getAttribute(`data-${prefix}-play-all`) || '0');
      const lines = bookPages[pageIdx].dialogueLines || [];
      const urls = lines.map(l => l.audioUrl || null);
      if (isSpeaking()) { stopSpeaking(); return; }
      playAudioSequence(urls);
    });
  });
}

/** Sync dialogueLines back to legacy dialogText for backward compatibility */
function syncDialogText(pageIdx: number): void {
  const lines = bookPages[pageIdx].dialogueLines || [];
  bookPages[pageIdx].dialogText = lines.map(l => `[${l.characterName}]: ${l.text}`).join('\n');
}

function renderBookCanvas(): string {
  // Clamp currentPage
  if (currentPage < 0) currentPage = 0;
  if (currentPage >= bookPages.length) currentPage = bookPages.length - 1;

  // Generate dots (1 dot per page)
  let dotsHtml = '';
  for (let i = 0; i < bookPages.length; i++) {
    dotsHtml += `<div class="book-dot${i === currentPage ? ' book-dot--active' : ''}" data-dot="${i}"></div>`;
  }

  const i = currentPage;
  const page = bookPages[i];
  const cardHtml = `
    <div class="book-tile book-tile--single" data-book-longpress="${i}">
      <div class="book-tile__header" style="position:relative; display:flex; align-items:center; justify-content:space-between; padding:10px 14px;">
        <span class="book-tile__label">PAGE ${i + 1}</span>
        <div class="book-tile__header-actions">
          <button type="button" class="book-tile__action-btn book-tile__action-btn--move-up" data-page-move-up="${i}" title="Move Page Up" ${i === 0 ? 'disabled' : ''}>
            ▲
          </button>
          <button type="button" class="book-tile__action-btn book-tile__action-btn--move-down" data-page-move-down="${i}" title="Move Page Down" ${i === bookPages.length - 1 ? 'disabled' : ''}>
            ▼
          </button>
          <button type="button" class="book-tile__action-btn book-tile__action-btn--duplicate" data-page-duplicate="${i}" title="Duplicate Page">
            📋
          </button>
          <button class="book-tile__maximize" data-tile-maximize="${i}" title="Expand page">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>
      </div>

      <!-- Image area -->
      <div class="book-tile__image" data-tile-upload="${i}">
        ${page.image
            ? `${isVideoMedia(page.image)
                 ? `<video class="book-tile__img" src="${page.image}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;object-position:center ${page.focalPosition || 'center'}; border-radius:8px;"></video>`
                 : `<img class="book-tile__img" src="${page.image}" alt="Page ${i + 1}" style="object-position:center ${page.focalPosition || 'center'};">`}
               <button class="book-tile__remove-img" data-tile-remove-img="${i}">${ICON.close}</button>`
            : `<div class="book-tile__empty-img">
                <div class="book-tile__upload-btn">${ICON.upload}</div>
                <span>Click to Upload</span>
              </div>`
        }
        <input type="file" class="book-tile__file" data-tile-file="${i}" accept="image/*,video/*" hidden>
      </div>

      ${page.image ? `
      <!-- Focal position selector -->
      <div class="book-tile__focal-pill" data-focal-group="${i}">
        <span class="book-tile__focal-label">Align:</span>
        <button type="button" class="focal-btn ${(page.focalPosition || 'center') === 'top' ? 'focal-btn--active' : ''}" data-set-focal="${i}" data-focal-val="top" title="Align image to top">Top</button>
        <button type="button" class="focal-btn ${(page.focalPosition || 'center') === 'center' ? 'focal-btn--active' : ''}" data-set-focal="${i}" data-focal-val="center" title="Align image to center">Center</button>
        <button type="button" class="focal-btn ${(page.focalPosition || 'center') === 'bottom' ? 'focal-btn--active' : ''}" data-set-focal="${i}" data-focal-val="bottom" title="Align image to bottom">Bottom</button>
      </div>
      ` : ''}

      <!-- Story text -->
      <div class="book-tile__text-header">
        <span>STORY TEXT</span>
      </div>
      <textarea class="book-tile__textarea" data-tile-text="${i}"
        placeholder="Write the story for this page..."
        rows="4" maxlength="1000">${page.text}</textarea>

      <!-- Dialogue / Audio -->
      ${storyAudioMode === 'simple_upload' ? `
        <div class="book-tile__text-header" style="margin-top: var(--space-sm);">
          <span>📁 PAGE AUDIO</span>
        </div>
        <div class="audio-upload-zone" data-audio-upload-zone="${i}">
          ${page.audioUrl ? `
            <div class="audio-upload-preview">
              <div class="audio-upload-preview__info">
                <span class="audio-upload-preview__icon">${(page.audioFileName && /\.(mp4|mov|webm|m4v|avi)$/i.test(page.audioFileName)) ? '🎬' : '🎵'}</span>
                <div class="audio-upload-preview__meta">
                  <span class="audio-upload-preview__name">${page.audioFileName || 'Audio uploaded'}</span>
                  <span class="audio-upload-preview__tag">${(page.audioFileName && /\.(mp4|mov|webm|m4v|avi)$/i.test(page.audioFileName)) ? 'Audio (from Video)' : 'Audio File'}</span>
                </div>
              </div>
              <div class="audio-scrubber" data-audio-scrubber-wrap="${i}">
                <input type="range" class="audio-scrubber__slider" data-audio-scrubber="${i}" min="0" max="100" value="0" step="0.1" aria-label="Audio progress">
                <div class="audio-scrubber__time">
                  <span class="audio-scrubber__current" data-audio-current="${i}">0:00</span>
                  <span class="audio-scrubber__divider">/</span>
                  <span class="audio-scrubber__duration" data-audio-duration="${i}">--:--</span>
                </div>
              </div>
              <div class="audio-upload-actions">
                <button class="audio-upload-actions__btn" data-audio-play="${i}" type="button">▶ Play</button>
                <button class="audio-upload-actions__btn audio-upload-actions__btn--restart" data-audio-restart="${i}" type="button" title="Play from start">⏮ Restart</button>
                <button class="audio-upload-actions__btn" data-audio-replace="${i}" type="button">Replace</button>
                <button class="audio-upload-actions__btn audio-upload-actions__btn--delete" data-audio-remove="${i}" type="button">✕</button>
              </div>
            </div>
          ` : `
            <button class="audio-upload-btn" data-audio-upload-trigger="${i}" type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Click to Upload Audio or Video (MP3, WAV, M4A, MP4, MOV)</span>
            </button>
          `}
          <input type="file" class="audio-upload-file" data-audio-file="${i}" accept="audio/*,video/*" hidden>
        </div>
        <div class="book-tile__text-header" style="margin-top: var(--space-sm);">
          <span>📝 CAPTIONS (for hearing-impaired viewers)</span>
        </div>
        <textarea class="book-tile__textarea" data-simple-captions="${i}"
          placeholder="Type dialogue and captions here for hearing-impaired viewers (optional)..."
          rows="3" maxlength="1000">${page.dialogText || ''}</textarea>
      ` : `
        <div class="book-tile__text-header" style="margin-top: var(--space-sm);">
          <span>CHARACTER DIALOGUE</span>
        </div>
        ${renderDialogueLines(i, page.dialogueLines || [], 'mob')}
      `}


      <!-- Deeper Dive -->
      <div class="book-tile__deeper-dive">
        <button class="book-tile__dd-toggle" data-tile-dd-toggle="${i}" type="button">
          <svg class="book-tile__dd-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>
          <span>DEEPER DIVE (MORE SECTION)</span>
        </button>
        <div class="book-tile__dd-panel" data-tile-dd-panel="${i}" style="display:none;">
          <textarea class="book-tile__dd-textarea" data-tile-dd-content="${i}"
            placeholder="Capture your deeper dive content here..."
            rows="5">${page.deeperDiveContent || ''}</textarea>

        </div>
      </div>
    </div>
  `;

  return `
    <div class="create-phase create-phase--canvas fade-in">
      ${renderStudioOrbs()}
      ${renderCanvasToolbar('Illustrated Book - Ep.' + episodeNumber)}

      <h2 class="create-phase__title" style="margin-bottom:4px;">Your Pages</h2>
      <p class="create-phase__desc">Page ${currentPage + 1} of ${bookPages.length}. Long-press to delete.</p>

      <!-- Page progress dots -->
      <div class="book-dots" id="book-dots">${dotsHtml}</div>

      <!-- Single page view with arrow navigation -->
      <div class="book-single-view">
        <!-- Left arrow -->
        <button class="book-nav-arrow book-nav-arrow--left" id="btn-book-prev" ${currentPage <= 0 ? 'style="visibility:hidden"' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <!-- Page card -->
        ${cardHtml}

        <!-- Right arrow -->
        <button class="book-nav-arrow book-nav-arrow--right" id="btn-book-next" ${currentPage >= bookPages.length - 1 ? 'style="visibility:hidden"' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      ${renderSparcAdminEditor()}
    </div>
  `;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  FULLSCREEN PAGE VIEWER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


function openPageFullscreen(pageIndex: number): void {
  const page = bookPages[pageIndex];
  if (!page) return;

  // Remove existing overlay if any
  document.getElementById('book-fullscreen')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'book-fullscreen-overlay';
  overlay.id = 'book-fullscreen';
  overlay.innerHTML = `
    <div class="book-fullscreen__body">
      <div class="book-fullscreen__image-area" id="fs-image-area">
        <button class="book-fullscreen__collapse" id="btn-fullscreen-collapse" title="Collapse" type="button">
          ${ICON.collapse}
        </button>
        ${page.image
            ? `${isVideoMedia(page.image)
                 ? `<video src="${page.image}" autoplay loop muted playsinline style="width:100%;max-height:60vh;object-fit:contain;border-radius:12px;"></video>`
                 : `<img src="${page.image}" alt="Page ${pageIndex + 1}">`}
               <button class="book-fullscreen__remove-img" id="fs-remove-img">${ICON.close}</button>`
            : `<div class="book-fullscreen__empty-img">
                 <div class="book-tile__upload-btn">${ICON.upload}</div>
                 <span>Click to Upload</span>
               </div>`
        }
        <input type="file" id="fs-file-input" accept="image/*,video/*" hidden>
      </div>
      <div class="book-fullscreen__text-label">
        <span>Story Text</span>
      </div>
      <textarea class="book-fullscreen__textarea" id="fs-textarea"
        placeholder="Write the story for this page..."
        rows="6" maxlength="1000">${page.text}</textarea>

      <!-- Dialogue (fullscreen) -->
      <div class="book-fullscreen__text-label" style="margin-top: var(--space-md);">
        <span>Dialogue</span>
      </div>
      <textarea class="book-fullscreen__textarea" id="fs-dialog-textarea"
        placeholder="Write dialogue for this page..."
        rows="4" maxlength="1000">${page.dialogText || ''}</textarea>

      <!-- Deeper Dive (fullscreen) -->
      <div class="book-tile__deeper-dive" style="margin-top: var(--space-md);">
        <button class="book-tile__dd-toggle" id="fs-dd-toggle">
          <svg class="book-tile__dd-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>
          <span>DEEPER DIVE (MORE SECTION)</span>
        </button>
        <div class="book-tile__dd-panel" id="fs-dd-panel" style="display:none;">
          <textarea class="book-tile__dd-textarea" id="fs-dd-content"
            placeholder="Capture your deeper dive content here..."
            rows="7">${page.deeperDiveContent || ''}</textarea>

        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // --- Wire up events ---

  // Collapse button
  document.getElementById('btn-fullscreen-collapse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePageFullscreen(overlay);
  });

  // Image area click → file upload
  const imageArea = document.getElementById('fs-image-area');
  const fileInput = document.getElementById('fs-file-input') as HTMLInputElement;
  imageArea?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#fs-remove-img') || (e.target as HTMLElement).closest('#btn-fullscreen-collapse')) return;
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) {
      bookPages[pageIndex].image = await fileToDataUrl(file);
      closePageFullscreen(overlay);
      const wizard = document.getElementById('create-wizard');
      if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
      openPageFullscreen(pageIndex);
    }
  });

  // Remove image
  document.getElementById('fs-remove-img')?.addEventListener('click', (e) => {
    e.stopPropagation();
    bookPages[pageIndex].image = null;
    closePageFullscreen(overlay);
    const wizard = document.getElementById('create-wizard');
    if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
    openPageFullscreen(pageIndex);
  });

  // Text changes
  const fsText = document.getElementById('fs-textarea') as HTMLTextAreaElement | null;
  const updateFsText = () => {
    if (fsText) bookPages[pageIndex].text = fsText.value;
    saveDraft();
  };
  fsText?.addEventListener('input', updateFsText);
  fsText?.addEventListener('paste', () => setTimeout(updateFsText, 0));

  // Dialogue changes
  const fsDialog = document.getElementById('fs-dialog-textarea') as HTMLTextAreaElement | null;
  const updateFsDialog = () => {
    if (fsDialog) bookPages[pageIndex].dialogText = fsDialog.value;
    saveDraft();
  };
  fsDialog?.addEventListener('input', updateFsDialog);
  fsDialog?.addEventListener('paste', () => setTimeout(updateFsDialog, 0));


  // Fullscreen Deeper Dive toggle
  document.getElementById('fs-dd-toggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    const panel = document.getElementById('fs-dd-panel') as HTMLElement;
    const chevron = (e.currentTarget as HTMLElement).querySelector('.book-tile__dd-chevron') as HTMLElement;
    if (panel) {
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
      if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
    }
  });

  // Fullscreen Deeper Dive content
  const fsDd = document.getElementById('fs-dd-content') as HTMLTextAreaElement | null;
  const updateFsDd = () => {
    if (fsDd) bookPages[pageIndex].deeperDiveContent = fsDd.value;
    saveDraft();
  };
  fsDd?.addEventListener('input', updateFsDd);
  fsDd?.addEventListener('paste', () => setTimeout(updateFsDd, 0));


}

function closePageFullscreen(overlay: HTMLElement): void {
  overlay.classList.add('closing');
  overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
}

// ═══════════════════════════════════════
//  STORYBOARD — Wide Desktop View
// ═══════════════════════════════════════

const isDesktopScreen = (): boolean => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return false;
  return window.innerWidth >= 768;
};
let activeEditorMode: 'storyboard' | 'mobile' = isDesktopScreen() ? 'storyboard' : 'mobile';
let promptSaveStoryAdminGlobal: ((status?: 'draft' | 'live') => Promise<void>) | null = null;

function showDesktopRequiredModal(): void {
  showModal({
    title: '🖥️ Computer Screen Required',
    content: `
      <div style="text-align:center; padding: 12px 0;">
        <div style="font-size: 3rem; margin-bottom: 12px;">💻</div>
        <p style="font-size: 0.95rem; line-height: 1.6; color: var(--color-text-primary); margin-bottom: 8px;">
          <strong>The multi-card Content Storyboard requires a computer display</strong> (minimum 1024px screen width).
        </p>
        <p style="font-size: 0.85rem; line-height: 1.5; color: var(--color-text-muted);">
          Please open DRiVE on your desktop or laptop computer to use Storyboard View, or continue editing your pages in the Mobile View right here!
        </p>
      </div>
    `,
    confirmText: 'Continue in Mobile View',
    cancelText: '',
    onConfirm: () => hideModal(),
  });
}

function openStoryboard(): void {
  if (!isDesktopScreen()) {
    showDesktopRequiredModal();
    return;
  }

  // Remove existing storyboard if open
  document.querySelector('.storyboard-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'storyboard-overlay';

  const cardsHtml = bookPages.map((page, i) => `
    <div class="sb-card" data-sb-card="${i}" draggable="true">
      <div class="sb-card__header">
        <div class="sb-card__drag-handle" title="Drag to reorder">
          <div class="sb-card__drag-handle-dot"><span></span><span></span></div>
          <div class="sb-card__drag-handle-dot"><span></span><span></span></div>
          <div class="sb-card__drag-handle-dot"><span></span><span></span></div>
        </div>
        <span class="sb-card__num">${i + 1}</span>
        <span class="sb-card__label">SLIDE CONTENT</span>
        <div style="display:flex; align-items:center; gap:2px; margin-left:auto;">
          <button class="sb-card__ctrl-btn" data-sb-move-up="${i}" title="Move page up" type="button" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="sb-card__ctrl-btn" data-sb-move-down="${i}" title="Move page down" type="button" ${i === bookPages.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="sb-card__ctrl-btn" data-sb-duplicate="${i}" title="Duplicate page" type="button">📋</button>
          <button class="sb-card__delete" data-sb-delete="${i}" title="Delete page">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <div class="sb-card__media">
        <div class="sb-card__media-header">
          <span class="sb-card__media-label">MEDIA</span>
          ${page.image ? `<span class="sb-card__media-badge">${isVideoMedia(page.image) ? '🎬 VIDEO' : '🖼️ IMAGE'}</span>` : ''}
        </div>
        <div class="sb-card__media-wrap">
          ${page.image
            ? `${isVideoMedia(page.image)
                ? `<video class="sb-card__video" src="${page.image}" autoplay loop muted playsinline webkit-playsinline></video>`
                : `<img class="sb-card__img" src="${page.image}" alt="Page ${i + 1}">`
              }
              <div class="sb-card__media-actions">
                <button type="button" class="sb-card__media-btn sb-card__media-btn--change" data-sb-change="${i}" title="Change media">Change</button>
                <button type="button" class="sb-card__media-btn sb-card__media-btn--remove" data-sb-remove="${i}" title="Remove media">✕</button>
              </div>`
            : `<div class="sb-card__no-img" data-sb-upload="${i}">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Upload Image or Video</span>
              </div>`
          }
          <input type="file" data-sb-file="${i}" accept="image/*,video/*" style="display:none;" />
        </div>
      </div>

      <div class="sb-card__section">
        <div class="sb-card__section-label">STORY TEXT</div>
        <textarea class="sb-card__textarea" data-sb-text="${i}" rows="6" placeholder="Write the story for this page..." maxlength="1000">${page.text}</textarea>
      </div>

      <div class="sb-card__section">
        <div class="sb-card__section-label">CHARACTER DIALOGUE</div>
        ${renderDialogueLines(i, page.dialogueLines || [], 'sbd')}
      </div>


      <details class="sb-card__deeper-dive">
        <summary class="sb-card__dd-summary">🎓 DEEPER DIVE</summary>
        <textarea class="sb-card__dd-textarea" data-sb-dd="${i}" rows="4" placeholder="Deeper dive content...">${page.deeperDiveContent || ''}</textarea>
      </details>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="sb-topbar">
      <div class="sb-topbar__left">
        <div class="sb-topbar__logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div>
          <div class="sb-topbar__title">${escapeHtml(storyTitle || 'Illustrated Book')}</div>
          <div class="sb-topbar__subtitle">CONTENT STORYBOARD • CREATOR VIEW</div>
        </div>
      </div>
      <div class="sb-topbar__right">
        <span class="sb-topbar__counter">${bookPages.length} Pages</span>
        ${!isDesktopScreen() ? `
          <button class="sb-topbar__btn-switch" id="sb-switch-mobile" type="button" title="Switch to mobile phone preview">
            📱 Mobile View
          </button>
        ` : ''}
        <button class="sb-topbar__btn-action" id="sb-story-settings" type="button" title="Edit story title, cover, and metadata">
          ⚙️ Settings
        </button>
        <button class="sb-topbar__btn-action" id="sb-save-draft" type="button" title="Save story draft">
          💾 Save Draft
        </button>
        <button class="sb-topbar__btn-action sb-topbar__btn-primary" id="sb-go-live" type="button" title="Publish official story">
          🚀 Go Live
        </button>
        <button class="sb-topbar__add-btn" id="sb-add-page" type="button">+ Add Page</button>
        ${!isDesktopScreen() ? `
          <button class="sb-topbar__close" id="sb-close" type="button" title="Close and return to mobile editor">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ` : `
          <button class="sb-topbar__close" id="sb-close" type="button" title="Return to admin dashboard" style="margin-left:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        `}
      </div>
    </div>
    <div class="sb-track" id="sb-track">
      ${cardsHtml}
      <div class="sb-card sb-card--sparc" style="min-width:420px; max-width:460px; overflow-y:auto; padding:8px 12px; background:var(--color-surface); border:1.5px solid rgba(99,102,241,0.3); border-radius:16px;">
        ${renderSparcAdminEditor()}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  attachSparcAdminListeners(overlay);
  ensureVideoPlayback(overlay);

  // --- Wire up events ---
  const switchToMobileView = () => {
    activeEditorMode = 'mobile';
    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => {
      overlay.remove();
      const wizard = document.getElementById('admin-admin-create-wizard');
      if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
    }, { once: true });
  };

  // Mobile View button only exists on non-desktop screens
  document.getElementById('sb-switch-mobile')?.addEventListener('click', switchToMobileView);

  // Close button behavior depends on screen size:
  // Desktop → save draft and return to admin dashboard (no mobile editor available)
  // Mobile  → switch back to mobile editor view
  document.getElementById('sb-close')?.addEventListener('click', () => {
    if (isDesktopScreen()) {
      saveDraft();
      overlay.remove();
      navigate('admin');
    } else {
      switchToMobileView();
    }
  });

  document.getElementById('sb-story-settings')?.addEventListener('click', () => {
    // Keep activeEditorMode = 'storyboard' so that pressing "Back" in settings
    // returns to the storyboard view (updateView checks activeEditorMode).
    overlay.remove();
    getFormData();
    openStorySettings();
  });

  document.getElementById('sb-save-draft')?.addEventListener('click', () => {
    saveDraft();
    const btn = document.getElementById('sb-save-draft');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Saved!';
      setTimeout(() => { if (btn) btn.innerHTML = orig; }, 1800);
    }
  });

  document.getElementById('sb-go-live')?.addEventListener('click', () => {
    if (promptSaveStoryAdminGlobal) {
      promptSaveStoryAdminGlobal('live');
    }
  });

  document.getElementById('sb-add-page')?.addEventListener('click', () => {
    bookPages.push(defaultBookPage());
    saveDraft();
    overlay.remove();
    openStoryboard();
    setTimeout(() => {
      const trk = document.getElementById('sb-track');
      if (trk) trk.scrollLeft = trk.scrollWidth;
    }, 60);
  });

  // Media in-card triggers
  overlay.querySelectorAll('[data-sb-upload]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-sb-upload');
      const input = overlay.querySelector(`[data-sb-file="${idx}"]`) as HTMLInputElement;
      input?.click();
    });
  });

  overlay.querySelectorAll('[data-sb-change]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = btn.getAttribute('data-sb-change');
      const input = overlay.querySelector(`[data-sb-file="${idx}"]`) as HTMLInputElement;
      input?.click();
    });
  });

  overlay.querySelectorAll('[data-sb-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-sb-remove') || '0');
      bookPages[idx].image = null as any;
      saveDraft();
      overlay.remove();
      openStoryboard();
    });
  });

  overlay.querySelectorAll('[data-sb-file]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const idx = parseInt(input.getAttribute('data-sb-file') || '0');

      // Visual feedback: show uploading spinner on the active card
      const card = overlay.querySelector(`[data-sb-card="${idx}"]`);
      const mediaWrap = card?.querySelector('.sb-card__media-wrap');
      if (mediaWrap) {
        const spin = document.createElement('div');
        spin.className = 'sb-card__uploading-overlay';
        spin.innerHTML = `<div class="sb-card__upload-spinner"></div><span>Uploading to Cloud...</span>`;
        mediaWrap.appendChild(spin);
      }

      const res = await uploadMedia(file, 'stories');
      bookPages[idx].image = res.url;
      saveDraft();
      overlay.remove();
      openStoryboard();
    });
  });

  // Text editing
  overlay.querySelectorAll('[data-sb-text]').forEach(ta => {
    const handleInput = () => {
      const idx = parseInt(ta.getAttribute('data-sb-text') || '0');
      bookPages[idx].text = (ta as HTMLTextAreaElement).value;
      saveDraft();
    };
    ta.addEventListener('input', handleInput);
    ta.addEventListener('paste', () => setTimeout(handleInput, 0));
  });

  // Multi-character dialogue line events for storyboard
  wireDialogueLineEvents(overlay, 'sbd', () => { overlay.remove(); openStoryboard(); });


  // Deeper dive content
  overlay.querySelectorAll('[data-sb-dd]').forEach(ta => {
    const handleInput = () => {
      const idx = parseInt(ta.getAttribute('data-sb-dd') || '0');
      bookPages[idx].deeperDiveContent = (ta as HTMLTextAreaElement).value;
      saveDraft();
    };
    ta.addEventListener('input', handleInput);
    ta.addEventListener('paste', () => setTimeout(handleInput, 0));
  });

  // Delete page
  overlay.querySelectorAll('[data-sb-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-sb-delete') || '0');
      if (bookPages.length <= 1) { alert('At least one page must remain.'); return; }
      if (!confirm(`Delete Page ${idx + 1}?`)) return;
      bookPages.splice(idx, 1);
      if (currentPage >= bookPages.length) currentPage = bookPages.length - 1;
      saveDraft();
      overlay.remove();
      openStoryboard();
    });
  });

  // Move Up (Storyboard)
  overlay.querySelectorAll('[data-sb-move-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-sb-move-up') || '0');
      if (idx <= 0) return;
      const temp = bookPages[idx];
      bookPages[idx] = bookPages[idx - 1];
      bookPages[idx - 1] = temp;
      currentPage = idx - 1;
      saveDraft();
      overlay.remove();
      openStoryboard();
    });
  });

  // Move Down (Storyboard)
  overlay.querySelectorAll('[data-sb-move-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-sb-move-down') || '0');
      if (idx >= bookPages.length - 1) return;
      const temp = bookPages[idx];
      bookPages[idx] = bookPages[idx + 1];
      bookPages[idx + 1] = temp;
      currentPage = idx + 1;
      saveDraft();
      overlay.remove();
      openStoryboard();
    });
  });

  // Duplicate (Storyboard)
  overlay.querySelectorAll('[data-sb-duplicate]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-sb-duplicate') || '0');
      const src = bookPages[idx];
      const clonedDialogue = (src.dialogueLines || []).map(line => ({
        ...line,
        id: 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      }));
      const clonedPage: BookPage = {
        ...src,
        dialogueLines: clonedDialogue,
      };
      bookPages.splice(idx + 1, 0, clonedPage);
      currentPage = idx + 1;
      saveDraft();
      overlay.remove();
      openStoryboard();
    });
  });

  // Dialog text editing
  overlay.querySelectorAll('[data-sb-dialog]').forEach(ta => {
    const handleInput = () => {
      const idx = parseInt(ta.getAttribute('data-sb-dialog') || '0');
      bookPages[idx].dialogText = (ta as HTMLTextAreaElement).value;
      saveDraft();
    };
    ta.addEventListener('input', handleInput);
    ta.addEventListener('paste', () => setTimeout(handleInput, 0));
  });

  // --- Drag and Drop reordering ---
  let dragSrcIdx: number | null = null;
  const track = document.getElementById('sb-track');
  const cards = overlay.querySelectorAll('.sb-card');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e: Event) => {
      const de = e as DragEvent;
      dragSrcIdx = parseInt((card as HTMLElement).getAttribute('data-sb-card') || '0');
      (card as HTMLElement).classList.add('sb-card--dragging');
      de.dataTransfer!.effectAllowed = 'move';
      de.dataTransfer!.setData('text/plain', String(dragSrcIdx));
    });

    card.addEventListener('dragover', (e: Event) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'move';
      (card as HTMLElement).classList.add('sb-card--drag-over');
    });

    card.addEventListener('dragleave', () => {
      (card as HTMLElement).classList.remove('sb-card--drag-over');
    });

    card.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      (card as HTMLElement).classList.remove('sb-card--drag-over');
      const dropIdx = parseInt((card as HTMLElement).getAttribute('data-sb-card') || '0');
      if (dragSrcIdx !== null && dragSrcIdx !== dropIdx) {
        // Reorder bookPages
        const [movedPage] = bookPages.splice(dragSrcIdx, 1);
        bookPages.splice(dropIdx, 0, movedPage);
        // Re-render storyboard
        overlay.remove();
        openStoryboard();
      }
    });

    card.addEventListener('dragend', () => {
      (card as HTMLElement).classList.remove('sb-card--dragging');
      cards.forEach(c => (c as HTMLElement).classList.remove('sb-card--drag-over'));
      dragSrcIdx = null;
    });
  });
}

// â”€â”€â”€ Voice Note (Speech-to-Text) â”€â”€â”€
let activeRecognition: any = null;




let attachListenersGlobal: () => void = () => {};

// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
//  DETAILS (shared by all formats)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function renderPhase(): string {
  const formatLabel = selectedFormat === 'book' ? '📖 Illustrated Book' : '📜 Waterfall Storyboard';

  // Episode context banner — shown when creating a new episode for an existing story
  const episodeBanner = (episodeStoryGroupId && (episodeNumber > 1 || episodeParentTitle)) ? `
    <div style="
      background: linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.1));
      border: 1px solid rgba(139,92,246,0.3);
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    ">
      <div style="
        width: 42px; height: 42px; border-radius: 12px;
        background: linear-gradient(135deg, var(--color-purple), #8a2be2);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 800; font-size: 1rem; flex-shrink: 0;
      ">EP${episodeNumber}</div>
      <div style="flex: 1; min-width: 200px;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 2px;">
          ${episodeParentTitle ? `Adding Episode ${episodeNumber} to "${escapeHtml(episodeParentTitle)}"` : `Episode ${episodeNumber}`}
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <span style="
            background: rgba(139,92,246,0.15); color: var(--color-purple);
            padding: 2px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 700;
          ">${formatLabel}</span>
          <span style="font-size: 0.7rem; color: var(--color-text-muted);">Format locked to match existing episodes</span>
        </div>
      </div>
    </div>
  ` : '';

  if (phase === 'canvas') {
    return episodeBanner + (selectedFormat === 'book' ? renderBookCanvas() : renderScrollCanvas());
  }
  return episodeBanner;
}

export function render(): string {
  return `
    <div class="view-create view-create--canvas" id="admin-create-container">
      <div class="admin-create-wizard admin-create-wizard--canvas slide-up stagger-1" id="admin-admin-create-wizard">
        ${renderPhase()}
      </div>
    </div>
  `;
}

export function init(): void {
  const wizard = document.getElementById('admin-admin-create-wizard');
  if (!wizard) return;

  const currentRoute = getCurrentRoute();
  const editId = getRouteParam();
  const queryMatch = window.location.hash.match(/format=([^&]+)/);
  const qFormat = queryMatch ? queryMatch[1] : null;

  // Parse episode context from URL params (when adding a new episode to an existing story)
  const groupIdMatch = window.location.hash.match(/storyGroupId=([^&]+)/);
  const epNumMatch = window.location.hash.match(/episodeNumber=([^&]+)/);
  const titleMatch = window.location.hash.match(/storyTitle=([^&]+)/);
  if (groupIdMatch) episodeStoryGroupId = groupIdMatch[1];
  if (epNumMatch) episodeNumber = parseInt(epNumMatch[1], 10) || 1;
  if (titleMatch) episodeParentTitle = decodeURIComponent(titleMatch[1]);

  let attachListeners: () => void = () => {};

  const loadData = async () => {
    if (editId) {
      // Check for local draft first
      const existingDraft = getDraft();
      if (existingDraft && existingDraft.editStoryId === editId) {
        // Local draft exists for this story — use it (preserves unsaved changes)
        loadDraft(existingDraft);
        return;
      }
      
      const stories = await fetchOfficialStories();
      const storyToEdit = stories.find(s => s.id === editId);
      if (storyToEdit) {
        editStoryId = storyToEdit.id;
        storyTitle = storyToEdit.title;
        storyGenre = storyToEdit.genre;
        selectedFormat = storyToEdit.format;
        storySynopsis = storyToEdit.synopsis;
        storyAuthorName = storyToEdit.author;
        _coverThumbnail = storyToEdit.coverImage;
        storyContentRating = storyToEdit.contentRating || 'All Ages';
        storyCoverVideo = storyToEdit.coverVideo || '';
        // Load episode metadata from existing story
        episodeStoryGroupId = storyToEdit.storyGroupId || storyToEdit.id;
        episodeNumber = storyToEdit.episodeNumber || 1;
        // Load BGM fields (Audit Fix B)
        storyBgmUrl = storyToEdit.bgmUrl || '';
        storyBgmVolume = typeof storyToEdit.bgmVolume === 'number' ? storyToEdit.bgmVolume : 0.25;
        // Load characters and audio mode
        storyCharacters = storyToEdit.characters || [];
        storyAudioMode = storyToEdit.audioMode || 'make_audio';
        storyNarratorVoiceId = storyToEdit.narratorVoiceId || '21m00Tcm4TlvDq8ikWAM';
        soloEpisodeCount = storyToEdit.soloEpisodeCount || 1;
        if (storyToEdit.sparcPrompt) {
          sparcPromptText = storyToEdit.sparcPrompt.text || '';
          sparcPromptMediaUrls = storyToEdit.sparcPrompt.mediaUrls ? [...storyToEdit.sparcPrompt.mediaUrls] : [];
        } else {
          sparcPromptText = '';
          sparcPromptMediaUrls = [];
        }

        if (selectedFormat === 'book') {
           bookPages = storyToEdit.panels.map((p, i) => ({
             image: p, text: storyToEdit.pageScripts?.[i] || '', stability: 0.5, deeperDiveContent: '',
             audioUrl: storyToEdit.pageAudio?.[i] || null,
             audioFileName: null,
             dialogText: '', dialogAudioUrl: null,
             dialogueLines: storyToEdit.pageDialogue?.[i] || [],
             focalPosition: (storyToEdit.pageFocalPositions?.[i] as 'top' | 'center' | 'bottom') || 'center',
           }));
        } else {
           scrollPanels = storyToEdit.panels.map((p, i) => ({
             image: p, notes: storyToEdit.pageScripts?.[i] || '', layout: 'single', tiles: [p], textOverlays: [[]], audioUrl: null
           }));
        }
      }
    } else if (groupIdMatch) {
      // Adding a brand new episode to an existing story group
      // Only clear draft if user explicitly clicked "+ Add Episode" (new=true in URL)
      // Don't clear when just loading an existing draft that happens to have storyGroupId
      editStoryId = null;
      selectedFormat = (qFormat as StoryFormat) || 'book';
      storyTitle = episodeParentTitle || '';
      _coverThumbnail = '';
      storyCoverVideo = '';
      storySynopsis = '';
      currentPage = 0;

      // Parse inherited settings from URL params
      const genreParam = window.location.hash.match(/genre=([^&]+)/);
      const ratingParam = window.location.hash.match(/contentRating=([^&]+)/);
      const audioModeParam = window.location.hash.match(/audioMode=([^&]+)/);
      const voiceIdParam = window.location.hash.match(/narratorVoiceId=([^&]+)/);
      const soloEpParam = window.location.hash.match(/soloEpisodeCount=([^&]+)/);

      if (genreParam) storyGenre = decodeURIComponent(genreParam[1]) as typeof storyGenre;
      if (ratingParam) storyContentRating = decodeURIComponent(ratingParam[1]) as typeof storyContentRating;
      if (audioModeParam) storyAudioMode = decodeURIComponent(audioModeParam[1]) as typeof storyAudioMode;
      if (voiceIdParam) storyNarratorVoiceId = decodeURIComponent(voiceIdParam[1]);
      if (soloEpParam) soloEpisodeCount = parseInt(soloEpParam[1], 10) as 1 | 2 | 3;

      // Fetch characters and BGM from Episode 1 of this group
      try {
        const groupStories = await fetchOfficialStories();
        const ep1 = groupStories.find(s => (s.storyGroupId || s.id) === episodeStoryGroupId && (s.episodeNumber || 1) === 1);
        if (ep1) {
          if (ep1.characters && ep1.characters.length > 0) storyCharacters = [...ep1.characters];
          if (ep1.bgmUrl) storyBgmUrl = ep1.bgmUrl;
          if (typeof ep1.bgmVolume === 'number') storyBgmVolume = ep1.bgmVolume;
          // Inherit genre/rating/etc from episode 1 if not already set via URL params
          if (!genreParam && ep1.genre) storyGenre = ep1.genre;
          if (!ratingParam && ep1.contentRating) storyContentRating = ep1.contentRating;
          if (!audioModeParam && ep1.audioMode) storyAudioMode = ep1.audioMode;
          if (!voiceIdParam && ep1.narratorVoiceId) storyNarratorVoiceId = ep1.narratorVoiceId;
        }
      } catch (err) {
        console.warn('[AdminCreate] Could not fetch Episode 1 for settings inheritance:', err);
      }

      if (selectedFormat === 'book') {
        bookPages = [{
          image: '', text: '', stability: 0.5, deeperDiveContent: '', audioUrl: null, dialogText: '', dialogAudioUrl: null, dialogueLines: [], focalPosition: 'center', audioFileName: null
        }];
      } else {
        scrollPanels = [{
          image: '', notes: '', layout: 'single', tiles: [''], textOverlays: [[]], audioUrl: null
        }];
      }
    } else {
      const isNew = window.location.hash.includes('new=true') || window.location.hash.includes('new=1');
      if (isNew) {
        clearDraft();
        editStoryId = null;
        selectedFormat = (qFormat as StoryFormat) || 'book';
        storyTitle = '';
        _coverThumbnail = '';
        storyCoverVideo = '';
        storySynopsis = '';
        currentPage = 0;
        storyCharacters = [];
        if (selectedFormat === 'book') {
          bookPages = Array.from({ length: 5 }, () => defaultBookPage());
        } else {
          scrollPanels = Array.from({ length: 5 }, () => ({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null }));
        }
      } else {
        const draft = getDraft();
        if (draft && (!qFormat || draft.selectedFormat === qFormat)) {
          loadDraft(draft);
        } else {
          selectedFormat = (qFormat as StoryFormat) || 'book';
        }
      }
    }

    if (selectedFormat === 'book' && currentPage < 0) currentPage = 0;

    updateView = () => {
      saveDraft();
      const wiz = document.getElementById('admin-admin-create-wizard');
      if (wiz) {
        wiz.innerHTML = renderPhase();
        attachListeners();
      }
      if (selectedFormat === 'book' && isDesktopScreen()) {
        activeEditorMode = 'storyboard';
        openStoryboard();
      }
    };
    updateView();
  };

  attachListenersGlobal = () => attachListeners();

  window.addEventListener('resize', () => {
    if (!isDesktopScreen() && document.querySelector('.storyboard-overlay')) {
      document.querySelector('.storyboard-overlay')?.remove();
      activeEditorMode = 'mobile';
      updateView();
      showDesktopRequiredModal();
    }
  });

  loadData();

  async function promptSaveStoryAdmin(saveStatus: 'draft' | 'live' = 'draft'): Promise<void> {
    promptSaveStoryAdminGlobal = promptSaveStoryAdmin;
    getFormData();

    const pageCount = selectedFormat === 'book' ? bookPages.length : scrollPanels.length;
    if (saveStatus === 'live' && (pageCount < 12 || pageCount > 36)) {
      showModal({
        title: 'Episode Length Requirement',
        content: `
          <p style="line-height:1.5; margin-bottom:12px; font-size:0.9rem; color:var(--color-text-secondary);">
            Episodes must contain between <strong>12 and 36 pages</strong> to go live.<br><br>
            Current count: <strong>${pageCount} pages</strong>.<br>
            ${pageCount < 12 ? `Please add at least <strong>${12 - pageCount}</strong> more page(s).` : `Please remove <strong>${pageCount - 36}</strong> page(s).`}
          </p>
          <p style="font-size:0.8rem; color:var(--color-text-muted);">
            You can still save this episode as a <strong>Draft</strong> and continue editing later.
          </p>
        `,
        confirmText: 'Save as Draft',
        cancelText: 'Keep Editing',
        onConfirm: async () => {
          await promptSaveStoryAdmin('draft');
        }
      });
      return;
    }

    const hasValidTitle = storyTitle && storyTitle.trim() && storyTitle.trim() !== 'Untitled';
    if (hasValidTitle) {
      saveDraft();
      hideModal();
      try {
        await saveOfficialStory(buildStory(saveStatus));
      } catch (e) {
        console.warn('Story save error', e);
      }
      navigate('admin');
      return;
    }

    showModal({
      title: 'Story Title Required',
      content: `
        <p style="line-height:1.5; margin-bottom:14px; font-size:0.88rem; color:var(--color-text-secondary);">
          Please enter a title for your story before saving:
        </p>
        <div style="margin-bottom:8px;">
          <input type="text" id="draft-prompt-title" class="ss-field__input" placeholder="Enter story title..." value="" maxlength="80" style="width:100%; box-sizing:border-box;" />
        </div>
      `,
      confirmText: 'Save, and Exit',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const input = document.getElementById('draft-prompt-title') as HTMLInputElement | null;
        const enteredTitle = input?.value.trim();
        if (!enteredTitle) {
          return;
        }
        storyTitle = enteredTitle;
        const titleInput = document.getElementById('ss-title') as HTMLInputElement | null;
        if (titleInput) titleInput.value = enteredTitle;
        const page0Title = document.getElementById('page0-title') as HTMLInputElement | null;
        if (page0Title) page0Title.value = enteredTitle;

        saveDraft();
        try {
          await saveOfficialStory(buildStory(saveStatus));
        } catch (e) {
          console.warn('Story save error', e);
        }
        hideModal();
        navigate('admin');
      },
    });

    setTimeout(() => {
      const input = document.getElementById('draft-prompt-title') as HTMLInputElement | null;
      input?.focus();
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const confirmBtn = document.getElementById('modal-confirm-btn');
          confirmBtn?.click();
        }
      });
    }, 100);
  }

  attachListeners = () => {
    // ─── SHARED CANVAS TOOLBAR ───
    if (phase === 'canvas') {
      // SPARC Checkpoint Challenge Authoring
      attachSparcAdminListeners(document);

      // Auto-save and exit — no popup
      document.getElementById('btn-toolbar-quit')?.addEventListener('click', async () => {
        if (!storyTitle.trim()) storyTitle = 'Untitled';
        saveDraft();
        try { await saveOfficialStory(buildStory('draft')); } catch {}
        navigate('admin');
      });

      document.getElementById('btn-toolbar-complete')?.addEventListener('click', () => {
        showModal({
          title: 'Mark as Completed?',
          content: '<p style="line-height:1.6;">Would you like to mark this episode as completed? You can always revisit and edit.</p>',
          confirmText: 'Yes',
          cancelText: 'Cancel',
          onConfirm: () => {
            promptSaveStoryAdmin('live');
          },
        });
      });

      // Scroll-hide/show toolbar
      const appContent = document.getElementById('app-content');
      const toolbar = document.getElementById('canvas-toolbar');
      if (appContent && toolbar) {
        let lastScrollY = appContent.scrollTop;
        appContent.addEventListener('scroll', () => {
          const currentY = appContent.scrollTop;
          if (currentY > lastScrollY && currentY > 60) {
            toolbar.classList.add('canvas-toolbar--hidden');
          } else {
            toolbar.classList.remove('canvas-toolbar--hidden');
          }
          lastScrollY = currentY;
        }, { passive: true });
      }
    }

    // â”€â”€â”€ ENDLESS SCROLL CANVAS (CHARACTER SHEET STUDIO) â”€â”€â”€
    if (phase === 'canvas' && selectedFormat === 'scroll') {
      // Cleanup stale popup
      document.getElementById('char-popup-overlay')?.remove();

      // Studio Toggle
      document.getElementById('cs-studio-toggle')?.addEventListener('click', () => {
        studioOpen = !studioOpen;
        updateView();
      });

      // Character Tile Click â€” open popup
      wizard.querySelectorAll('[data-char-idx]').forEach(tile => {
        tile.addEventListener('click', () => {
          activeCharPopup = parseInt(tile.getAttribute('data-char-idx') || '0');
          updateView();
        });
      });

      // Add Character
      document.getElementById('btn-add-character')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (characters.length < 10) {
          const nextLetter = String.fromCharCode(65 + characters.length);
          characters.push({ name: nextLetter, image: null, description: '' });
          updateView();
        }
      });

      // Character Popup — render as portal on document.body
      if (activeCharPopup !== null) {
        const popupIdx = activeCharPopup;
        const char = characters[popupIdx];
        const popupHtml = `
          <div class="char-popup-overlay" id="char-popup-overlay">
            <div class="char-popup">
              <div class="char-popup__header">
                <h3>Character ${char.name}</h3>
                <button id="char-popup-close" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--color-text-muted);">✕</button>
              </div>
              <div class="char-popup__image-area" id="char-popup-image-area">
                ${char.image 
                  ? `<img src="${char.image}" alt="Character ${char.name}" />`
                  : `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--color-text-muted);"><span style="font-size:1.5rem;">📷</span><span style="font-size:0.78rem;">Tap to upload</span></div>`
                }
                <input type="file" id="char-popup-file" accept="image/*" hidden />
              </div>
              <input type="text" class="char-popup__input" id="char-popup-name" placeholder="Character name" value="${char.name}" />
              <textarea class="char-popup__input" id="char-popup-desc" rows="2" placeholder="Describe this character for AI..." style="resize:vertical;">${char.description}</textarea>
              <div class="char-popup__actions">
                <button class="char-popup__btn char-popup__btn--save" id="char-popup-save">Save</button>
              </div>
              ${characters.length > 1 ? `<button class="char-popup__btn char-popup__btn--delete" id="char-popup-delete" style="margin-top:6px;width:100%;">Remove</button>` : ''}
            </div>
          </div>
        `;
        document.body.insertAdjacentHTML('beforeend', popupHtml);

        // Close button
        document.getElementById('char-popup-close')?.addEventListener('click', () => {
          activeCharPopup = null;
          document.getElementById('char-popup-overlay')?.remove();
          updateView();
        });

        // Overlay click (outside popup)
        document.getElementById('char-popup-overlay')?.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).id === 'char-popup-overlay') {
            activeCharPopup = null;
            document.getElementById('char-popup-overlay')?.remove();
            updateView();
          }
        });

        // Image area click — trigger file input
        document.getElementById('char-popup-image-area')?.addEventListener('click', () => {
          (document.getElementById('char-popup-file') as HTMLInputElement)?.click();
        });

        // File input change
        (document.getElementById('char-popup-file') as HTMLInputElement)?.addEventListener('change', async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const dataUrl = await fileToDataUrl(file);
            characters[popupIdx].image = dataUrl;
            document.getElementById('char-popup-overlay')?.remove();
            updateView();
          }
        });

        // Name input
        const nameInput = document.getElementById('char-popup-name') as HTMLInputElement;
        nameInput?.addEventListener('input', () => {
          characters[popupIdx].name = nameInput.value;
        });

        // Description input
        const descInput = document.getElementById('char-popup-desc') as HTMLTextAreaElement;
        descInput?.addEventListener('input', () => {
          characters[popupIdx].description = descInput.value;
        });
        // Save button
        document.getElementById('char-popup-save')?.addEventListener('click', () => {
          activeCharPopup = null;
          document.getElementById('char-popup-overlay')?.remove();
          saveDraft();
          updateView();
        });

        // Delete button
        document.getElementById('char-popup-delete')?.addEventListener('click', () => {
          characters.splice(popupIdx, 1);
          activeCharPopup = null;
          document.getElementById('char-popup-overlay')?.remove();
          updateView();
        });
      }

      // Script Button
      document.getElementById('btn-open-script')?.addEventListener('click', () => {
        showModal({
          title: 'ðŸ“ Script',
          content: `
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:4px;">Upload Script (PDF)</label>
                <div id="script-pdf-zone" style="border:2px dashed var(--color-border); border-radius:12px; padding:20px; text-align:center; cursor:pointer; color:var(--color-text-muted);">
                  ${scriptPdfName ? `ðŸ“„ ${scriptPdfName}` : 'ðŸ“Ž Click to upload PDF'}
                </div>
                <input type="file" id="script-pdf-input" accept=".pdf" hidden />
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:4px;">Or write / paste your script</label>
                <textarea id="script-text-input" rows="8" style="width:100%; box-sizing:border-box; border:1.5px solid var(--color-border); border-radius:10px; padding:10px; font-family:var(--font-body); font-size:0.9rem; resize:vertical; background:var(--color-surface-elevated); color:var(--color-text-primary);" maxlength="5000" placeholder="Paste your story script here (up to 5000 characters)...">${scriptText}</textarea>
                <div style="text-align:right; font-size:0.75rem; color:var(--color-text-muted);">${scriptText.length}/5000</div>
              </div>
            </div>
          `,
          confirmText: 'Save Script',
          cancelText: 'Cancel',
          onConfirm: () => {
            const textarea = document.getElementById('script-text-input') as HTMLTextAreaElement;
            if (textarea) scriptText = textarea.value;
            saveDraft();
          },
        });
        // Wire up PDF zone click
        setTimeout(() => {
          const pdfZone = document.getElementById('script-pdf-zone');
          const pdfInput = document.getElementById('script-pdf-input') as HTMLInputElement;
          pdfZone?.addEventListener('click', () => pdfInput?.click());
          pdfInput?.addEventListener('change', () => {
            if (pdfInput.files?.[0]) {
              scriptPdfName = pdfInput.files[0].name;
              const zone = document.getElementById('script-pdf-zone');
              if (zone) zone.innerHTML = `ðŸ“„ ${scriptPdfName}`;
            }
          });
        }, 100);
      });

      // Trigger Custom Upload button
      wizard.querySelectorAll('[data-trigger-file]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-trigger-file') || '0');
          const fileInput = wizard.querySelector(`[data-file="${idx}"]`) as HTMLInputElement;
          fileInput?.click();
        });
      });

      // Upload click
      wizard.querySelectorAll('[data-upload]').forEach(block => {
        block.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('[data-remove]') || (e.target as HTMLElement).closest('[data-gen-panel-ai]')) return;
          const idx = parseInt(block.getAttribute('data-upload') || '0');
          const input = wizard.querySelector(`[data-file="${idx}"]`) as HTMLInputElement;
          input?.click();
        });

        // Drag and drop
        block.addEventListener('dragover', (e) => { e.preventDefault(); block.classList.add('drag-over'); });
        block.addEventListener('dragleave', () => block.classList.remove('drag-over'));
        block.addEventListener('drop', async (e) => {
          e.preventDefault();
          block.classList.remove('drag-over');
          const idx = parseInt(block.getAttribute('data-upload') || '0');
          const file = (e as DragEvent).dataTransfer?.files[0];
          if (file && file.type.startsWith('image/')) {
            scrollPanels[idx].image = await fileToDataUrl(file);
            updateView();
          }
        });
      });

      // File inputs
      wizard.querySelectorAll('[data-file]').forEach(input => {
        input.addEventListener('change', async () => {
          const idx = parseInt(input.getAttribute('data-file') || '0');
          const file = (input as HTMLInputElement).files?.[0];
          if (file) {
            scrollPanels[idx].image = await fileToDataUrl(file);
            updateView();
          }
        });
      });

      // Remove image (X button on uploaded image)
      wizard.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-remove') || '0');
          scrollPanels[idx].image = null;
          updateView();
        });
      });

      // Notes
      wizard.querySelectorAll('[data-notes]').forEach(ta => {
        const handleNotes = () => {
          const idx = parseInt(ta.getAttribute('data-notes') || '0');
          scrollPanels[idx].notes = (ta as HTMLTextAreaElement).value;
          saveDraft();
        };
        ta.addEventListener('input', handleNotes);
        ta.addEventListener('paste', () => setTimeout(handleNotes, 0));
      });

      // Long-press to delete tile
      wizard.querySelectorAll('[data-longpress]').forEach(row => {
        let pressTimer: ReturnType<typeof setTimeout> | null = null;
        const idx = parseInt(row.getAttribute('data-longpress') || '0');

        const startPress = (e: Event) => {
          if ((e.target as HTMLElement).closest('input, textarea, button, select, [contenteditable="true"]')) return;
          pressTimer = setTimeout(() => {
            pressTimer = null;
            if (scrollPanels.length <= 1) {
              showModal({
                title: 'Cannot Delete',
                content: '<p style="line-height:1.6;">At least one panel must remain in your scroll.</p>',
                confirmText: 'OK',
              });
              return;
            }
            showModal({
              title: 'Delete Panel',
              content: `<p style="line-height:1.6;">Remove <strong>Panel ${idx + 1}</strong> from your scroll? This cannot be undone.</p>`,
              confirmText: 'Delete',
              cancelText: 'Cancel',
              onConfirm: () => {
                scrollPanels.splice(idx, 1);
                updateView();
              },
            });
          }, 600);
        };
        const cancelPress = () => {
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        };

        row.addEventListener('mousedown', startPress);
        row.addEventListener('mouseup', cancelPress);
        row.addEventListener('mouseleave', cancelPress);
        row.addEventListener('touchstart', startPress, { passive: false });
        row.addEventListener('touchend', cancelPress);
        row.addEventListener('touchcancel', cancelPress);
      });

      // Add tile (dotted placeholder)
      document.getElementById('btn-add-tile')?.addEventListener('click', () => {
        scrollPanels.push({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null });
        updateView();
      });

      // Toolbar dropdown toggle (scroll mode)
      const menuBtn = document.getElementById('btn-toolbar-menu');
      const dropdown = document.getElementById('toolbar-dropdown');
      menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
      });
      document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
      });
      document.getElementById('btn-dd-story-settings')?.addEventListener('click', () => { getFormData();
        openStorySettings();
      });
      document.getElementById('btn-dd-add-panel')?.addEventListener('click', () => {
        scrollPanels.push({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null });
        updateView();
      });

      // Panel gear icon clicks â†’ open layout overlay
      document.querySelectorAll('[data-gear-panel]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-gear-panel') || '0');
          panelLayoutOverlay = panelLayoutOverlay === idx ? null : idx;
          updateView();
        });
      });

      // Close layout overlay
      document.querySelectorAll('[data-close-overlay]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          panelLayoutOverlay = null;
          updateView();
        });
      });

      // Layout option selection inside overlay
      document.querySelectorAll('[data-set-layout]').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const layoutId = opt.getAttribute('data-set-layout') || 'single';
          const panelIdx = parseInt(opt.getAttribute('data-for-panel') || '0');
          if (scrollPanels[panelIdx]) {
            const newTileCount = getTileCount(layoutId);
            const oldTiles = scrollPanels[panelIdx].tiles || [scrollPanels[panelIdx].image];
            // Preserve existing tile images, pad with nulls
            const newTiles: (string | null)[] = [];
            for (let t = 0; t < newTileCount; t++) {
              newTiles.push(oldTiles[t] || null);
            }
            scrollPanels[panelIdx].layout = layoutId;
            scrollPanels[panelIdx].tiles = newTiles;
            // Ensure textOverlays array matches tile count
            const oldOverlays = scrollPanels[panelIdx].textOverlays || [[]];
            const newOverlays: TextOverlay[][] = [];
            for (let t = 0; t < newTileCount; t++) {
              newOverlays.push(oldOverlays[t] || []);
            }
            scrollPanels[panelIdx].textOverlays = newOverlays;
            // Keep panel.image in sync with first tile
            scrollPanels[panelIdx].image = newTiles[0];
          }
          panelLayoutOverlay = null;
          updateView();
        });
      });

      // Remove tile image (X button)
      document.querySelectorAll('.panel-tile__remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tileIdx = parseInt(btn.getAttribute('data-remove-tile') || '0');
          const panelIdx = parseInt(btn.getAttribute('data-remove-panel') || '0');
          if (scrollPanels[panelIdx]) {
            if (scrollPanels[panelIdx].tiles) {
              scrollPanels[panelIdx].tiles[tileIdx] = null;
              // Clear text overlays when image is removed
              if (scrollPanels[panelIdx].textOverlays && scrollPanels[panelIdx].textOverlays[tileIdx]) {
                scrollPanels[panelIdx].textOverlays[tileIdx] = [];
              }
            }
            if (tileIdx === 0) scrollPanels[panelIdx].image = null;
          }
          updateView();
        });
      });

// â”€â”€â”€ TEXT OVERLAY HANDLERS â”€â”€â”€
// Add new text overlay
document.querySelectorAll('[data-addtext-tile]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const tileIdx = parseInt(btn.getAttribute('data-addtext-tile') || '0');
    const panelIdx = parseInt(btn.getAttribute('data-addtext-panel') || '0');
    if (!scrollPanels[panelIdx]) return;
    if (!scrollPanels[panelIdx].textOverlays) scrollPanels[panelIdx].textOverlays = [[]];
    while (scrollPanels[panelIdx].textOverlays.length <= tileIdx) scrollPanels[panelIdx].textOverlays.push([]);
    scrollPanels[panelIdx].textOverlays[tileIdx].push({
      id: 'txt-' + Date.now(),
      text: '',
      x: 10,
      y: 40,
      locked: false,
      fontSize: 14,
      color: '#ffffff',
    });
    updateView();
    // Auto-focus the new text box after render
    setTimeout(() => {
      const editables = document.querySelectorAll('.text-overlay--editing .text-overlay__content[contenteditable]');
      const last = editables[editables.length - 1] as HTMLElement;
      if (last) last.focus();
    }, 50);
  });
});

// Commit text overlay (checkmark)
document.querySelectorAll('[data-commit-ov]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ovId = btn.getAttribute('data-commit-ov');
    const panelIdx = parseInt(btn.getAttribute('data-commit-panel') || '0');
    const tileIdx = parseInt(btn.getAttribute('data-commit-tile') || '0');
    const overlays = scrollPanels[panelIdx]?.textOverlays?.[tileIdx];
    if (!overlays) return;
    // Save text content from DOM before committing
    const ovEl = document.querySelector(`[data-ov-id="${ovId}"] .text-overlay__content`) as HTMLElement;
    const ov = overlays.find(o => o.id === ovId);
    if (ov && ovEl) ov.text = ovEl.innerText.trim();
    // Auto-delete empty overlays
    if (ov && !ov.text) {
      scrollPanels[panelIdx].textOverlays[tileIdx] = overlays.filter(o => o.id !== ovId);
    } else if (ov) {
      ov.locked = true;
    }
    updateView();
  });
});

// Delete text overlay
document.querySelectorAll('[data-del-ov]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ovId = btn.getAttribute('data-del-ov');
    const panelIdx = parseInt(btn.getAttribute('data-del-panel') || '0');
    const tileIdx = parseInt(btn.getAttribute('data-del-tile') || '0');
    const overlays = scrollPanels[panelIdx]?.textOverlays?.[tileIdx];
    if (!overlays) return;
    scrollPanels[panelIdx].textOverlays[tileIdx] = overlays.filter(o => o.id !== ovId);
    updateView();
  });
});

// Unlock (edit) locked text overlay
document.querySelectorAll('[data-unlock-ov]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ovId = btn.getAttribute('data-unlock-ov');
    const panelIdx = parseInt(btn.getAttribute('data-unlock-panel') || '0');
    const tileIdx = parseInt(btn.getAttribute('data-unlock-tile') || '0');
    const ov = scrollPanels[panelIdx]?.textOverlays?.[tileIdx]?.find(o => o.id === ovId);
    if (ov) { ov.locked = false; updateView(); }
  });
});

// Double-click locked overlay to re-edit
document.querySelectorAll('.text-overlay--locked').forEach(el => {
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const ovId = el.getAttribute('data-ov-id');
    const panelIdx = parseInt(el.getAttribute('data-ov-panel') || '0');
    const tileIdx = parseInt(el.getAttribute('data-ov-tile') || '0');
    const ov = scrollPanels[panelIdx]?.textOverlays?.[tileIdx]?.find(o => o.id === ovId);
    if (ov) { ov.locked = false; updateView(); }
  });
});

// Drag text overlay
document.querySelectorAll('[data-drag-ov]').forEach(handle => {
  const startDrag = (startX: number, startY: number) => {
    const ovId = handle.getAttribute('data-drag-ov');
    const panelIdx = parseInt(handle.getAttribute('data-drag-panel') || '0');
    const tileIdx = parseInt(handle.getAttribute('data-drag-tile') || '0');
    const ov = scrollPanels[panelIdx]?.textOverlays?.[tileIdx]?.find(o => o.id === ovId);
    if (!ov) return;
    const ovEl = (handle as HTMLElement).closest('.text-overlay') as HTMLElement;
    const tileEl = (handle as HTMLElement).closest('.panel-tile') as HTMLElement;
    if (!ovEl || !tileEl) return;
    const tileRect = tileEl.getBoundingClientRect();
    const startOvX = ov.x;
    const startOvY = ov.y;

    const onMove = (cx: number, cy: number) => {
      const dx = ((cx - startX) / tileRect.width) * 100;
      const dy = ((cy - startY) / tileRect.height) * 100;
      const newX = Math.max(0, Math.min(85, startOvX + dx));
      const newY = Math.max(0, Math.min(90, startOvY + dy));
      ovEl.style.left = newX + '%';
      ovEl.style.top = newY + '%';
      ov.x = newX;
      ov.y = newY;
    };

    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
    const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); onMove(ev.touches[0].clientX, ev.touches[0].clientY); };
    const onEnd = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  };

  handle.addEventListener('mousedown', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const me = e as MouseEvent;
    startDrag(me.clientX, me.clientY);
  });
  handle.addEventListener('touchstart', (e: Event) => {
    e.stopPropagation();
    const te = e as TouchEvent;
    startDrag(te.touches[0].clientX, te.touches[0].clientY);
  }, { passive: true });
});

// Save text content on input (debounced)
document.querySelectorAll('[data-edit-ov]').forEach(el => {
  el.addEventListener('input', () => {
    const ovId = el.getAttribute('data-edit-ov');
    const panelIdx = parseInt(el.getAttribute('data-edit-panel') || '0');
    const tileIdx = parseInt(el.getAttribute('data-edit-tile') || '0');
    const ov = scrollPanels[panelIdx]?.textOverlays?.[tileIdx]?.find(o => o.id === ovId);
    if (ov) ov.text = (el as HTMLElement).innerText;
  });
  // Prevent tile click-to-upload when clicking inside text overlay
  el.addEventListener('click', (e: Event) => e.stopPropagation());
});

// Cycle text overlay color
const TEXT_COLORS = ['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#a855f7', '#ec4899'];
document.querySelectorAll('[data-color-ov]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ovId = btn.getAttribute('data-color-ov');
    const panelIdx = parseInt(btn.getAttribute('data-color-panel') || '0');
    const tileIdx = parseInt(btn.getAttribute('data-color-tile') || '0');
    const ov = scrollPanels[panelIdx]?.textOverlays?.[tileIdx]?.find(o => o.id === ovId);
    if (ov) {
      const idx = TEXT_COLORS.indexOf(ov.color);
      ov.color = TEXT_COLORS[(idx + 1) % TEXT_COLORS.length];
      // Update color in DOM immediately without full re-render
      const ovEl = (btn as HTMLElement).closest('.text-overlay') as HTMLElement;
      if (ovEl) ovEl.style.color = ov.color;
      // Update the color swatch
      const swatch = btn.querySelector('span') as HTMLElement;
      if (swatch) swatch.style.background = ov.color;
    }
  });
});


// Pre-record button for waterfall dialogue
document.querySelectorAll('[data-prerecord-scroll]').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const idx = parseInt(btn.getAttribute('data-prerecord-scroll') || '0');
    const text = scrollPanels[idx]?.notes;
    if (!text || !text.trim()) {
      showModal({ title: 'No Dialogue', content: '<p>Write some dialogue text first before pre-recording.</p>', confirmText: 'OK' });
      return;
    }
    if (scrollPanels[idx].audioUrl) {
      showModal({
        title: 'Re-record Audio',
        content: '<p style="line-height:1.6;">Would you like to re-record the dialogue audio? This will replace the existing recording.</p>',
        confirmText: 'Yes, Re-record',
        cancelText: 'Cancel',
        onConfirm: async () => {
          hideModal();
          await doPrerecordScroll(idx, btn as HTMLButtonElement);
        }
      });
      return;
    }
    await doPrerecordScroll(idx, btn as HTMLButtonElement);
  });
});

async function doPrerecordScroll(idx: number, btn: HTMLButtonElement) {
  const text = scrollPanels[idx].notes;
  const span = btn.querySelector('span');
  btn.setAttribute('disabled', 'true');
  if (span) span.textContent = 'Recording...';
  try {
    const audioUrl = await preRecordAudio(text, 0.5);
    scrollPanels[idx].audioUrl = audioUrl;
    saveDraft();
  } catch (err: any) {
    showModal({ title: 'Pre-record Failed', content: `<p>${err.message || 'Something went wrong.'}</p>`, confirmText: 'OK' });
  } finally {
    btn.removeAttribute('disabled');
    updateView();
  }
}

// Play pre-recorded waterfall audio
document.querySelectorAll('[data-prerecord-play-scroll]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = parseInt(btn.getAttribute('data-prerecord-play-scroll') || '0');
    const audioUrl = scrollPanels[idx]?.audioUrl;
    if (audioUrl) {
      if (isSpeaking()) { stopSpeaking(); } else { playAudioUrl(audioUrl); }
    }
  });
});

      // Tile click to upload (delegate from tile grid)
      document.querySelectorAll('.panel-tile').forEach(tile => {
        tile.addEventListener('click', (e) => {
          const tileIdx = parseInt(tile.getAttribute('data-tile') || '0');
          const panelIdx = parseInt(tile.getAttribute('data-panel') || '0');
          // Create a temporary file input for this specific tile
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.style.display = 'none';
          fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              const url = ev.target?.result as string;
              if (scrollPanels[panelIdx]) {
                if (!scrollPanels[panelIdx].tiles) scrollPanels[panelIdx].tiles = [null];
                scrollPanels[panelIdx].tiles[tileIdx] = url;
                if (tileIdx === 0) scrollPanels[panelIdx].image = url;
              }
              updateView();
            };
            reader.readAsDataURL(file);
          });
          document.body.appendChild(fileInput);
          fileInput.click();
          document.body.removeChild(fileInput);
        });
      });

      // Bottom action buttons
      document.getElementById('btn-save-exit')?.addEventListener('click', async () => {
        if (!storyTitle.trim()) storyTitle = 'Untitled';
        saveDraft();
        try { await saveOfficialStory(buildStory('draft')); } catch {}
        navigate('admin');
      });
      document.getElementById('btn-submit-review')?.addEventListener('click', () => { getFormData();
        openStorySettings();
      });
    }


    // â”€â”€â”€ ILLUSTRATED BOOK CANVAS (single page view) â”€â”€â”€
    if (phase === 'canvas' && selectedFormat === 'book') {
      const i = currentPage;

      // Toolbar dropdown toggle
      const menuBtn = document.getElementById('btn-toolbar-menu');
      const dropdown = document.getElementById('toolbar-dropdown');
      menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
      });
      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
      });

      // Dropdown actions
      document.getElementById('btn-dd-story-settings')?.addEventListener('click', () => { getFormData();
        openStorySettings();
      });
      document.getElementById('btn-dd-add-page')?.addEventListener('click', () => {
        bookPages.push(defaultBookPage());
        currentPage = bookPages.length - 1;
        updateView();
      });
      const handleOpenStoryboard = () => {
        if (isDesktopScreen()) {
          activeEditorMode = 'storyboard';
          openStoryboard();
        } else {
          showDesktopRequiredModal();
        }
      };
      document.getElementById('btn-toolbar-switch-storyboard')?.addEventListener('click', handleOpenStoryboard);
      document.getElementById('btn-dd-storyboard')?.addEventListener('click', handleOpenStoryboard);

      // Arrow navigation
      document.getElementById('btn-book-prev')?.addEventListener('click', () => {
        if (currentPage > 0) { currentPage--; updateView(); }
      });
      document.getElementById('btn-book-next')?.addEventListener('click', () => {
        if (currentPage < bookPages.length - 1) { currentPage++; updateView(); }
      });

      // Page dots click
      wizard.querySelectorAll('[data-dot]').forEach(dot => {
        dot.addEventListener('click', () => {
          currentPage = parseInt(dot.getAttribute('data-dot') || '0');
          updateView();
        });
      });

      // Upload click
      const uploadArea = wizard.querySelector(`[data-tile-upload="${i}"]`);
      uploadArea?.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('[data-tile-remove-img]') || (e.target as HTMLElement).closest('[data-tile-redo]')) return;
        const input = wizard.querySelector(`[data-tile-file="${i}"]`) as HTMLInputElement;
        input?.click();
      });

      // File change
      const fileInput = wizard.querySelector(`[data-tile-file="${i}"]`) as HTMLInputElement;
      fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (file) {
          const res = await uploadMedia(file, 'stories');
          bookPages[i].image = res.url;
          updateView();
        }
      });

      // Remove image
      wizard.querySelector(`[data-tile-remove-img="${i}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        bookPages[i].image = null;
        updateView();
      });

      // Focal position selector
      wizard.querySelectorAll(`[data-set-focal="${i}"]`).forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = (btn as HTMLElement).getAttribute('data-focal-val') as 'top' | 'center' | 'bottom';
          bookPages[i].focalPosition = val;
          saveDraft();
          updateView();
        });
      });

      // Save story text
      const tileText = wizard.querySelector(`[data-tile-text="${i}"]`) as HTMLTextAreaElement | null;
      const handleTileText = () => {
        if (tileText) bookPages[i].text = tileText.value;
        saveDraft();
      };
      tileText?.addEventListener('input', handleTileText);
      tileText?.addEventListener('paste', () => setTimeout(handleTileText, 0));

      // Wire multi-character dialogue line events for mobile canvas
      wireDialogueLineEvents(wizard, 'mob', () => updateView());

      // --- Simple Audio Upload handlers ---
      // Upload trigger
      wizard.querySelectorAll('[data-audio-upload-trigger]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).getAttribute('data-audio-upload-trigger') || '0');
          const fileInput = wizard.querySelector(`[data-audio-file="${idx}"]`) as HTMLInputElement;
          fileInput?.click();
        });
      });
      // Replace trigger
      wizard.querySelectorAll('[data-audio-replace]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).getAttribute('data-audio-replace') || '0');
          const fileInput = wizard.querySelector(`[data-audio-file="${idx}"]`) as HTMLInputElement;
          fileInput?.click();
        });
      });
      // File input change
      wizard.querySelectorAll('[data-audio-file]').forEach(input => {
        input.addEventListener('change', async () => {
          const idx = parseInt((input as HTMLElement).getAttribute('data-audio-file') || '0');
          const file = (input as HTMLInputElement).files?.[0];
          if (!file) return;
          try {
            const storyId = editStoryId || activeDraftId || 'draft';
            // Extract audio track if video was uploaded
            const extracted = await extractAudioFromMediaFile(file);
            const cdnUrl = await uploadAudioData(extracted.blob, storyId, 'page_' + idx);
            bookPages[idx].audioUrl = cdnUrl;
            bookPages[idx].audioFileName = extracted.fileName;
            saveDraft();
            updateView();
          } catch (err: any) {
            console.error('Audio upload failed:', err);
            alert('Audio upload failed: ' + (err?.message || 'Unknown error'));
          }
        });
      });
      // Pre-load audio duration for preview
      wizard.querySelectorAll('[data-audio-duration]').forEach(durSpan => {
        const idx = parseInt(durSpan.getAttribute('data-audio-duration') || '0');
        const url = bookPages[idx]?.audioUrl;
        if (url) {
          const preAudio = new Audio(url);
          preAudio.addEventListener('loadedmetadata', () => {
            if (preAudio.duration && !isNaN(preAudio.duration)) {
              durSpan.textContent = formatTime(preAudio.duration);
            }
          });
        }
      });

      // Play / Pause with scrubber sync
      wizard.querySelectorAll('[data-audio-play]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).getAttribute('data-audio-play') || '0');
          const url = bookPages[idx]?.audioUrl;
          if (!url) return;

          const playBtn = btn as HTMLButtonElement;
          const slider = wizard.querySelector(`[data-audio-scrubber="${idx}"]`) as HTMLInputElement | null;
          const curSpan = wizard.querySelector(`[data-audio-current="${idx}"]`);
          const durSpan = wizard.querySelector(`[data-audio-duration="${idx}"]`);

          if (isSpeaking()) {
            stopSpeaking();
            playBtn.textContent = '▶ Play';
          } else {
            playBtn.textContent = '⏸ Pause';
            playAudioUrl(
              url,
              () => {
                playBtn.textContent = '▶ Play';
                if (slider) slider.value = '0';
                if (curSpan) curSpan.textContent = '0:00';
              },
              (current, duration) => {
                if (slider && duration > 0) {
                  slider.value = ((current / duration) * 100).toFixed(1);
                }
                if (curSpan) curSpan.textContent = formatTime(current);
                if (durSpan && duration > 0) durSpan.textContent = formatTime(duration);
              }
            );
          }
        });
      });

      // Restart from start
      wizard.querySelectorAll('[data-audio-restart]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).getAttribute('data-audio-restart') || '0');
          const url = bookPages[idx]?.audioUrl;
          if (!url) return;

          const playBtn = wizard.querySelector(`[data-audio-play="${idx}"]`) as HTMLButtonElement | null;
          const slider = wizard.querySelector(`[data-audio-scrubber="${idx}"]`) as HTMLInputElement | null;
          const curSpan = wizard.querySelector(`[data-audio-current="${idx}"]`);
          const durSpan = wizard.querySelector(`[data-audio-duration="${idx}"]`);

          stopSpeaking();
          if (playBtn) playBtn.textContent = '⏸ Pause';
          if (slider) slider.value = '0';
          if (curSpan) curSpan.textContent = '0:00';

          playAudioUrl(
            url,
            () => {
              if (playBtn) playBtn.textContent = '▶ Play';
              if (slider) slider.value = '0';
              if (curSpan) curSpan.textContent = '0:00';
            },
            (current, duration) => {
              if (slider && duration > 0) {
                slider.value = ((current / duration) * 100).toFixed(1);
              }
              if (curSpan) curSpan.textContent = formatTime(current);
              if (durSpan && duration > 0) durSpan.textContent = formatTime(duration);
            }
          );
        });
      });

      // Scrubber range input seeking
      wizard.querySelectorAll('[data-audio-scrubber]').forEach(slider => {
        const inputEl = slider as HTMLInputElement;
        const idx = parseInt(inputEl.getAttribute('data-audio-scrubber') || '0');

        inputEl.addEventListener('input', () => {
          const audio = getCurrentAudio();
          const curSpan = wizard.querySelector(`[data-audio-current="${idx}"]`);
          const durSpan = wizard.querySelector(`[data-audio-duration="${idx}"]`);
          const duration = audio?.duration || 0;
          const targetTime = (parseFloat(inputEl.value) / 100) * duration;

          seekAudio(targetTime);
          if (curSpan) curSpan.textContent = formatTime(targetTime);
          if (durSpan && duration > 0) durSpan.textContent = formatTime(duration);
        });
      });
      // Remove
      wizard.querySelectorAll('[data-audio-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt((btn as HTMLElement).getAttribute('data-audio-remove') || '0');
          bookPages[idx].audioUrl = null;
          bookPages[idx].audioFileName = null;
          saveDraft();
          updateView();
        });
      });
      // Manual captions
      wizard.querySelectorAll('[data-simple-captions]').forEach(ta => {
        const handler = () => {
          const idx = parseInt((ta as HTMLElement).getAttribute('data-simple-captions') || '0');
          bookPages[idx].dialogText = (ta as HTMLTextAreaElement).value;
          saveDraft();
        };
        ta.addEventListener('input', handler);
        ta.addEventListener('paste', () => setTimeout(handler, 0));
      });

      // Pre-record Audio for book page
      const doPrerecordBookPage = async (pageIdx: number) => {
        const text = (bookPages[pageIdx].dialogText || bookPages[pageIdx].text || '').trim();
        const btn = wizard?.querySelector(`[data-prerecord-book="${pageIdx}"]`) as HTMLButtonElement | null;
        const span = btn?.querySelector('span');
        if (btn) btn.setAttribute('disabled', 'true');
        if (span) span.textContent = 'Recording...';
        try {
          const audioUrl = await preRecordAudio(text, bookPages[pageIdx].stability ?? 0.5);
          bookPages[pageIdx].audioUrl = audioUrl;
          saveDraft();
        } catch (err: any) {
          console.error('[Pre-record] Failed:', err);
          showModal({ title: 'Pre-record Failed', content: `<p>${err.message || 'Something went wrong.'}</p>`, confirmText: 'OK' });
        } finally {
          if (btn) btn.removeAttribute('disabled');
          updateView();
        }
      };

      wizard.querySelector(`[data-prerecord-book="${i}"]`)?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = (bookPages[i].dialogText || bookPages[i].text || '').trim();
        if (!text) {
          showModal({ title: 'No Dialogue or Story Text', content: '<p>Write some dialogue or story text first before pre-recording.</p>', confirmText: 'OK' });
          return;
        }
        if (bookPages[i].audioUrl) {
          showModal({
            title: 'Re-record Audio',
            content: '<p style="line-height:1.6;">Would you like to re-record the audio? This will replace the existing recording.</p>',
            confirmText: 'Yes, Re-record',
            cancelText: 'Cancel',
            onConfirm: async () => {
              hideModal();
              await doPrerecordBookPage(i);
            }
          });
          return;
        }
        await doPrerecordBookPage(i);
      });

      // Play pre-recorded book audio
      wizard.querySelector(`[data-prerecord-play-book="${i}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioUrl = bookPages[i]?.audioUrl;
        if (audioUrl) {
          if (isSpeaking()) { stopSpeaking(); } else { playAudioUrl(audioUrl); }
        }
      });

      // Deeper Dive toggle
      wizard.querySelector(`[data-tile-dd-toggle="${i}"]`)?.addEventListener('click', (e) => {
        e.preventDefault();
        const panel = wizard.querySelector(`[data-tile-dd-panel="${i}"]`) as HTMLElement;
        const chevron = (e.currentTarget as HTMLElement).querySelector('.book-tile__dd-chevron') as HTMLElement;
        if (panel) {
          const isOpen = panel.style.display !== 'none';
          panel.style.display = isOpen ? 'none' : 'block';
          if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
        }
      });

      // Deeper Dive content
      const tileDd = wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement | null;
      const handleTileDd = () => {
        if (tileDd) bookPages[i].deeperDiveContent = tileDd.value;
        saveDraft();
      };
      tileDd?.addEventListener('input', handleTileDd);
      tileDd?.addEventListener('paste', () => setTimeout(handleTileDd, 0));



      // Page Reordering & Duplication
      wizard.querySelector(`[data-page-move-up="${i}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (i <= 0) return;
        const textEl = wizard.querySelector(`[data-tile-text="${i}"]`) as HTMLTextAreaElement | null;
        if (textEl) bookPages[i].text = textEl.value;
        const ddEl = wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement | null;
        if (ddEl) bookPages[i].deeperDiveContent = ddEl.value;

        const temp = bookPages[i];
        bookPages[i] = bookPages[i - 1];
        bookPages[i - 1] = temp;
        currentPage = i - 1;
        saveDraft();
        updateView();
      });

      wizard.querySelector(`[data-page-move-down="${i}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (i >= bookPages.length - 1) return;
        const textEl = wizard.querySelector(`[data-tile-text="${i}"]`) as HTMLTextAreaElement | null;
        if (textEl) bookPages[i].text = textEl.value;
        const ddEl = wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement | null;
        if (ddEl) bookPages[i].deeperDiveContent = ddEl.value;

        const temp = bookPages[i];
        bookPages[i] = bookPages[i + 1];
        bookPages[i + 1] = temp;
        currentPage = i + 1;
        saveDraft();
        updateView();
      });

      wizard.querySelector(`[data-page-duplicate="${i}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        const textEl = wizard.querySelector(`[data-tile-text="${i}"]`) as HTMLTextAreaElement | null;
        if (textEl) bookPages[i].text = textEl.value;
        const ddEl = wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement | null;
        if (ddEl) bookPages[i].deeperDiveContent = ddEl.value;

        const src = bookPages[i];
        const clonedDialogue = (src.dialogueLines || []).map(line => ({
          ...line,
          id: 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        }));
        const clonedPage: BookPage = {
          ...src,
          dialogueLines: clonedDialogue,
        };
        bookPages.splice(i + 1, 0, clonedPage);
        currentPage = i + 1;
        saveDraft();
        updateView();
      });

      // Maximize
      wizard.querySelector(`[data-tile-maximize="${i}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        openPageFullscreen(i);
      });

      // Long-press to delete
      const tile = wizard.querySelector(`[data-book-longpress="${i}"]`);
      if (tile) {
        let pressTimer: ReturnType<typeof setTimeout> | null = null;
        const startPress = (e: Event) => {
          if ((e.target as HTMLElement).closest('input, textarea, button, select, [contenteditable="true"]')) return;
          pressTimer = setTimeout(() => {
            pressTimer = null;
            if (bookPages.length <= 1) {
              showModal({ title: 'Cannot Delete', content: '<p style="line-height:1.6;">At least one page must remain.</p>', confirmText: 'OK' });
              return;
            }
            showModal({
              title: 'Delete Page',
              content: `<p style="line-height:1.6;">Remove <strong>Page ${i + 1}</strong>? This cannot be undone.</p>`,
              confirmText: 'Delete', cancelText: 'Cancel',
              onConfirm: () => { bookPages.splice(i, 1); if (currentPage >= bookPages.length) currentPage = bookPages.length - 1; updateView(); },
            });
          }, 600);
        };
        const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        tile.addEventListener('mousedown', startPress);
        tile.addEventListener('mouseup', cancelPress);
        tile.addEventListener('mouseleave', cancelPress);
        tile.addEventListener('touchstart', startPress, { passive: true });
        tile.addEventListener('touchend', cancelPress);
        tile.addEventListener('touchcancel', cancelPress);
      }
    }
  };

  // Run attachListeners after render
  attachListeners();

  // Auto-save every 15 seconds
  const autoSaveInterval = setInterval(() => {
    getFormData();
    saveDraft();
  }, 15000);

  // Save on page unload
  const handleBeforeUnload = () => {
    getFormData();
    saveDraft();
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Cleanup on navigation away
  const handleHashChange = () => {
    getFormData();
    saveDraft();
    clearInterval(autoSaveInterval);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('hashchange', handleHashChange);
  };
  window.addEventListener('hashchange', handleHashChange, { once: true });
}
