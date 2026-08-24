import type { StoryFormat, Genre, UserStory } from '../types.ts';
import { genres } from '../data/stories.ts';
import { addUserStory, getUserStories, isLibraryUnlocked, canCreateStory, getTokensRemaining, getUserPlan, consumeToken } from '../state.ts';
import { navigate, getRouteParam } from '../router.ts';
import { showModal, hideModal } from '../components/modal.ts';
import { generateImage } from '../lib/image-gen.ts';
import { speakText, stopSpeaking, isSpeaking, preRecordAudio, playAudioUrl } from '../lib/tts.ts';
import { cleanUpText } from '../lib/groq.ts';



type CreatePhase = 'landing' | 'format' | 'guide' | 'canvas' | 'details';

let phase: CreatePhase = 'format';
let selectedFormat: StoryFormat | null = null;
let storyTitle = '';
let storyGenre: Genre = 'Fantasy';
let storySynopsis = '';
let storyHashtags = '';
let storyMediaType: 'static' | 'animated' = 'static';
let storyAuthorName = '';
let storyCustomGenre = '';
let storyContentRating: 'All Ages' | 'PG-13' | 'Mature' = 'All Ages';

// Endless Scroll state
interface TextOverlay {
  id: string;
  text: string;
  x: number;        // position as % from left (0-100)
  y: number;        // position as % from top (0-100)
  locked: boolean;
  fontSize: number;  // px
  color: string;
}

interface ScrollPanel {
  image: string | null;
  notes: string;
  layout: string;
  tiles: (string | null)[];
  textOverlays: TextOverlay[][];  // array per tile index
  audioUrl: string | null;        // pre-recorded ElevenLabs audio
}
let scrollPanels: ScrollPanel[] = [
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null },
];
let scrollPrompts: string[] = ['', '', '', '', ''];
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
let generatingPanelIdx: number | null = null;
let selectedLayout: string = 'single';
let layoutPickerOpen = false;
let panelLayoutOverlay: number | null = null; // which panel has layout overlay open
let selectedGenTile: Record<number, number | null> = {}; // per-panel selected tile for generation
let promptActivePanel: number | null = null; // which panel's prompt input is active (has text)

// Illustrated Book state
interface BookPage {
  image: string | null;
  text: string;
  stability: number;
  deeperDiveContent: string;
  audioUrl: string | null;  // pre-recorded ElevenLabs audio
  dialogText: string;
  dialogAudioUrl: string | null;
}
const defaultBookPage = (): BookPage => ({ image: null, text: '', stability: 0.5, deeperDiveContent: '', audioUrl: null, dialogText: '', dialogAudioUrl: null });
let bookPages: BookPage[] = [
  defaultBookPage(), defaultBookPage(), defaultBookPage(),
  defaultBookPage(), defaultBookPage(),
];
let bookPrompts: string[] = ['', '', '', '', '']; // Track last prompt per page
let currentPage = 0;
let isGenerating = false;
let generatingTileIndex: number | null = null;
let activeDraftId: string | null = null;
let _coverThumbnail: string | null = null;
let storyCoverVideo: string = '';

function isVideoMedia(url?: string | null, vidUrl?: string | null): boolean {
  const target = vidUrl || url;
  if (!target) return false;
  if (target.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(target);
}

// ─── SVG Icons ───
const ICON = {
  scroll: `<svg width="40" height="40" viewBox="0 0 48 48" fill="none"><rect x="12" y="4" width="24" height="40" rx="4" stroke="currentColor" stroke-width="2.5"/><line x1="18" y1="14" x2="30" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="26" x2="26" y2="26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="32" x2="30" y2="32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M24 38v4M24 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/></svg>`,
  book: `<svg width="40" height="40" viewBox="0 0 48 48" fill="none"><path d="M6 8c0-2 2-4 6-4h6c4 0 6 2 6 2s2-2 6-2h6c4 0 6 2 6 4v28c0 2-2 4-6 4h-6c-4 0-6 2-6 2s-2-2-6-2h-6c-4 0-6-2-6-4V8z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 6v34" stroke="currentColor" stroke-width="2"/></svg>`,
  comic: `<svg width="40" height="40" viewBox="0 0 48 48" fill="none"><rect x="4" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2.5"/><rect x="26" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2.5"/><rect x="4" y="26" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2.5"/><rect x="26" y="26" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2.5"/></svg>`,
  chevLeft: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>`,
  upload: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  sparkle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>`,
  add: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  redo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  collapse: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="4" x2="21" y2="11"/><line x1="3" y1="20" x2="10" y2="14"/></svg>`,
  speaker: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  // Canvas toolbar icons
  backArrow: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  checkSave: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  dots: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`,
};

// ─── Helpers ───

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

// ─── DRAFT PERSISTENCE (multi-draft) ───

interface DraftEntry {
  id: string;
  phase: CreatePhase;
  selectedFormat: StoryFormat | null;
  storyTitle: string;
  storyGenre: Genre;
  storySynopsis: string;
  storyHashtags?: string;
  storyMediaType?: 'static' | 'animated';
  storyAuthorName?: string;
  storyCustomGenre?: string;
  storyContentRating?: 'All Ages' | 'PG-13' | 'Mature';
  coverThumbnail?: string | null;
  storyCoverVideo?: string;
  scrollPanels: { image: string | null; notes: string }[];
  scrollPrompts?: string[];
  characterRefUrls?: any;
  characterNotes?: any;
  characters?: StudioCharacter[];
  scriptText?: string;
  studioOpen?: boolean;
  bookPages: BookPage[];
  bookPrompts: string[];
  currentPage: number;
  updatedAt: string;
}

function getAllDrafts(): DraftEntry[] {
  try {
    const data = localStorage.getItem('drive_create_drafts');
    if (!data) return [];
    return JSON.parse(data) as DraftEntry[];
  } catch {
    return [];
  }
}

function saveAllDrafts(drafts: DraftEntry[]) {
  try {
    localStorage.setItem('drive_create_drafts', JSON.stringify(drafts));
  } catch (e) {
    console.warn('Failed to save drafts to localStorage (quota exceeded?)', e);
  }
}

function saveDraft() {
  if (phase === 'landing') return;
  if (phase === 'format' && !selectedFormat) return;
  if (phase === 'guide' && !selectedFormat) return;
  if (!activeDraftId) {
    activeDraftId = 'draft-' + Date.now();
  }
  const entry: DraftEntry = {
    id: activeDraftId,
    phase,
    selectedFormat,
    storyTitle,
    storyGenre,
    storySynopsis,
    storyHashtags,
    storyMediaType,
    storyAuthorName,
    storyCustomGenre,
    storyContentRating,
    coverThumbnail: _coverThumbnail,
    storyCoverVideo,
    scrollPanels,
    scrollPrompts,
    characterRefUrls: undefined as any,
    characterNotes: undefined as any,
    characters,
    scriptText,
    studioOpen,
    bookPages,
    bookPrompts,
    currentPage,
    updatedAt: new Date().toISOString(),
  };
  const drafts = getAllDrafts();
  const idx = drafts.findIndex(d => d.id === activeDraftId);
  if (idx >= 0) {
    drafts[idx] = entry;
  } else {
    drafts.unshift(entry);
  }
  saveAllDrafts(drafts);
}

function loadDraft(draftId: string): boolean {
  try {
    const drafts = getAllDrafts();
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return false;
    activeDraftId = draft.id;
    phase = draft.phase === 'landing' ? 'format' : draft.phase;
    selectedFormat = draft.selectedFormat;
    storyTitle = draft.storyTitle || '';
    storyGenre = draft.storyGenre || 'Fantasy';
    storySynopsis = draft.storySynopsis || '';
    storyHashtags = (draft as any).storyHashtags || '';
    storyMediaType = (draft as any).storyMediaType || 'static';
    storyAuthorName = (draft as any).storyAuthorName || '';
    storyCustomGenre = (draft as any).storyCustomGenre || '';
    storyContentRating = (draft as any).storyContentRating || 'All Ages';
    _coverThumbnail = (draft as any).coverThumbnail || null;
    storyCoverVideo = (draft as any).storyCoverVideo || '';
    scrollPanels = (draft.scrollPanels || Array.from({ length: 5 }, () => ({ image: null, notes: '' }))).map((p: any) => ({
      image: p.image || null,
      notes: p.notes || '',
      layout: p.layout || 'single',
      tiles: p.tiles || [p.image || null],
      textOverlays: p.textOverlays || [[]],
      audioUrl: p.audioUrl || null,
    }));
    scrollPrompts = draft.scrollPrompts || Array.from({ length: scrollPanels.length }, () => '');
    characters = draft.characters || [
      { name: 'A', image: null, description: '' },
      { name: 'B', image: null, description: '' },
      { name: 'C', image: null, description: '' },
    ];
    scriptText = draft.scriptText || '';
    studioOpen = draft.studioOpen || false;
    bookPages = draft.bookPages || Array.from({ length: 5 }, () => defaultBookPage());
    bookPrompts = draft.bookPrompts || ['', '', '', '', ''];
    currentPage = draft.currentPage || 0;
    return true;
  } catch (e) {
    return false;
  }
}

function clearDraft(draftId?: string) {
  if (!draftId && activeDraftId) draftId = activeDraftId;
  if (!draftId) return;
  const drafts = getAllDrafts().filter(d => d.id !== draftId);
  saveAllDrafts(drafts);
  if (activeDraftId === draftId) activeDraftId = null;
  // Clear session state so next visit starts fresh
  sessionStorage.removeItem('drive_create_phase');
  sessionStorage.removeItem('drive_create_format');
  sessionStorage.removeItem('drive_create_draft_id');
}

// ═══════════════════════════════════════
//  FORMAT SELECTION
// ═══════════════════════════════════════

function renderFormatSelection(): string {
  // Gate: must have a paid plan to create
  if (!isLibraryUnlocked()) {
    return `
      <div class="create-phase fade-in" style="text-align:center; padding:3rem 1.5rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
        <h2 class="create-phase__title" style="margin-bottom:0.5rem;">Purchase Required</h2>
        <p class="create-phase__desc" style="max-width:280px; margin:0 auto 1.5rem;">You need a plan to create stories. Head to your Library to choose a plan and start creating!</p>
        <button class="create-btn create-btn--primary" id="btn-go-library" style="max-width:200px; margin:0 auto;">Go to Library</button>
      </div>
    `;
  }

  // Gate: starter users need tokens
  if (!canCreateStory()) {
    return `
      <div class="create-phase fade-in" style="text-align:center; padding:3rem 1.5rem;">
        <div style="font-size:3rem; margin-bottom:1rem;">🎟️</div>
        <h2 class="create-phase__title" style="margin-bottom:0.5rem;">No Tokens Left</h2>
        <p class="create-phase__desc" style="max-width:280px; margin:0 auto 1.5rem;">You've used all your story tokens. Visit your Library to purchase more or upgrade to the Creator plan for unlimited stories.</p>
        <button class="create-btn create-btn--primary" id="btn-go-library" style="max-width:200px; margin:0 auto;">Go to Library</button>
      </div>
    `;
  }

  const formats = [
    {
      id: 'scroll', title: 'Waterfall Storyboard', subtitle: 'Upload & generate panels',
      desc: 'Create vertical panel stories with AI and character continuity.',
      icon: ICON.scroll, accent: 'var(--color-blue)',
    },
    {
      id: 'book', title: 'Illustrated Book', subtitle: 'AI-powered pages',
      desc: 'Generate illustrations with AI for each page. Add story text below each image.',
      icon: ICON.book, accent: 'var(--color-purple)',
    },
    {
      id: 'comic', title: 'Comic Strip', subtitle: 'Coming soon',
      desc: 'Dynamic multi-panel grids for action-packed stories. Stay tuned!',
      icon: ICON.comic, accent: 'var(--color-pink)', disabled: true,
    },
  ];

  return `
    <div class="create-phase fade-in">
      <button class="create-back-btn" id="btn-format-back" style="display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:var(--color-text-muted); font-family:var(--font-heading); font-size:0.85rem; font-weight:600; padding:0; margin-bottom:var(--space-md);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div class="create-phase__header">
        <h2 class="create-phase__title">Choose Your Format</h2>
        <p class="create-phase__desc">How should readers experience your story?</p>
      </div>
      <div class="create-formats">
        ${formats.map(f => `
          <button class="create-format-card ${selectedFormat === f.id ? 'selected' : ''} ${(f as any).disabled ? 'disabled-card' : ''}"
                  data-format="${f.id}" ${(f as any).disabled ? 'disabled' : ''}>
            <div class="create-format-card__icon" style="color: ${f.accent}">${f.icon}</div>
            <div class="create-format-card__body">
              <h3 class="create-format-card__title">${f.title}</h3>
              <span class="create-format-card__subtitle">${f.subtitle}</span>
              <p class="create-format-card__desc">${f.desc}</p>
            </div>
            <div class="create-format-card__check ${selectedFormat === f.id ? 'visible' : ''}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </button>
        `).join('')}
      </div>
      <button class="create-btn create-btn--primary" id="btn-format-next" ${!selectedFormat ? 'disabled' : ''}>Continue</button>
    </div>
  `;
}

// ═══════════════════════════════════════
//  CANVAS TOOLBAR (sticky header)
// ═══════════════════════════════════════

const layoutOptions = [
  { id: 'single', label: 'Single', cells: '<rect x="8" y="4" width="32" height="40" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2-stack', label: '2 Stack', cells: '<rect x="8" y="4" width="32" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="8" y="26" width="32" height="18" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2-side', label: '2 Side', cells: '<rect x="4" y="6" width="18" height="36" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="6" width="18" height="36" rx="3" fill="currentColor" opacity="0.25"/>'},
  { id: '2x2', label: '2\\u00d72', cells: '<rect x="4" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="4" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="4" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/><rect x="26" y="26" width="18" height="18" rx="3" fill="currentColor" opacity="0.25"/>'},
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

function renderTileGrid(panelIndex: number, layout: string, tiles: (string | null)[], isGenerating: boolean, generatingTile: number = 0): string {
  const count = getTileCount(layout);
  
  // Ensure tiles array has enough entries
  while (tiles.length < count) tiles.push(null);

  // Show checkboxes when prompt is active for this panel
  const showCheckboxes = promptActivePanel === panelIndex && count > 1;
  const selTile = selectedGenTile[panelIndex] ?? null;
  
  const renderSingleTile = (tileIdx: number) => {
    const tileImage = tiles[tileIdx];
    const isSelected = selTile === tileIdx;

    // Checkbox HTML (shown when user is typing in prompt)
    const checkboxHtml = showCheckboxes ? `
      <label class="tile-select-cb${isSelected ? ' tile-select-cb--checked' : ''}" data-select-tile="${tileIdx}" data-select-panel="${panelIndex}">
        <span class="tile-select-cb__box">${isSelected ? '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><polyline points="3 8 7 12 13 4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>
      </label>
    ` : '';

    if (isGenerating && tileIdx === generatingTile) {
      return `
        <div class="panel-tile" data-tile="${tileIdx}" data-panel="${panelIndex}">
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--color-purple);">
            <div class="beta-spinner" style="margin-bottom:8px;"></div>
            <span style="font-family:var(--font-heading); font-size:0.78rem; font-weight:700;">Generating...</span>
          </div>
        </div>
      `;
    }
    if (tileImage) {
      // Get text overlays for this tile
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
        <div class="panel-tile panel-tile--filled${isSelected && showCheckboxes ? ' panel-tile--selected' : ''}" data-tile="${tileIdx}" data-panel="${panelIndex}">
          ${checkboxHtml}
          <img src="${tileImage}" alt="Tile ${tileIdx + 1}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" />
          <button class="panel-tile__add-text" data-addtext-tile="${tileIdx}" data-addtext-panel="${panelIndex}" type="button" title="Add text">T</button>
          <button class="panel-tile__remove" data-remove-tile="${tileIdx}" data-remove-panel="${panelIndex}" type="button" title="Remove image">&times;</button>
          ${overlayHtml}
        </div>
      `;
    }
    return `
      <div class="panel-tile${isSelected && showCheckboxes ? ' panel-tile--selected' : ''}" data-tile="${tileIdx}" data-panel="${panelIndex}">
        ${checkboxHtml}
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
  const isBook = formatLabel === 'Illustrated Book';
  
  return `
    <div class="canvas-toolbar" id="canvas-toolbar">
      <div class="canvas-toolbar__left">
        <button class="canvas-toolbar__btn" id="btn-toolbar-quit" title="Quit without saving">
          ${ICON.backArrow}
        </button>
      </div>
      <span class="canvas-toolbar__title">${formatLabel}</span>
      <div class="canvas-toolbar__right" style="position:relative;">
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
            <button class="canvas-toolbar__dd-item" id="btn-dd-storyboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Storyboard View
            </button>
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

// ═══════════════════════════════════════
//  WATERFALL STORYBOARD CANVAS
// ═══════════════════════════════════════

function renderScrollCanvas(): string {
  const filledCount = characters.filter(c => c.image).length;

  return `
    <div class="create-phase create-phase--canvas fade-in">
      ${renderStudioOrbs()}
      ${renderCanvasToolbar('Waterfall Storyboard')}

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
          <button class="cs-script-btn" id="btn-open-script" type="button">📝 Script</button>
        </div>
      </div>

      <!-- ─── PANELS LIST ─── -->
      <div class="create-canvas">
        ${scrollPanels.map((panel, i) => {
          const promptVal = scrollPrompts[i] || '';
          const isGeneratingThisPanel = generatingPanelIdx === i;

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
                ${renderTileGrid(i, panel.layout || 'single', panel.tiles || [panel.image], isGeneratingThisPanel, selectedGenTile[i] ?? 0)}
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

              <!-- AI Visual Prompt & Controls -->
              <div class="panel-ai-controls">
                <label style="font-family:var(--font-heading); font-size:0.78rem; font-weight:600; color:var(--color-text-muted);">
                  Visual prompt
                </label>
                <input type="text" class="panel-prompt-input" data-panel-prompt="${i}" 
                  placeholder="Describe what happens in Panel ${i + 1}..." 
                  value="${promptVal}" />
                
                <div style="display:flex; gap:8px;">
                  <button type="button" class="panel-ai-btn" data-gen-panel-ai="${i}" style="flex:1;" ${isGeneratingThisPanel ? 'disabled' : ''}>
                    ${isGeneratingThisPanel ? 'Generating...' : 'Generate'}
                  </button>
                  <button type="button" class="create-btn create-btn--secondary" data-trigger-file="${i}" style="padding:6px 12px; font-size:0.8rem;">
                    Upload
                  </button>
                </div>
              </div>

              <!-- Dialogue / Speech Bubble Notes -->
              <div class="create-annotation" style="margin-top:4px;">
                <label style="font-family:var(--font-heading); font-size:0.78rem; font-weight:600; color:var(--color-text-muted); display:block; margin-bottom:4px;">
                  Dialogue
                </label>
                <div>
                  <textarea class="create-annotation__inline" data-notes="${i}"
                    placeholder="Add dialogue..."
                    rows="2" style="width:100%; box-sizing:border-box;">${panel.notes}</textarea>
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

// ═══════════════════════════════════════
//  ILLUSTRATED BOOK CANVAS (AI Powered)
// ═══════════════════════════════════════

function renderBookCanvas(): string {
  // Clamp currentPage
  if (currentPage < -1) currentPage = -1;
  if (currentPage >= bookPages.length) currentPage = bookPages.length - 1;

  // Generate dots (-1 is the cover/settings page)
  let dotsHtml = '';
  for (let i = -1; i < bookPages.length; i++) {
    dotsHtml += `<div class="book-dot${i === currentPage ? ' book-dot--active' : ''}" data-dot="${i}"></div>`;
  }

  let cardHtml = '';
  if (currentPage === -1) {
    // ─── PAGE 0: STORY SETTINGS ───
    cardHtml = `
      <div class="book-tile book-tile--single">
        <div class="book-tile__header" style="justify-content: center; padding: 16px;">
          <span class="book-tile__label" style="font-size:0.8rem;">PAGE 0: STORY SETTINGS</span>
        </div>
        <div style="padding: 20px; display:flex; flex-direction:column; gap:16px;">
          <div class="page-section" style="margin-bottom: 16px;">
            <label class="page-section__label" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); font-weight: 700;">Thumbnail Image/Video</label>
            <div id="cover-thumb-zone" style="width: 100%; height: 180px; border-radius: 16px; border: 2px dashed var(--color-border); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; background: var(--color-surface);">
              <div id="cover-thumb-placeholder" style="text-align: center; color: var(--color-text-muted); ${(_coverThumbnail || storyCoverVideo) ? 'display: none;' : ''}">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style="font-size: 0.75rem; margin-top: 6px;">Tap to upload thumbnail image or video</p>
              </div>
              <img id="cover-thumb-preview" style="width: 100%; height: 100%; object-fit: cover; ${(_coverThumbnail && !isVideoMedia(_coverThumbnail, storyCoverVideo)) ? 'display: block;' : 'display: none;'}" ${_coverThumbnail ? `src="${_coverThumbnail}"` : ''} />
              <video id="cover-video-preview" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; ${(storyCoverVideo || isVideoMedia(_coverThumbnail, storyCoverVideo)) ? 'display: block;' : 'display: none;'}" ${(storyCoverVideo || _coverThumbnail) ? `src="${storyCoverVideo || _coverThumbnail}"` : ''}></video>
            </div>
            <input type="file" id="cover-thumb-input" accept="image/*,video/*" style="display: none;" />
          </div>
          <div class="page0-form-group">
            <label class="page0-label">STORY TITLE</label>
            <input type="text" class="page0-input" id="page0-title" placeholder="Give your story a name..." value="${storyTitle}">
          </div>
          <div class="page0-form-group">
            <label class="page0-label">GENRE</label>
            <div class="page0-select-wrap">
              <select class="page0-select" id="page0-genre">
                <option value="Fantasy" ${storyGenre === 'Fantasy' ? 'selected' : ''}>Fantasy</option>
                <option value="Sci-Fi" ${storyGenre === 'Sci-Fi' ? 'selected' : ''}>Sci-Fi</option>
                <option value="Mystery" ${storyGenre === 'Mystery' ? 'selected' : ''}>Mystery</option>
                <option value="Adventure" ${storyGenre === 'Adventure' ? 'selected' : ''}>Adventure</option>
                <option value="Romance" ${storyGenre === 'Romance' ? 'selected' : ''}>Romance</option>
                <option value="Horror" ${storyGenre === 'Horror' ? 'selected' : ''}>Horror</option>
              </select>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--color-text-muted);"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          <div class="page0-form-group">
            <label class="page0-label">SYNOPSIS</label>
            <textarea class="page0-textarea" id="page0-synopsis" rows="6" placeholder="Briefly describe what this story is about...">${storySynopsis}</textarea>
          </div>
        </div>
      </div>
    `;
  } else {
    // ─── NORMAL PAGE ───
    const i = currentPage;
    const page = bookPages[i];
    cardHtml = `
      <div class="book-tile book-tile--single" data-book-longpress="${i}">
        <div class="book-tile__header" style="position:relative;">
          <span class="book-tile__label">PAGE ${i + 1}</span>
          <button class="book-tile__maximize" data-tile-maximize="${i}" title="Expand page">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>

        <!-- Image area -->
        <div class="book-tile__image" data-tile-upload="${i}">
          ${generatingTileIndex === i
            ? `<div class="book-tile__rendering-img" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; min-height:180px; background:linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.12)); border-radius:var(--radius-md); gap:10px; color:var(--color-purple); font-family:var(--font-heading); font-weight:600;">
                 <svg class="spin-animation" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                 <span style="font-size:0.92rem;">Creating...</span>
               </div>`
            : page.image
              ? `<img class="book-tile__img" src="${page.image}" alt="Page ${i + 1}">
                 <button class="book-tile__remove-img" data-tile-remove-img="${i}">${ICON.close}</button>
                 ${bookPrompts[i] ? `<button class="book-tile__redo-img" data-tile-redo="${i}" title="Regenerate">${ICON.redo}</button>` : ''}`
              : `<div class="book-tile__empty-img">
                  <div class="book-tile__upload-btn">${ICON.upload}</div>
                  <span>Upload or Generate</span>
                </div>`
          }
          <input type="file" class="book-tile__file" data-tile-file="${i}" accept="image/*" hidden>
        </div>

        <!-- Generate row -->
        <div class="book-tile__gen">
          <input type="text" class="book-tile__prompt" data-tile-prompt="${i}"
            placeholder="Describe illustration..." maxlength="500"
            value="${bookPrompts[i] || ''}">
          <button class="book-tile__gen-btn" data-tile-gen="${i}" ${isGenerating ? 'disabled' : ''}>
            ${ICON.send}
          </button>
        </div>

        <!-- Story text -->
        <div class="book-tile__text-header">
          <span>STORY TEXT</span>
          <button class="book-tile__tts" data-tile-tts="${i}" title="Read aloud">${ICON.speaker}</button>
        </div>
        <textarea class="book-tile__textarea" data-tile-text="${i}"
          placeholder="Write the story for this page..."
          rows="5">${page.text}</textarea>

        <!-- Voice Tuning -->
        <div class="book-tile__voice-tuning">
          <div class="book-tile__voice-label">
            <span>VOICE TUNING</span>
            <span class="book-tile__voice-pct" data-tile-stability-pct="${i}">${Math.round((page.stability ?? 0.5) * 100)}%</span>
          </div>
          <input type="range" class="book-tile__voice-slider" data-tile-stability="${i}"
            min="0" max="1" step="0.1" value="${page.stability ?? 0.5}">
        </div>

        <!-- Pre-record Audio -->
        <div class="prerecord-row">
          <button class="prerecord-btn ${page.audioUrl ? 'prerecord-btn--done' : 'prerecord-btn--pending'}" data-prerecord-book="${i}" type="button">
            ${page.audioUrl
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Pre-recorded</span>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> <span>Pre-record</span>`}
          </button>
          ${page.audioUrl ? `
            <button class="prerecord-play-btn" data-prerecord-play-book="${i}" type="button" title="Preview audio">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          ` : ''}
        </div>

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
            <div class="book-tile__dd-actions">
              <button class="book-tile__dd-voice-btn" data-tile-dd-voice="${i}" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                <span>Voice Note</span>
              </button>
              <button class="book-tile__dd-cleanup-btn" data-tile-dd-cleanup="${i}" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
                <span>Clean Up</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="create-phase create-phase--canvas fade-in">
      ${renderStudioOrbs()}
      ${renderCanvasToolbar('Illustrated Book')}

      <h2 class="create-phase__title" style="margin-bottom:4px;">${currentPage === -1 ? 'Story Settings' : 'Your Pages'}</h2>
      <p class="create-phase__desc">${currentPage === -1 ? 'Define your story details.' : `Page ${currentPage + 1} of ${bookPages.length}. Long-press to delete.`}</p>

      <!-- Page progress dots -->
      <div class="book-dots" id="book-dots">${dotsHtml}</div>

      <!-- Single page view with arrow navigation -->
      <div class="book-single-view">
        <!-- Left arrow -->
        <button class="book-nav-arrow book-nav-arrow--left" id="btn-book-prev" ${currentPage <= -1 ? 'style="visibility:hidden"' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <!-- Page card -->
        ${cardHtml}

        <!-- Right arrow -->
        <button class="book-nav-arrow book-nav-arrow--right" id="btn-book-next" ${currentPage >= bookPages.length - 1 ? 'style="visibility:hidden"' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
//  FULLSCREEN PAGE VIEWER
// ═══════════════════════════════════════

function openPageFullscreen(pageIndex: number): void {
  const page = bookPages[pageIndex];
  if (!page) return;

  // Remove existing overlay if any
  document.getElementById('book-fullscreen')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'book-fullscreen-overlay';
  overlay.id = 'book-fullscreen';
  overlay.innerHTML = `
    <div class="book-fullscreen__topbar">
      <span class="book-fullscreen__topbar-title">Page ${pageIndex + 1}</span>
      <button class="book-fullscreen__collapse" id="btn-fullscreen-collapse" title="Collapse">
        ${ICON.collapse}
      </button>
    </div>
    <div class="book-fullscreen__body">
      <div class="book-fullscreen__image-area" id="fs-image-area">
        ${generatingTileIndex === pageIndex
          ? `<div class="book-tile__rendering-img" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; min-height:220px; background:linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.12)); border-radius:var(--radius-md); gap:12px; color:var(--color-purple); font-family:var(--font-heading); font-weight:600;">
               <svg class="spin-animation" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
               <span style="font-size:1.05rem;">Creating...</span>
             </div>`
          : page.image
            ? `<img src="${page.image}" alt="Page ${pageIndex + 1}">
               <button class="book-fullscreen__remove-img" id="fs-remove-img">${ICON.close}</button>
               ${bookPrompts[pageIndex] ? `<button class="book-fullscreen__redo-img" id="fs-redo-img" title="Regenerate">${ICON.redo}</button>` : ''}`
            : `<div class="book-fullscreen__empty-img">
                 <div class="book-tile__upload-btn">${ICON.upload}</div>
                 <span>Upload or Generate</span>
               </div>`
        }
        <input type="file" id="fs-file-input" accept="image/*" hidden>
      </div>
      <div class="book-fullscreen__gen-row">
        <input type="text" class="book-fullscreen__prompt" id="fs-prompt"
          placeholder="Describe illustration..." maxlength="500"
          value="${bookPrompts[pageIndex] || ''}">
        <button class="book-fullscreen__gen-btn" id="fs-gen-btn" ${isGenerating ? 'disabled' : ''}>
          ${ICON.send}
        </button>
      </div>
      <div class="book-fullscreen__text-label">
        <span>Story Text</span>
        <button class="book-fullscreen__tts" id="fs-tts-btn" title="Read aloud">${ICON.speaker}</button>
      </div>
      <textarea class="book-fullscreen__textarea" id="fs-textarea"
        placeholder="Write the story for this page..."
        rows="8">${page.text}</textarea>

      <!-- Voice Tuning (fullscreen) -->
      <div class="book-tile__voice-tuning" style="margin-top: var(--space-md);">
        <div class="book-tile__voice-label">
          <span>VOICE TUNING</span>
          <span class="book-tile__voice-pct" id="fs-stability-pct">${Math.round((page.stability ?? 0.5) * 100)}%</span>
        </div>
        <input type="range" class="book-tile__voice-slider" id="fs-stability-slider"
          min="0" max="1" step="0.1" value="${page.stability ?? 0.5}">
      </div>

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
          <div class="book-tile__dd-actions">
            <button class="book-tile__dd-voice-btn" id="fs-dd-voice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              <span>Voice Note</span>
            </button>
            <button class="book-tile__dd-cleanup-btn" id="fs-dd-cleanup">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
              <span>Clean Up</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // --- Wire up events ---

  // Collapse button
  document.getElementById('btn-fullscreen-collapse')?.addEventListener('click', () => {
    closePageFullscreen(overlay);
  });

  // Image area click → file upload
  const imageArea = document.getElementById('fs-image-area');
  const fileInput = document.getElementById('fs-file-input') as HTMLInputElement;
  imageArea?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#fs-remove-img') || (e.target as HTMLElement).closest('#fs-redo-img')) return;
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

  // AI Generate
  document.getElementById('fs-gen-btn')?.addEventListener('click', async () => {
    const promptInput = document.getElementById('fs-prompt') as HTMLInputElement;
    const prompt = promptInput?.value?.trim();
    if (!prompt || isGenerating) return;
    isGenerating = true;
    generatingTileIndex = pageIndex;
    bookPrompts[pageIndex] = '';
    if (promptInput) promptInput.value = '';
    closePageFullscreen(overlay);
    const wizard = document.getElementById('create-wizard');
    if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
    openPageFullscreen(pageIndex);

    try {
      const result = await generateImage(prompt, bookPages[pageIndex].text);
      bookPages[pageIndex].image = result.imageUrl;
    } catch (err: any) {
      console.error('Fullscreen gen failed:', err);
    } finally {
      generatingTileIndex = null;
      isGenerating = false;
      closePageFullscreen(overlay);
      const wizard = document.getElementById('create-wizard');
      if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
      openPageFullscreen(pageIndex);
    }
  });

  // Redo
  document.getElementById('fs-redo-img')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const prompt = bookPrompts[pageIndex];
    if (!prompt || isGenerating) return;
    isGenerating = true;
    bookPages[pageIndex].image = null;
    try {
      const result = await generateImage(prompt, bookPages[pageIndex].text);
      bookPages[pageIndex].image = result.imageUrl;
    } catch (err: any) {
      console.error('Redo failed:', err);
    }
    isGenerating = false;
    closePageFullscreen(overlay);
    const wizard = document.getElementById('create-wizard');
    if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
    openPageFullscreen(pageIndex);
  });

  // TTS
  document.getElementById('fs-tts-btn')?.addEventListener('click', () => {
    const text = bookPages[pageIndex].text;
    if (!text.trim()) return;
    if (isSpeaking()) { stopSpeaking(); } else { speakText(text); }
  });

  // Text changes
  document.getElementById('fs-textarea')?.addEventListener('input', () => {
    bookPages[pageIndex].text = (document.getElementById('fs-textarea') as HTMLTextAreaElement).value;
  });

  // Prompt changes
  document.getElementById('fs-prompt')?.addEventListener('input', () => {
    bookPrompts[pageIndex] = (document.getElementById('fs-prompt') as HTMLInputElement).value;
  });

  // Fullscreen Voice Tuning slider
  const fsStabilitySlider = document.getElementById('fs-stability-slider') as HTMLInputElement;
  const fsStabilityPct = document.getElementById('fs-stability-pct');
  fsStabilitySlider?.addEventListener('input', () => {
    const val = parseFloat(fsStabilitySlider.value);
    bookPages[pageIndex].stability = val;
    if (fsStabilityPct) fsStabilityPct.textContent = Math.round(val * 100) + '%';
  });

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
  document.getElementById('fs-dd-content')?.addEventListener('input', () => {
    bookPages[pageIndex].deeperDiveContent = (document.getElementById('fs-dd-content') as HTMLTextAreaElement).value;
  });

  // Fullscreen Voice Note
  document.getElementById('fs-dd-voice')?.addEventListener('click', () => {
    handleVoiceNote(pageIndex, document.getElementById('fs-dd-content') as HTMLTextAreaElement, document.getElementById('fs-dd-voice')!);
  });

  // Fullscreen Clean Up
  document.getElementById('fs-dd-cleanup')?.addEventListener('click', () => {
    handleCleanUp(pageIndex, document.getElementById('fs-dd-content') as HTMLTextAreaElement, document.getElementById('fs-dd-cleanup')!);
  });
}

function closePageFullscreen(overlay: HTMLElement): void {
  overlay.classList.add('closing');
  overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
}

// ═══════════════════════════════════════
//  STORYBOARD — Wide Desktop View
// ═══════════════════════════════════════

function openStoryboard(): void {
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
        <button class="sb-card__delete" data-sb-delete="${i}" title="Delete page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>

      <div class="sb-card__media">
        <div class="sb-card__media-label">MEDIA</div>
        ${page.image
          ? `<img class="sb-card__img" src="${page.image}" alt="Page ${i + 1}">`
          : `<div class="sb-card__no-img"><span>No image</span></div>`
        }
      </div>

      <div class="sb-card__section">
        <div class="sb-card__section-label">STORY TEXT</div>
        <textarea class="sb-card__textarea" data-sb-text="${i}" rows="6" placeholder="Write the story for this page...">${page.text}</textarea>
      </div>

      <div class="sb-card__section">
        <div class="sb-card__section-label">DIALOG</div>
        <textarea class="sb-card__dialog-textarea" data-sb-dialog="${i}" rows="3" placeholder="Write dialog for this page...">${page.dialogText || ''}</textarea>
        <div class="sb-card__prerecord-row">
          <button class="sb-card__record-btn" data-sb-record="${i}" type="button">🎙️ Record</button>
          <button class="sb-card__play-btn" data-sb-play="${i}" type="button" ${page.dialogAudioUrl ? '' : 'disabled'}>▶ Play</button>
        </div>
      </div>

      <div class="sb-card__section">
        <div class="sb-card__section-label">
          VOICE TUNING
          <span class="sb-card__pct" data-sb-pct="${i}">${Math.round((page.stability ?? 0.5) * 100)}%</span>
        </div>
        <input type="range" class="book-tile__voice-slider" data-sb-stability="${i}"
          min="0" max="1" step="0.1" value="${page.stability ?? 0.5}">
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
          <div class="sb-topbar__title">Content Storyboard</div>
          <div class="sb-topbar__subtitle">CREATOR VIEW</div>
        </div>
      </div>
      <div class="sb-topbar__right">
        <span class="sb-topbar__counter">${bookPages.length} Pages</span>
        <button class="sb-topbar__add-btn" id="sb-add-page">+ Add Page</button>
        <button class="sb-topbar__close" id="sb-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="sb-track" id="sb-track">
      ${cardsHtml}
    </div>
  `;

  document.body.appendChild(overlay);

  // --- Wire up events ---
  document.getElementById('sb-close')?.addEventListener('click', () => {
    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => {
      overlay.remove();
      const wizard = document.getElementById('create-wizard');
      if (wizard) { wizard.innerHTML = renderPhase(); attachListenersGlobal(); }
    }, { once: true });
  });

  document.getElementById('sb-add-page')?.addEventListener('click', () => {
    bookPages.push(defaultBookPage());
    bookPrompts.push('');
    overlay.remove();
    openStoryboard();
  });

  // Text editing
  overlay.querySelectorAll('[data-sb-text]').forEach(ta => {
    ta.addEventListener('input', () => {
      const idx = parseInt(ta.getAttribute('data-sb-text') || '0');
      bookPages[idx].text = (ta as HTMLTextAreaElement).value;
    });
  });

  // Stability sliders
  overlay.querySelectorAll('[data-sb-stability]').forEach(slider => {
    slider.addEventListener('input', () => {
      const idx = parseInt(slider.getAttribute('data-sb-stability') || '0');
      const val = parseFloat((slider as HTMLInputElement).value);
      bookPages[idx].stability = val;
      const pct = overlay.querySelector(`[data-sb-pct="${idx}"]`);
      if (pct) pct.textContent = Math.round(val * 100) + '%';
    });
  });

  // Deeper dive content
  overlay.querySelectorAll('[data-sb-dd]').forEach(ta => {
    ta.addEventListener('input', () => {
      const idx = parseInt(ta.getAttribute('data-sb-dd') || '0');
      bookPages[idx].deeperDiveContent = (ta as HTMLTextAreaElement).value;
    });
  });

  // Delete page
  overlay.querySelectorAll('[data-sb-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-sb-delete') || '0');
      if (bookPages.length <= 1) { alert('At least one page must remain.'); return; }
      if (!confirm(`Delete Page ${idx + 1}?`)) return;
      bookPages.splice(idx, 1);
      bookPrompts.splice(idx, 1);
      if (currentPage >= bookPages.length) currentPage = bookPages.length - 1;
      overlay.remove();
      openStoryboard();
    });
  });

  // Dialog text editing
  overlay.querySelectorAll('[data-sb-dialog]').forEach(ta => {
    ta.addEventListener('input', () => {
      const idx = parseInt(ta.getAttribute('data-sb-dialog') || '0');
      bookPages[idx].dialogText = (ta as HTMLTextAreaElement).value;
    });
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
        const [movedPrompt] = bookPrompts.splice(dragSrcIdx, 1);
        bookPrompts.splice(dropIdx, 0, movedPrompt);
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

  // --- Dialog audio recording (MediaRecorder) ---
  const activeRecorders: Map<number, MediaRecorder> = new Map();
  const audioBlobs: Map<number, Blob> = new Map();

  overlay.querySelectorAll('[data-sb-record]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt((btn as HTMLElement).getAttribute('data-sb-record') || '0');
      const recBtn = btn as HTMLElement;

      // If already recording, stop
      if (activeRecorders.has(idx)) {
        activeRecorders.get(idx)!.stop();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          activeRecorders.delete(idx);
          recBtn.classList.remove('sb-card__record-btn--active');
          recBtn.innerHTML = '🎙️ Record';

          const blob = new Blob(chunks, { type: 'audio/webm' });
          audioBlobs.set(idx, blob);
          const url = URL.createObjectURL(blob);
          bookPages[idx].dialogAudioUrl = url;

          // Enable the play button
          const playBtn = overlay.querySelector(`[data-sb-play="${idx}"]`) as HTMLButtonElement;
          if (playBtn) playBtn.disabled = false;
        };

        recorder.start();
        activeRecorders.set(idx, recorder);
        recBtn.classList.add('sb-card__record-btn--active');
        recBtn.innerHTML = '⏹ Stop';

        // Auto-stop after 60 seconds
        setTimeout(() => {
          if (activeRecorders.has(idx)) activeRecorders.get(idx)!.stop();
        }, 60000);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Microphone access is required to record dialog.');
      }
    });
  });

  // Play recorded dialog audio
  overlay.querySelectorAll('[data-sb-play]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).getAttribute('data-sb-play') || '0');
      const url = bookPages[idx].dialogAudioUrl;
      if (url) {
        const audio = new Audio(url);
        const playBtn = btn as HTMLButtonElement;
        playBtn.innerHTML = '⏸ Playing';
        audio.play();
        audio.onended = () => { playBtn.innerHTML = '▶ Play'; };
      }
    });
  });
}

// ─── Voice Note (Speech-to-Text) ───
let activeRecognition: any = null;
function handleVoiceNote(pageIndex: number, textarea: HTMLTextAreaElement | null, btn: HTMLElement): void {
  if (!textarea) return;
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech recognition is not supported in this browser.');
    return;
  }

  // If already recording, stop
  if (activeRecognition) {
    activeRecognition.stop();
    activeRecognition = null;
    btn.classList.remove('book-tile__dd-voice-btn--active');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Voice Note';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  const existingText = textarea.value;
  let finalTranscript = '';

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    textarea.value = existingText + (existingText ? '\n' : '') + finalTranscript + interim;
    bookPages[pageIndex].deeperDiveContent = textarea.value;
  };

  recognition.onend = () => {
    activeRecognition = null;
    btn.classList.remove('book-tile__dd-voice-btn--active');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Voice Note';
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
    activeRecognition = null;
    btn.classList.remove('book-tile__dd-voice-btn--active');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Voice Note';
  };

  recognition.start();
  activeRecognition = recognition;
  btn.classList.add('book-tile__dd-voice-btn--active');
  const span = btn.querySelector('span');
  if (span) span.textContent = 'Listening...';
}

// ─── Clean Up (Groq AI) ───
async function handleCleanUp(pageIndex: number, textarea: HTMLTextAreaElement | null, btn: HTMLElement): Promise<void> {
  if (!textarea) return;
  const rawText = textarea.value.trim();
  if (!rawText) {
    alert('Write or dictate some text first, then clean it up.');
    return;
  }

  const span = btn.querySelector('span');
  const originalText = span?.textContent || 'Clean Up';
  btn.setAttribute('disabled', 'true');
  if (span) span.textContent = 'Cleaning...';

  try {
    const cleaned = await cleanUpText(rawText);
    textarea.value = cleaned;
    bookPages[pageIndex].deeperDiveContent = cleaned;
  } catch (err: any) {
    console.error('Clean up failed:', err);
    alert('Clean up failed: ' + (err.message || 'Unknown error'));
  } finally {
    btn.removeAttribute('disabled');
    if (span) span.textContent = originalText;
  }
}

let attachListenersGlobal: () => void = () => {};

// ═══════════════════════════════════════
//  DETAILS (shared by all formats)
// ═══════════════════════════════════════

function renderDetails(): string {
  const panelCount = selectedFormat === 'book'
    ? `${bookPages.length} pages`
    : `${scrollPanels.length} panels`;

  return `
    <div class="create-phase fade-in">
      <div class="create-phase__header">
        <div class="create-phase__header-row">
          <button class="create-btn create-btn--ghost" id="btn-details-back">← Back</button>
        </div>
        <h2 class="create-phase__title">Story Details</h2>
        <p class="create-phase__desc">Tell readers what your story is about.</p>
      </div>
      <div class="create-form">
        <div class="create-field">
          <label class="create-field__label" for="input-title">Title</label>
          <input type="text" class="create-field__input" id="input-title" value="${storyTitle}" placeholder="A Great Adventure" maxlength="80">
        </div>
        <div class="create-field">
          <label class="create-field__label" for="input-genre">Genre</label>
          <select class="create-field__select" id="input-genre">
            ${genres.map(g => `<option value="${g}" ${storyGenre === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="create-field">
          <label class="create-field__label" for="input-synopsis">Synopsis</label>
          <textarea class="create-field__textarea" id="input-synopsis" rows="4" placeholder="What is your story about?" maxlength="500">${storySynopsis}</textarea>
        </div>
      </div>
      <div class="create-review-pill">
        <span>📋</span>
        <span><strong>${panelCount}</strong> · <strong>${selectedFormat === 'book' ? 'Illustrated Book' : 'Endless Scroll'}</strong></span>
      </div>
      <button class="create-btn create-btn--primary" id="btn-submit" ${!storyTitle ? 'disabled' : ''}>Submit for Review</button>
      <p class="create-review-notice">⚠️ All stories are reviewed before publication (1-3 days).</p>
    </div>
  `;
}

// ═══════════════════════════════════════
//  RENDER + INIT
// ═══════════════════════════════════════

function renderLanding(): string {
  const drafts = getAllDrafts();
  const formatIcon = (fmt: string | null) => {
    if (fmt === 'scroll') return '📜';
    if (fmt === 'book') return '📖';
    return '📝';
  };
  const formatClass = (fmt: string | null) => {
    if (fmt === 'scroll') return 'scroll';
    if (fmt === 'book') return 'book';
    return 'default';
  };
  const formatLabel = (fmt: string | null) => {
    if (fmt === 'scroll') return 'Endless Scroll';
    if (fmt === 'book') return 'Illustrated Book';
    return 'Unknown';
  };
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const draftCards = drafts.map(d => `
    <div class="create-draft-card" data-draft-id="${d.id}">
      <div class="create-draft-card__icon create-draft-card__icon--${formatClass(d.selectedFormat)}">
        ${formatIcon(d.selectedFormat)}
      </div>
      <div class="create-draft-card__info">
        <p class="create-draft-card__title">${d.storyTitle || 'Untitled Draft'}</p>
        <p class="create-draft-card__meta">${formatLabel(d.selectedFormat)} · ${timeAgo(d.updatedAt)}</p>
      </div>
      <div class="create-draft-card__actions">
        <button class="create-draft-card__btn create-draft-card__btn--resume" data-resume-draft="${d.id}">Resume</button>
        <button class="create-draft-card__btn create-draft-card__btn--delete" data-delete-draft="${d.id}">${ICON.trash}</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="create-landing fade-in">
      <div class="create-landing__header">
        <h2 class="create-landing__title">Create</h2>
        <p class="create-landing__subtitle">Start a new story or continue a draft</p>
      </div>
      <button class="create-landing__new-btn" id="btn-start-new">
        <span style="font-size:1.2rem;">✨</span> Start New Story
      </button>
      ${drafts.length > 0 ? `
        <h3 class="create-landing__drafts-title">Your Drafts</h3>
        <div class="create-landing__drafts-list">
          ${draftCards}
        </div>
      ` : `
        <div class="create-landing__empty">
          <p>No drafts yet. Start creating your first story!</p>
        </div>
      `}
    </div>
  `;
}

function renderGuide(): string {
  const isBook = selectedFormat === 'book';
  const howToText = isBook
    ? 'Add text to each page and generate AI illustrations with prompts.'
    : 'Upload your own images as scrollable panels.';

  return `
    <div class="create-phase fade-in">
      <button class="create-back-btn" id="btn-guide-back" style="display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:var(--color-text-muted); font-family:var(--font-heading); font-size:0.85rem; font-weight:600; padding:0; margin-bottom:var(--space-md);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div class="create-phase__header">
        <h2 class="create-phase__title">Before You Begin</h2>
        <p class="create-phase__desc">A few things to know before you start creating.</p>
      </div>
      <div style="display:flex; flex-direction:column; gap:1rem; max-width:500px; margin:0 auto;">
        <div style="background:var(--color-surface); border-radius:var(--radius-lg); padding:1.25rem; border:1px solid var(--color-border); box-shadow:var(--shadow-sm);">
          <h3 style="font-family:var(--font-heading); font-size:1rem; font-weight:600; margin-bottom:0.5rem;">📝 How to Create</h3>
          <p style="font-size:0.9rem; color:var(--color-text-muted); line-height:1.6; margin:0;">${howToText}</p>
        </div>
        <div style="background:var(--color-surface); border-radius:var(--radius-lg); padding:1.25rem; border:1px solid var(--color-border); box-shadow:var(--shadow-sm);">
          <h3 style="font-family:var(--font-heading); font-size:1rem; font-weight:600; margin-bottom:0.5rem;">📋 Review Process</h3>
          <p style="font-size:0.9rem; color:var(--color-text-muted); line-height:1.6; margin:0;">Once you submit your story, an admin will review it for harmful or explicit content. This usually takes 24-48 hours. You'll be notified once approved!</p>
        </div>
        <div style="background:var(--color-surface); border-radius:var(--radius-lg); padding:1.25rem; border:1px solid var(--color-border); box-shadow:var(--shadow-sm);">
          <h3 style="font-family:var(--font-heading); font-size:1rem; font-weight:600; margin-bottom:0.5rem;">💡 Tips</h3>
          <p style="font-size:0.9rem; color:var(--color-text-muted); line-height:1.6; margin:0;">Keep your content original and family-friendly. Stories with explicit or hateful content will be rejected.</p>
        </div>
      </div>
      <button class="create-btn create-btn--primary" id="btn-guide-next" style="margin-top:var(--space-lg);">Let's Go!</button>
    </div>
  `;
}

function renderPhase(): string {
  if (phase === 'landing') return renderLanding();
  if (phase === 'guide') return renderGuide();
  if (phase === 'canvas') {
    return selectedFormat === 'book' ? renderBookCanvas() : renderScrollCanvas();
  }
  if (phase === 'details') return renderDetails();
  return renderFormatSelection();
}

export function render(): string {
  const routeParam = getRouteParam();

  if (routeParam) {
    if (loadDraft(routeParam)) {
      phase = 'canvas';
    } else {
      const userStory = getUserStories().find(s => s.id === routeParam);
      if (userStory) {
        activeDraftId = userStory.id;
        phase = 'canvas';
        selectedFormat = userStory.format;
        storyTitle = userStory.title;
        storyGenre = userStory.genre;
        storySynopsis = userStory.synopsis || '';
        storyAuthorName = userStory.author_name || '';
        _coverThumbnail = userStory.coverImage || null;
        storyCoverVideo = userStory.coverVideo || '';
        storyContentRating = (userStory.contentRating as any) || 'All Ages';

        const pages = userStory.pages || userStory.live_pages || [];
        if (selectedFormat === 'book') {
          bookPages = pages.length > 0
            ? pages.map((p, i) => ({
                image: p.image,
                text: p.text || '',
                stability: (p as any).stability ?? 0.5,
                deeperDiveContent: (p as any).deeperDiveContent || '',
                audioUrl: userStory.page_audio?.[i] || null,
                dialogText: (p as any).dialogText || '',
                dialogAudioUrl: null,
              }))
            : Array.from({ length: 5 }, () => defaultBookPage());
          bookPrompts = Array.from({ length: bookPages.length }, () => '');
        } else {
          scrollPanels = pages.length > 0
            ? pages.map((p, i) => ({
                image: p.image,
                notes: p.text || '',
                layout: 'single',
                tiles: [p.image],
                textOverlays: [[]],
                audioUrl: userStory.page_audio?.[i] || null,
              }))
            : Array.from({ length: 5 }, () => ({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null }));
          scrollPrompts = Array.from({ length: scrollPanels.length }, () => '');
        }
      }
    }
  } else {
    // Restore session state if available (page refresh), otherwise reset
    const savedPhase = sessionStorage.getItem('drive_create_phase') as CreatePhase | null;
    const savedFormat = sessionStorage.getItem('drive_create_format') as StoryFormat | null;
    const savedDraftId = sessionStorage.getItem('drive_create_draft_id');

    if (savedPhase && savedPhase !== 'landing' && savedPhase !== 'format') {
      // Try to restore full draft data (images, layouts, prompts, etc.)
      if (savedDraftId && loadDraft(savedDraftId)) {
        // loadDraft restored everything including phase/format
        phase = savedPhase;
        if (savedFormat) selectedFormat = savedFormat;
      } else {
        // No draft to restore — just set phase/format
        phase = savedPhase;
        selectedFormat = savedFormat || selectedFormat;
      }
    } else {
      phase = 'format';
      activeDraftId = null;
      selectedFormat = null;
      storyTitle = '';
      storyGenre = 'Fantasy';
      storySynopsis = '';
      storyHashtags = '';
      storyMediaType = 'static';
      storyAuthorName = '';
      storyCustomGenre = '';
      storyContentRating = 'All Ages';
      scrollPanels = Array.from({ length: 5 }, () => ({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null }));
      _coverThumbnail = null;
      storyCoverVideo = '';
      bookPages = Array.from({ length: 5 }, () => defaultBookPage());
      bookPrompts = ['', '', '', '', ''];
      currentPage = 0;
      isGenerating = false;
    }
  }

  const isCanvas = phase === 'canvas';

  return `
    <div class="view-create ${isCanvas ? 'view-create--canvas' : ''}" id="create-container">
      <div class="create-wizard ${isCanvas ? 'create-wizard--canvas' : ''} slide-up stagger-1" id="create-wizard">
        ${renderPhase()}
      </div>
    </div>
  `;
}

function getFormData(): void {
  storyTitle = (document.getElementById('ss-title') as HTMLInputElement)?.value || storyTitle || 'Untitled';
  storyAuthorName = (document.getElementById('ss-author') as HTMLInputElement)?.value || '';
  storyGenre = ((document.getElementById('ss-genre') as HTMLSelectElement)?.value || 'Fantasy') as Genre;
  storySynopsis = (document.getElementById('ss-synopsis') as HTMLTextAreaElement)?.value || '';
  storyHashtags = (document.getElementById('ss-hashtags') as HTMLInputElement)?.value || '';
  storyCustomGenre = (document.getElementById('ss-custom-genre') as HTMLInputElement)?.value || '';
  storyContentRating = ((document.getElementById('ss-rating') as HTMLSelectElement)?.value || 'All Ages') as any;
  storyCoverVideo = (document.getElementById('ss-cover-video') as HTMLInputElement)?.value || storyCoverVideo || '';
}

function buildStory(status: 'draft' | 'under-review'): UserStory {
  getFormData();
  const pages = selectedFormat === 'book'
    ? bookPages.map(p => ({ image: p.image, text: p.text, stability: p.stability, deeperDiveContent: p.deeperDiveContent, dialogText: p.dialogText }))
    : scrollPanels.map(p => ({ image: p.image, text: p.notes }));
  return {
    id: activeDraftId || 'us-' + Date.now(),
    title: storyTitle,
    author_name: storyAuthorName,
    genre: storyGenre === 'Custom' ? storyCustomGenre as any : storyGenre,
    format: selectedFormat as StoryFormat,
    synopsis: storySynopsis,
    status,
    createdAt: new Date().toISOString(),
    pages,
    coverImage: _coverThumbnail || pages[0]?.image || '',
    coverVideo: storyCoverVideo || (isVideoMedia(_coverThumbnail) ? _coverThumbnail || '' : undefined),
    contentRating: storyContentRating as any,
  };
}

export function init(): void {
  const wizard = document.getElementById('create-wizard');
  if (!wizard) return;

  const updateView = () => {
    // Persist phase, format, and draft ID so page refresh restores state
    sessionStorage.setItem('drive_create_phase', phase);
    if (selectedFormat) sessionStorage.setItem('drive_create_format', selectedFormat);
    if (activeDraftId) sessionStorage.setItem('drive_create_draft_id', activeDraftId);

    const container = document.getElementById('create-container');
    if (container) {
      if (phase === 'canvas') {
        container.classList.add('view-create--canvas');
      } else {
        container.classList.remove('view-create--canvas');
      }
    }
    wizard.innerHTML = renderPhase();
    attachListeners();
    saveDraft();
  };

  attachListenersGlobal = () => attachListeners();

  function openStorySettings(): void {
    // Save current state before opening settings
    const wizard = document.getElementById('create-wizard');
    if (!wizard) return;

    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('app-content')?.scrollTo({ top: 0, behavior: 'instant' });

    const formatLabels: Record<string, string> = {
      'scroll': 'Waterfall Storyboard',
      'book': 'Illustrated Book',
      'comic': 'Comic Strip',
    };
    const formatLabel = formatLabels[selectedFormat || 'scroll'] || selectedFormat || 'Unknown';

    const allGenres = ['Fantasy','Sci-Fi','Romance','Horror','Comedy','Drama','Mystery','Slice of Life','Action','Adventure','Thriller','Historical','Superhero','Sports','Psychological','Supernatural','Mecha','Musical','Custom'];
    const panelCount = selectedFormat === 'book' ? bookPages.length : scrollPanels.filter(p => p.image || p.tiles?.some(t => t)).length;
    const totalPanels = selectedFormat === 'book' ? bookPages.length : scrollPanels.length;

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
          <!-- Thumbnail Image/Video Section -->
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
            <div class="ss-field" style="margin-top: 10px;">
              <label class="ss-field__label" for="ss-cover-video">Or Media Link (optional image/video URL)</label>
              <input type="text" id="ss-cover-video" class="ss-field__input" value="${storyCoverVideo || ''}" placeholder="https://... (image or video URL)" />
            </div>
          </div>

          <!-- Story Info Section -->
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

          <!-- Classification Section -->
          <div class="ss-section">
            <div class="ss-section__label">Classification</div>

            <div class="ss-field">
              <label class="ss-field__label" for="ss-genre">Genre</label>
              <select id="ss-genre" class="ss-field__select">
                ${allGenres.map(g => `<option value="${g}" ${storyGenre === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>

            <div class="ss-field" id="ss-custom-genre-wrap" style="display:${storyGenre === 'Custom' ? 'block' : 'none'};">
              <label class="ss-field__label" for="ss-custom-genre">Custom Genre</label>
              <input type="text" id="ss-custom-genre" class="ss-field__input" value="${storyCustomGenre}" placeholder="Enter your custom genre..." maxlength="30" />
            </div>

            <div class="ss-field">
              <label class="ss-field__label" for="ss-hashtags">Hashtags</label>
              <input type="text" id="ss-hashtags" class="ss-field__input" value="${storyHashtags}" placeholder="#fantasy #adventure #magic" maxlength="120" />
              <div class="ss-field__hint">Separate tags with spaces</div>
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

          <!-- Format & Media Section -->
          <div class="ss-section">
            <div class="ss-section__label">Format & Media</div>

            <div class="ss-field">
              <label class="ss-field__label">Story Format</label>
              <div class="ss-format-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <span>${formatLabel}</span>
              </div>
            </div>

            <div class="ss-field">
              <label class="ss-field__label">Media Type</label>
              <div class="ss-toggle-group">
                <button class="ss-toggle-btn ${storyMediaType === 'static' ? 'ss-toggle-btn--active' : ''}" data-media="static" type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Static
                </button>
                <button class="ss-toggle-btn ${storyMediaType === 'animated' ? 'ss-toggle-btn--active' : ''}" data-media="animated" type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Animated
                </button>
              </div>
            </div>

            <div class="ss-field">
              <label class="ss-field__label">Progress</label>
              <div class="ss-progress">
                <div class="ss-progress__bar">
                  <div class="ss-progress__fill" style="width:${totalPanels > 0 ? Math.round((panelCount / totalPanels) * 100) : 0}%;"></div>
                </div>
                <span class="ss-progress__text">${panelCount} of ${totalPanels} panels have content</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="ss-actions">
            <button id="ss-save-draft" type="button" class="ss-action-btn ss-action-btn--secondary">Save as Draft</button>
            <button id="ss-submit" type="button" class="ss-action-btn ss-action-btn--primary">Submit for Review</button>
          </div>
        </div>
      </div>
    `;

    // Wire up listeners
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
            if (isVid) {
              const dataUrl = await fileToDataUrl(file);
              storyCoverVideo = dataUrl;
              _coverThumbnail = dataUrl;
              if (modalThumbVideoPreview && modalThumbPreview && modalThumbPlaceholder) {
                modalThumbVideoPreview.src = dataUrl;
                modalThumbVideoPreview.style.display = 'block';
                modalThumbPreview.style.display = 'none';
                modalThumbPlaceholder.style.display = 'none';
              }
            } else {
              const dataUrl = await fileToDataUrl(file);
              _coverThumbnail = await compressImage(dataUrl);
              storyCoverVideo = '';
              if (modalThumbPreview && modalThumbVideoPreview && modalThumbPlaceholder) {
                modalThumbPreview.src = _coverThumbnail;
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

    const coverVideoInput = document.getElementById('ss-cover-video') as HTMLInputElement | null;
    coverVideoInput?.addEventListener('input', () => {
      const val = coverVideoInput.value.trim();
      storyCoverVideo = val;
      if (val) {
        const isVid = isVideoMedia(val, val);
        if (isVid) {
          if (modalThumbVideoPreview && modalThumbPreview && modalThumbPlaceholder) {
            modalThumbVideoPreview.src = val;
            modalThumbVideoPreview.style.display = 'block';
            modalThumbPreview.style.display = 'none';
            modalThumbPlaceholder.style.display = 'none';
          }
        } else {
          _coverThumbnail = val;
          if (modalThumbPreview && modalThumbVideoPreview && modalThumbPlaceholder) {
            modalThumbPreview.src = val;
            modalThumbPreview.style.display = 'block';
            modalThumbVideoPreview.style.display = 'none';
            modalThumbPlaceholder.style.display = 'none';
          }
        }
      }
    });

    document.getElementById('ss-back')?.addEventListener('click', () => {
      // Save field values back to state before returning
      const titleEl = document.getElementById('ss-title') as HTMLInputElement;
      const authorEl = document.getElementById('ss-author') as HTMLInputElement;
      const synopsisEl = document.getElementById('ss-synopsis') as HTMLTextAreaElement;
      const genreEl = document.getElementById('ss-genre') as HTMLSelectElement;
      const customGenreEl = document.getElementById('ss-custom-genre') as HTMLInputElement;
      const hashtagsEl = document.getElementById('ss-hashtags') as HTMLInputElement;
      const ratingEl = document.getElementById('ss-rating') as HTMLSelectElement;

      if (titleEl) storyTitle = titleEl.value;
      if (authorEl) storyAuthorName = authorEl.value;
      if (synopsisEl) storySynopsis = synopsisEl.value;
      if (genreEl) storyGenre = genreEl.value as Genre;
      if (customGenreEl) storyCustomGenre = customGenreEl.value;
      if (hashtagsEl) storyHashtags = hashtagsEl.value;
      if (ratingEl) storyContentRating = ratingEl.value as any;

      updateView();
    });

    // Genre change → show/hide custom genre
    document.getElementById('ss-genre')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      const wrap = document.getElementById('ss-custom-genre-wrap');
      if (wrap) wrap.style.display = val === 'Custom' ? 'block' : 'none';
      storyGenre = val as Genre;
    });

    // Media type toggle
    document.querySelectorAll('[data-media]').forEach(btn => {
      btn.addEventListener('click', () => {
        storyMediaType = btn.getAttribute('data-media') as 'static' | 'animated';
        document.querySelectorAll('.ss-toggle-btn').forEach(b => b.classList.remove('ss-toggle-btn--active'));
        btn.classList.add('ss-toggle-btn--active');
      });
    });

    // Synopsis character counter
    document.getElementById('ss-synopsis')?.addEventListener('input', (e) => {
      const ta = e.target as HTMLTextAreaElement;
      const hint = ta.parentElement?.querySelector('.ss-field__hint');
      if (hint) hint.textContent = ta.value.length + '/500';
    });

    // Save / Submit handlers
    document.getElementById('ss-save-draft')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        getFormData();
        await addUserStory(buildStory('draft'));
        clearDraft();
        navigate('library');
      } catch (err) {
        console.error(err);
        alert('Failed to save draft.');
        btn.disabled = false;
        btn.textContent = 'Save as Draft';
      }
    });

    document.getElementById('ss-submit')?.addEventListener('click', async (e) => {
      getFormData();
      if (!storyTitle.trim()) {
        (document.getElementById('ss-title') as HTMLInputElement)?.focus();
        return;
      }
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Submitting...';
      try {
        await addUserStory(buildStory('under-review'));
        clearDraft();
        navigate('library');
      } catch (err) {
        console.error(err);
        alert('Failed to submit story.');
        btn.disabled = false;
        btn.textContent = 'Submit for Review';
      }
    });
  }

  function promptSaveDraftUser(): void {
    if (storyTitle && storyTitle.trim() && storyTitle.trim() !== 'Untitled') {
      saveDraft();
      addUserStory(buildStory('draft')).catch(e => console.warn('Failed to save draft user story to DB', e));
      hideModal();
      navigate('library');
      return;
    }

    showModal({
      title: 'Story Title Required',
      content: `
        <p style="line-height:1.5; margin-bottom:14px; font-size:0.88rem; color:var(--color-text-secondary);">
          Please enter a title for your story to save it as a draft:
        </p>
        <div style="margin-bottom:8px;">
          <input type="text" id="draft-prompt-title" class="ss-field__input" placeholder="Enter story title..." value="${storyTitle && storyTitle !== 'Untitled' ? storyTitle : ''}" maxlength="80" style="width:100%; box-sizing:border-box;" />
        </div>
      `,
      confirmText: 'Save Draft',
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
          await addUserStory(buildStory('draft'));
        } catch (e) {
          console.warn('Failed to save draft user story to DB', e);
        }
        hideModal();
        navigate('library');
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

  const attachListeners = () => {
    // ─── SHARED CANVAS TOOLBAR ───
    if (phase === 'canvas') {
      // Quit without saving / with draft save
      document.getElementById('btn-toolbar-quit')?.addEventListener('click', () => {
        showModal({
          title: 'Discard Changes?',
          content: '<p style="line-height:1.6;">Your unsaved edits will be lost. Are you sure you want to quit?</p>',
          extraText: 'Save as Draft?',
          cancelText: 'Keep Editing',
          confirmText: 'Discard',
          onConfirm: () => { clearDraft(); navigate('library'); },
          onExtra: () => {
            promptSaveDraftUser();
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

    // ─── LANDING PHASE ───
    if (phase === 'landing') {
      document.getElementById('btn-start-new')?.addEventListener('click', () => {
        activeDraftId = null;
        selectedFormat = null;
        storyTitle = '';
        storyGenre = 'Fantasy';
        storySynopsis = '';
        scrollPanels = Array.from({ length: 5 }, () => ({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]] as TextOverlay[][], audioUrl: null }));
        bookPages = Array.from({ length: 5 }, () => defaultBookPage());
        bookPrompts = ['', '', '', '', ''];
        currentPage = 0;
        phase = 'format';
        updateView();
      });

      wizard.querySelectorAll('[data-resume-draft]').forEach(btn => {
        btn.addEventListener('click', () => {
          const draftId = btn.getAttribute('data-resume-draft');
          if (draftId && loadDraft(draftId)) {
            updateView();
          }
        });
      });

      wizard.querySelectorAll('[data-delete-draft]').forEach(btn => {
        btn.addEventListener('click', () => {
          const draftId = btn.getAttribute('data-delete-draft');
          if (!draftId) return;
          showModal({
            title: 'Delete Draft?',
            content: '<p style="line-height:1.6;">This draft will be permanently removed. Are you sure?</p>',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: () => {
              clearDraft(draftId);
              updateView();
            },
          });
        });
      });
    }

    // ─── FORMAT SELECTION ───
    // Paywall redirect button
    document.getElementById('btn-go-library')?.addEventListener('click', () => {
      navigate('library');
    });

    if (phase === 'format') {
      wizard.querySelectorAll('.create-format-card:not([disabled])').forEach(card => {
        card.addEventListener('click', () => {
          selectedFormat = card.getAttribute('data-format') as StoryFormat;
          updateView();
        });
      });
      document.getElementById('btn-format-next')?.addEventListener('click', () => {
        if (!selectedFormat) return;
        phase = 'guide';
        updateView();
      });
      document.getElementById('btn-format-back')?.addEventListener('click', () => {
        phase = 'landing';
        updateView();
      });
    }

    // ─── GUIDE PHASE ───
    if (phase === 'guide') {
      document.getElementById('btn-guide-back')?.addEventListener('click', () => {
        phase = 'format';
        updateView();
      });
      document.getElementById('btn-guide-next')?.addEventListener('click', () => {
        phase = 'canvas';
        if (selectedFormat === 'book') {
          currentPage = -1;
        } else {
          currentPage = 0;
        }
        updateView();
      });
    }

    // ─── ENDLESS SCROLL CANVAS (CHARACTER SHEET STUDIO) ───
    if (phase === 'canvas' && selectedFormat === 'scroll') {
      // Cleanup stale popup
      document.getElementById('char-popup-overlay')?.remove();

      // Studio Toggle
      document.getElementById('cs-studio-toggle')?.addEventListener('click', () => {
        studioOpen = !studioOpen;
        updateView();
      });

      // Character Tile Click — open popup
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
                <button class="char-popup__btn char-popup__btn--generate" id="char-popup-generate" ${isGenerating ? 'disabled' : ''}>
                  ${isGenerating ? '⏳ Generating...' : '⚡ Generate'}
                </button>
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

        // Generate button
        document.getElementById('char-popup-generate')?.addEventListener('click', async () => {
          const desc = characters[popupIdx].description;
          if (!desc.trim()) {
            showModal({ title: 'Description Needed', content: '<p>Please describe the character first.</p>', confirmText: 'OK' });
            return;
          }
          isGenerating = true;
          document.getElementById('char-popup-overlay')?.remove();
          updateView();
          try {
            const result = await generateImage(`Full character reference sheet of ${desc}, anime webtoon style, clean white background, front and side view, character turnaround`, '');
            characters[popupIdx].image = result.imageUrl;
          } catch (err: any) {
            showModal({ title: 'Generation Error', content: `<p>${err.message}</p>`, confirmText: 'OK' });
          } finally {
            isGenerating = false;
            updateView();
          }
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
          title: '📝 Script',
          content: `
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:4px;">Upload Script (PDF)</label>
                <div id="script-pdf-zone" style="border:2px dashed var(--color-border); border-radius:12px; padding:20px; text-align:center; cursor:pointer; color:var(--color-text-muted);">
                  ${scriptPdfName ? `📄 ${scriptPdfName}` : '📎 Click to upload PDF'}
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
              if (zone) zone.innerHTML = `📄 ${scriptPdfName}`;
            }
          });
        }, 100);
      });

      // Panel Prompts Input — track active panel for checkbox visibility
      wizard.querySelectorAll('[data-panel-prompt]').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.getAttribute('data-panel-prompt') || '0');
          scrollPrompts[idx] = (input as HTMLInputElement).value;
          const hasText = (input as HTMLInputElement).value.trim().length > 0;
          const tileCount = getTileCount(scrollPanels[idx].layout || 'single');

          // Show/hide checkboxes based on whether prompt has text and panel has multiple tiles
          const newActive = (hasText && tileCount > 1) ? idx : null;
          if (newActive !== promptActivePanel) {
            promptActivePanel = newActive;
            updateView();
            // Restore focus to the prompt input after re-render
            requestAnimationFrame(() => {
              const restored = document.querySelector(`[data-panel-prompt="${idx}"]`) as HTMLInputElement;
              if (restored) {
                restored.focus();
                restored.setSelectionRange(restored.value.length, restored.value.length);
              }
            });
            return;
          }
          saveDraft();
        });

        // Enter key triggers generate
        input.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter') {
            e.preventDefault();
            const idx = parseInt(input.getAttribute('data-panel-prompt') || '0');
            const genBtn = wizard.querySelector(`[data-gen-panel-ai="${idx}"]`) as HTMLButtonElement;
            genBtn?.click();
          }
        });
      });

      // Tile selection checkboxes
      wizard.querySelectorAll('[data-select-tile]').forEach(cb => {
        cb.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tileIdx = parseInt(cb.getAttribute('data-select-tile') || '0');
          const panelIdx = parseInt(cb.getAttribute('data-select-panel') || '0');
          // Toggle: if already selected, deselect; otherwise select
          if (selectedGenTile[panelIdx] === tileIdx) {
            selectedGenTile[panelIdx] = null;
          } else {
            selectedGenTile[panelIdx] = tileIdx;
          }
          updateView();
        });
      });

      // Trigger Custom Upload button
      wizard.querySelectorAll('[data-trigger-file]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-trigger-file') || '0');
          const fileInput = wizard.querySelector(`[data-file="${idx}"]`) as HTMLInputElement;
          fileInput?.click();
        });
      });

      // Inline toast helper
      const showGenToast = (msg: string) => {
        let toast = document.getElementById('gen-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'gen-toast';
          toast.style.cssText = 'position:fixed; top:24px; left:50%; transform:translateX(-50%); background:rgba(30,30,50,0.92); color:#fff; padding:10px 24px; border-radius:12px; font-family:var(--font-heading); font-weight:700; font-size:0.85rem; z-index:9999; box-shadow:0 4px 20px rgba(0,0,0,0.3); opacity:0; transition:opacity 0.2s ease;';
          document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => { if (toast) toast.style.opacity = '0'; }, 2800);
      };

      // Generate Single Panel with AI
      wizard.querySelectorAll('[data-gen-panel-ai]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-gen-panel-ai') || '0');
          const prompt = scrollPrompts[idx] || scrollPanels[idx].notes || storySynopsis;

          if (!prompt.trim()) {
            showModal({
              title: 'Visual Prompt Required',
              content: '<p>Please enter a visual prompt for this panel.</p>',
              confirmText: 'OK',
            });
            return;
          }

          // For multi-tile panels, require a tile to be selected
          const tileCount = getTileCount(scrollPanels[idx].layout || 'single');
          let targetTile = 0;
          if (tileCount > 1) {
            if (selectedGenTile[idx] == null) {
              // Shake the prompt input and flash it red
              const promptInput = wizard.querySelector(`[data-panel-prompt="${idx}"]`) as HTMLElement;
              if (promptInput) {
                promptInput.classList.add('prompt-shake');
                promptInput.style.borderColor = '#ef4444';
                promptInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
                setTimeout(() => {
                  promptInput.classList.remove('prompt-shake');
                  promptInput.style.borderColor = '';
                  promptInput.style.boxShadow = '';
                }, 600);
              }
              showGenToast('⬆ Select a tile to generate into');
              return;
            }
            targetTile = selectedGenTile[idx]!;
          }

          generatingPanelIdx = idx;
          updateView();

          try {
            // Build prompt with character context
            const charContext = characters.filter(c => c.description).map(c => `${c.name}: ${c.description}`).join('; ');
            const fullPrompt = charContext 
              ? `${prompt}, webtoon comic panel style, high detail. Characters: ${charContext}`
              : `${prompt}, webtoon comic panel style, high detail`;
            const result = await generateImage(fullPrompt, storySynopsis);
            const compressed = await compressImage(result.imageUrl);
            // Set the generated image into the correct tile
            if (!scrollPanels[idx].tiles) scrollPanels[idx].tiles = [null];
            while (scrollPanels[idx].tiles.length <= targetTile) scrollPanels[idx].tiles.push(null);
            scrollPanels[idx].tiles[targetTile] = compressed;
            scrollPanels[idx].image = compressed; // keep legacy field in sync
            saveDraft();
          } catch (err: any) {
            showModal({ title: 'Generation Error', content: `<p>${err.message}</p>`, confirmText: 'OK' });
          } finally {
            generatingPanelIdx = null;
            selectedGenTile[idx] = null;
            promptActivePanel = null;
            updateView();
          }
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
        ta.addEventListener('input', () => {
          const idx = parseInt(ta.getAttribute('data-notes') || '0');
          scrollPanels[idx].notes = (ta as HTMLTextAreaElement).value;
          saveDraft();
        });
      });

      // Long-press to delete tile
      wizard.querySelectorAll('[data-longpress]').forEach(row => {
        let pressTimer: ReturnType<typeof setTimeout> | null = null;
        const idx = parseInt(row.getAttribute('data-longpress') || '0');

        const startPress = (e: Event) => {
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
                scrollPrompts.splice(idx, 1);
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
        scrollPrompts.push('');
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
      document.getElementById('btn-dd-story-settings')?.addEventListener('click', () => {
        openStorySettings();
      });
      document.getElementById('btn-dd-add-panel')?.addEventListener('click', () => {
        scrollPanels.push({ image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]], audioUrl: null });
        scrollPrompts.push('');
        updateView();
      });

      // Panel gear icon clicks → open layout overlay
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

// ─── TEXT OVERLAY HANDLERS ───
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
    // If already recorded, ask for re-record confirmation
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
      document.getElementById('btn-save-exit')?.addEventListener('click', () => {
        saveDraft();
        navigate('library');
      });
      document.getElementById('btn-submit-review')?.addEventListener('click', () => {
        openStorySettings();
      });
    }


    // ─── ILLUSTRATED BOOK CANVAS (single page view) ───
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
      document.getElementById('btn-dd-story-settings')?.addEventListener('click', () => {
        openStorySettings();
      });
      document.getElementById('btn-dd-add-page')?.addEventListener('click', () => {
        bookPages.push(defaultBookPage());
        bookPrompts.push('');
        currentPage = bookPages.length - 1;
        updateView();
      });
      document.getElementById('btn-dd-storyboard')?.addEventListener('click', () => {
        openStoryboard();
      });

      // Arrow navigation
      document.getElementById('btn-book-prev')?.addEventListener('click', () => {
        if (currentPage > -1) { currentPage--; updateView(); }
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

      if (i === -1) {
        // Page 0: Settings inputs
        const thumbZone = document.getElementById('cover-thumb-zone');
        const thumbInput = document.getElementById('cover-thumb-input') as HTMLInputElement;
        const thumbPreview = document.getElementById('cover-thumb-preview') as HTMLImageElement;
        const thumbVideoPreview = document.getElementById('cover-video-preview') as HTMLVideoElement;
        const thumbPlaceholder = document.getElementById('cover-thumb-placeholder');

        if (thumbZone && thumbInput) {
          thumbZone.addEventListener('click', () => thumbInput.click());
          thumbInput.addEventListener('change', async () => {
            const file = thumbInput.files?.[0];
            if (file) {
              try {
                const isVid = file.type.startsWith('video/');
                if (isVid) {
                  const dataUrl = await fileToDataUrl(file);
                  storyCoverVideo = dataUrl;
                  _coverThumbnail = dataUrl;
                  if (thumbVideoPreview && thumbPreview && thumbPlaceholder) {
                    thumbVideoPreview.src = dataUrl;
                    thumbVideoPreview.style.display = 'block';
                    thumbPreview.style.display = 'none';
                    thumbPlaceholder.style.display = 'none';
                  }
                } else {
                  const dataUrl = await fileToDataUrl(file);
                  _coverThumbnail = await compressImage(dataUrl);
                  storyCoverVideo = '';
                  if (thumbPreview && thumbVideoPreview && thumbPlaceholder) {
                    thumbPreview.src = _coverThumbnail;
                    thumbPreview.style.display = 'block';
                    thumbVideoPreview.style.display = 'none';
                    thumbPlaceholder.style.display = 'none';
                  }
                }
                saveDraft();
              } catch (e) {
                console.error('Error uploading thumbnail media', e);
              }
            }
          });
        }

        document.getElementById('page0-title')?.addEventListener('input', (e) => {
          storyTitle = (e.target as HTMLInputElement).value;
          saveDraft();
        });
        document.getElementById('page0-genre')?.addEventListener('change', (e) => {
          storyGenre = (e.target as HTMLSelectElement).value as Genre;
          saveDraft();
        });
        document.getElementById('page0-synopsis')?.addEventListener('input', (e) => {
          storySynopsis = (e.target as HTMLTextAreaElement).value;
          saveDraft();
        });
      } else {
        // Normal Page Tile inputs
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
            bookPages[i].image = await fileToDataUrl(file);
            updateView();
          }
        });

        // Remove image
        wizard.querySelector(`[data-tile-remove-img="${i}"]`)?.addEventListener('click', (e) => {
          e.stopPropagation();
          bookPages[i].image = null;
          updateView();
        });

        // AI Generate
        wizard.querySelector(`[data-tile-gen="${i}"]`)?.addEventListener('click', async () => {
          const promptInput = wizard.querySelector(`[data-tile-prompt="${i}"]`) as HTMLInputElement;
          const prompt = promptInput?.value?.trim();
          if (!prompt || isGenerating) return;

          isGenerating = true;
          generatingTileIndex = i;
          bookPrompts[i] = prompt; // save for redo
          if (promptInput) promptInput.value = '';
          updateView();

          try {
            const result = await generateImage(prompt, bookPages[i].text);
            bookPages[i].image = await compressImage(result.imageUrl);
          } catch (err: any) {
            console.error('Image generation failed:', err);
            showModal({
              title: 'Generation Failed',
              content: `<p style="line-height:1.6;">${err?.message || 'Something went wrong.'}</p>`,
              confirmText: 'OK',
            });
          } finally {
            generatingTileIndex = null;
            isGenerating = false;
            updateView();
          }
        });

        // Redo
        wizard.querySelector(`[data-tile-redo="${i}"]`)?.addEventListener('click', async (e) => {
          e.stopPropagation();
          const prompt = bookPrompts[i];
          if (!prompt || isGenerating) return;
          isGenerating = true;
          bookPages[i].image = null;
          updateView();
          try {
            const result = await generateImage(prompt, bookPages[i].text);
            bookPages[i].image = await compressImage(result.imageUrl);
          } catch (err: any) { console.error('Redo failed:', err); }
          isGenerating = false;
          updateView();
        });

        // TTS
        wizard.querySelector(`[data-tile-tts="${i}"]`)?.addEventListener('click', () => {
          const text = bookPages[i].text;
          if (!text.trim()) return;
          if (isSpeaking()) { stopSpeaking(); } else { speakText(text); }
        });

        // Save text
        wizard.querySelector(`[data-tile-text="${i}"]`)?.addEventListener('input', () => {
          bookPages[i].text = (wizard.querySelector(`[data-tile-text="${i}"]`) as HTMLTextAreaElement).value;
          saveDraft();
        });

        // Save prompt
        wizard.querySelector(`[data-tile-prompt="${i}"]`)?.addEventListener('input', () => {
          bookPrompts[i] = (wizard.querySelector(`[data-tile-prompt="${i}"]`) as HTMLInputElement).value;
          saveDraft();
        });

        // Voice Tuning slider
        const stabilitySlider = wizard.querySelector(`[data-tile-stability="${i}"]`) as HTMLInputElement;
        stabilitySlider?.addEventListener('input', () => {
          const val = parseFloat(stabilitySlider.value);
          bookPages[i].stability = val;
          const pctEl = wizard.querySelector(`[data-tile-stability-pct="${i}"]`);
          if (pctEl) pctEl.textContent = Math.round(val * 100) + '%';
          saveDraft();
        });

        // Pre-record Audio for book page
        const doPrerecordBook = async (pageIdx: number) => {
          const text = bookPages[pageIdx].text;
          const btn = wizard?.querySelector(`[data-prerecord-book="${pageIdx}"]`) as HTMLButtonElement;
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
          const text = bookPages[i].text;
          if (!text || !text.trim()) {
            showModal({ title: 'No Story Text', content: '<p>Write some story text first before pre-recording.</p>', confirmText: 'OK' });
            return;
          }
          if (bookPages[i].audioUrl) {
            showModal({
              title: 'Re-record Audio',
              content: '<p style="line-height:1.6;">Would you like to re-record the story text? This will replace the existing recording.</p>',
              confirmText: 'Yes, Re-record',
              cancelText: 'Cancel',
              onConfirm: async () => {
                hideModal();
                await doPrerecordBook(i);
              }
            });
            return;
          }
          await doPrerecordBook(i);
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
        wizard.querySelector(`[data-tile-dd-content="${i}"]`)?.addEventListener('input', () => {
          bookPages[i].deeperDiveContent = (wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement).value;
          saveDraft();
        });

        // Voice Note
        wizard.querySelector(`[data-tile-dd-voice="${i}"]`)?.addEventListener('click', () => {
          handleVoiceNote(i, wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement, wizard.querySelector(`[data-tile-dd-voice="${i}"]`)!);
        });

        // Clean Up
        wizard.querySelector(`[data-tile-dd-cleanup="${i}"]`)?.addEventListener('click', () => {
          handleCleanUp(i, wizard.querySelector(`[data-tile-dd-content="${i}"]`) as HTMLTextAreaElement, wizard.querySelector(`[data-tile-dd-cleanup="${i}"]`)!);
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
            if ((e.target as HTMLElement).closest('input, textarea, button')) return;
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
                onConfirm: () => { bookPages.splice(i, 1); bookPrompts.splice(i, 1); if (currentPage >= bookPages.length) currentPage = bookPages.length - 1; updateView(); },
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
    }

    // ─── DETAILS ───
    if (phase === 'details') {
      const titleInput = document.getElementById('input-title') as HTMLInputElement;
      const genreInput = document.getElementById('input-genre') as HTMLSelectElement;
      const synopsisInput = document.getElementById('input-synopsis') as HTMLTextAreaElement;
      const submitBtn = document.getElementById('btn-submit') as HTMLButtonElement;

      const syncInputs = () => {
        storyTitle = titleInput?.value || '';
        storyGenre = (genreInput?.value || 'Fantasy') as Genre;
        storySynopsis = synopsisInput?.value || '';
        if (submitBtn) submitBtn.disabled = !storyTitle.trim();
      };

      titleInput?.addEventListener('input', syncInputs);
      genreInput?.addEventListener('change', syncInputs);
      synopsisInput?.addEventListener('input', syncInputs);

      document.getElementById('btn-details-back')?.addEventListener('click', () => { phase = 'canvas'; updateView(); });

      submitBtn?.addEventListener('click', () => {
        showModal({
          title: 'Submit Story',
          content: '<p style="line-height:1.6;">Are you sure you want to submit your story for review?</p>',
          confirmText: 'Submit',
          cancelText: 'Cancel',
          onConfirm: async () => {
            const pages = selectedFormat === 'book'
              ? bookPages.map(p => ({ image: p.image, text: p.text }))
              : scrollPanels.map(p => ({ image: p.image, text: p.notes }));
            const newStory: UserStory = {
              id: 'us-' + Date.now(),
              title: storyTitle,
              genre: storyGenre,
              format: selectedFormat as StoryFormat,
              synopsis: storySynopsis,
              status: 'under-review',
              createdAt: new Date().toISOString(),
              pages,
              coverImage: _coverThumbnail || pages[0]?.image || '',
            };
            try {
              await addUserStory(newStory);
              clearDraft();
              navigate('library');
            } catch (err) {
              console.error(err);
              alert('Failed to submit story. Please try again.');
            }
          }
        });
      });
    }
  };

  attachListeners();
}
