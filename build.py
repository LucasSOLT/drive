import re
import sys

with open('src/views/create.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify imports
imports = '''import type { StoryFormat, Genre, Story } from '../types.ts';
import { genres } from '../data/stories.ts';
import { navigate, getCurrentRoute, getRouteParam } from '../router.ts';
import { showModal, hideModal } from '../components/modal.ts';
import { generateImage } from '../lib/image-gen.ts';
import { speakText, stopSpeaking, isSpeaking } from '../lib/tts.ts';
import { cleanUpText } from '../lib/groq.ts';
import { saveOfficialStory, fetchOfficialStories } from '../lib/db.ts';
'''

# State
state = '''
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
}
let scrollPanels: ScrollPanel[] = [
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]] },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]] },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]] },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]] },
  { image: null, notes: '', layout: 'single', tiles: [null], textOverlays: [[]] },
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
let panelLayoutOverlay: number | null = null;

// Illustrated Book state
interface BookPage {
  image: string | null;
  text: string;
  stability: number;
  deeperDiveContent: string;
}
const defaultBookPage = (): BookPage => ({ image: null, text: '', stability: 0.5, deeperDiveContent: '' });
let bookPages: BookPage[] = [
  defaultBookPage(), defaultBookPage(), defaultBookPage(),
  defaultBookPage(), defaultBookPage(),
];
let bookPrompts: string[] = ['', '', '', '', '']; 
let currentPage = 0;
let isGenerating = false;
let generatingTileIndex: number | null = null;
let activeDraftId: string | null = null;
let _coverThumbnail: string | null = null;
let editStoryId: string | null = null;
'''

def extract(pattern_start, pattern_end):
    start_match = re.search(pattern_start, content)
    if not start_match:
        print(f"Could not find start pattern {pattern_start}")
        sys.exit(1)
    if pattern_end:
        end_match = re.search(pattern_end, content[start_match.start():])
        if not end_match:
            print(f"Could not find end pattern {pattern_end}")
            sys.exit(1)
        return content[start_match.start() : start_match.start() + end_match.start()]
    else:
        return content[start_match.start():]

icons_and_helpers = extract(r'// ─── SVG Icons ───', r'// ─── DRAFT PERSISTENCE')

# Draft persistence
drafts = '''
// ─── DRAFT PERSISTENCE ───
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
  scrollPrompts?: string[];
  characters?: StudioCharacter[];
  scriptText?: string;
  studioOpen?: boolean;
  bookPages: BookPage[];
  bookPrompts: string[];
  currentPage: number;
  updatedAt: string;
  coverThumbnail?: string | null;
  editStoryId?: string | null;
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
    scrollPrompts,
    characters,
    scriptText,
    studioOpen,
    bookPages,
    bookPrompts,
    currentPage,
    updatedAt: new Date().toISOString(),
    coverThumbnail: _coverThumbnail,
    editStoryId
  };
  localStorage.setItem('drive_admin_create_draft', JSON.stringify(entry));
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
  _coverThumbnail = draft.coverThumbnail || null;
  editStoryId = draft.editStoryId || null;
}

function clearDraft() {
  localStorage.removeItem('drive_admin_create_draft');
  activeDraftId = null;
  editStoryId = null;
}
'''

canvas_toolbar = extract(r'const layoutOptions', r'// ═══════════════════════════════════════\s*//\s*WATERFALL STORYBOARD CANVAS')

scroll_canvas = extract(r'// ═══════════════════════════════════════\s*//\s*WATERFALL STORYBOARD CANVAS', r'// ═══════════════════════════════════════\s*//\s*ILLUSTRATED BOOK CANVAS')
scroll_canvas = scroll_canvas.replace('id="btn-save-exit"', 'id="btn-save-exit"').replace('Save & Exit', 'Exit').replace('id="btn-submit-review"', 'id="btn-submit-review"').replace('Submit for Review', 'Story Settings')

book_canvas = extract(r'// ═══════════════════════════════════════\s*//\s*ILLUSTRATED BOOK CANVAS', r'// ═══════════════════════════════════════\s*//\s*FULLSCREEN PAGE VIEWER')

fullscreen = extract(r'// ═══════════════════════════════════════\s*//\s*FULLSCREEN PAGE VIEWER', r'// ═══════════════════════════════════════\s*//\s*STORYBOARD')

storyboard_and_fns = extract(r'// ═══════════════════════════════════════\s*//\s*STORYBOARD', r'// ═══════════════════════════════════════\s*//\s*DETAILS')

settings_func = '''
function openStorySettings(): void {
  const wizard = document.getElementById('admin-create-wizard');
  if (!wizard) return;

  const formatLabels: Record<string, string> = {
    'scroll': 'Waterfall Storyboard',
    'book': 'Illustrated Book',
    'comic': 'Comic Strip',
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
          <div class="ss-section__label">Cover Thumbnail</div>
          <div class="ss-field">
            <div id="modal-cover-thumb-zone" style="width: 100%; height: 180px; border-radius: 16px; border: 2px dashed var(--color-border); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; background: var(--color-surface);">
              <div id="modal-cover-thumb-placeholder" style="text-align: center; color: var(--color-text-muted); ${_coverThumbnail ? 'display: none;' : ''}">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style="font-size: 0.75rem; margin-top: 6px;">Tap to upload cover image</p>
              </div>
              <img id="modal-cover-thumb-preview" style="width: 100%; height: 100%; object-fit: cover; ${_coverThumbnail ? 'display: block;' : 'display: none;'}" ${_coverThumbnail ? `src="${_coverThumbnail}"` : ''} />
            </div>
            <input type="file" id="modal-cover-thumb-input" accept="image/*" style="display: none;" />
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
          <div class="ss-field">
            <label class="ss-field__label" for="ss-cover-video">Cover Video URL (optional)</label>
            <input type="text" id="ss-cover-video" class="ss-field__input" value="${storyCoverVideo}" placeholder="https://..." />
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
  const modalThumbPlaceholder = document.getElementById('modal-cover-thumb-placeholder');

  if (modalThumbZone && modalThumbInput) {
    modalThumbZone.addEventListener('click', () => modalThumbInput.click());
    modalThumbInput.addEventListener('change', async () => {
      const file = modalThumbInput.files?.[0];
      if (file) {
        try {
          const dataUrl = await fileToDataUrl(file);
          _coverThumbnail = await compressImage(dataUrl);
          if (modalThumbPreview && modalThumbPlaceholder) {
            modalThumbPreview.src = _coverThumbnail;
            modalThumbPreview.style.display = 'block';
            modalThumbPlaceholder.style.display = 'none';
          }
          saveDraft();
        } catch (e) {
          console.error('Error compressing cover image', e);
        }
      }
    });
  }

  document.getElementById('ss-back')?.addEventListener('click', () => {
    getFormData();
    updateView();
  });

  const getFormData = () => {
    storyTitle = (document.getElementById('ss-title') as HTMLInputElement)?.value || storyTitle || 'Untitled';
    storyAuthorName = (document.getElementById('ss-author') as HTMLInputElement)?.value || 'DRiVE Studios';
    storyGenre = ((document.getElementById('ss-genre') as HTMLSelectElement)?.value || 'Fantasy') as Genre;
    storySynopsis = (document.getElementById('ss-synopsis') as HTMLTextAreaElement)?.value || '';
    storyContentRating = ((document.getElementById('ss-rating') as HTMLSelectElement)?.value || 'All Ages') as any;
    storyCoverVideo = (document.getElementById('ss-cover-video') as HTMLInputElement)?.value || '';
  };

  const buildStory = (status: 'draft' | 'live'): Story => {
    getFormData();
    const pages = selectedFormat === 'book'
      ? bookPages.map(p => ({ image: p.image, text: p.text, stability: p.stability, deeperDiveContent: p.deeperDiveContent }))
      : scrollPanels.map(p => ({ image: p.image, text: p.notes }));
    return {
      id: editStoryId || 'story_' + Date.now(),
      title: storyTitle,
      author: storyAuthorName,
      genre: storyGenre,
      format: selectedFormat as StoryFormat,
      synopsis: storySynopsis,
      coverImage: _coverThumbnail || pages[0]?.image || '',
      readCount: 0,
      isFeatured: false,
      isEditorPick: false,
      panels: selectedFormat === 'book' ? pages.map(p => p.image || '') : scrollPanels.map(p => p.image || ''),
      pageScripts: selectedFormat === 'book' ? Object.fromEntries(pages.map((p, i) => [i, p.text])) : Object.fromEntries(scrollPanels.map((p, i) => [i, p.notes])),
      contentRating: storyContentRating,
      coverVideo: storyCoverVideo,
      isOfficial: true,
      officialStatus: status,
    };
  };

  document.getElementById('ss-save-draft-btn')?.addEventListener('click', async (e) => {
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
    getFormData();
    if (!storyTitle.trim()) {
      (document.getElementById('ss-title') as HTMLInputElement)?.focus();
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
'''

render_init = '''
function renderPhase(): string {
  if (phase === 'canvas') {
    return selectedFormat === 'book' ? renderBookCanvas() : renderScrollCanvas();
  }
  return '';
}

export function render(): string {
  return `
    <div class="view-create view-create--canvas" id="admin-create-container">
      <div class="create-wizard create-wizard--canvas slide-up stagger-1" id="admin-create-wizard">
        ${renderPhase()}
      </div>
    </div>
  `;
}

let updateView: () => void;
export function init(): void {
  const wizard = document.getElementById('admin-create-wizard');
  if (!wizard) return;

  const currentRoute = getCurrentRoute();
  const editId = getRouteParam('id');
  const queryMatch = window.location.hash.match(/format=([^&]+)/);
  const qFormat = queryMatch ? queryMatch[1] : null;

  const loadData = async () => {
    if (editId) {
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

        if (selectedFormat === 'book') {
           bookPages = storyToEdit.panels.map((p, i) => ({
             image: p, text: storyToEdit.pageScripts?.[i] || '', stability: 0.5, deeperDiveContent: ''
           }));
           bookPrompts = Array.from({length: bookPages.length}, () => '');
        } else {
           scrollPanels = storyToEdit.panels.map((p, i) => ({
             image: p, notes: storyToEdit.pageScripts?.[i] || '', layout: 'single', tiles: [p], textOverlays: [[]]
           }));
           scrollPrompts = Array.from({length: scrollPanels.length}, () => '');
        }
      }
    } else {
      const draft = getDraft();
      if (draft && (!qFormat || draft.selectedFormat === qFormat)) {
        loadDraft(draft);
      } else {
        selectedFormat = (qFormat as StoryFormat) || 'book';
      }
    }

    if (selectedFormat === 'book' && currentPage < -1) currentPage = 0;

    updateView = () => {
      saveDraft();
      const wiz = document.getElementById('admin-create-wizard');
      if (wiz) {
        wiz.innerHTML = renderPhase();
        attachListeners();
      }
    };
    updateView();
  };

  loadData();

'''

listeners = extract(r'const attachListeners = \(\) => \{', r'// ═══════════════════════════════════════\s*//\s*DETAILS')
# Clean up listeners to match our phase model
listeners = re.sub(r'// ─── LANDING PHASE ───.*?// ─── FORMAT SELECTION ───', '// ─── FORMAT SELECTION ───', listeners, flags=re.DOTALL)
listeners = re.sub(r'// ─── FORMAT SELECTION ───.*?// ─── GUIDE PHASE ───', '// ─── GUIDE PHASE ───', listeners, flags=re.DOTALL)
listeners = re.sub(r'// ─── GUIDE PHASE ───.*?// ─── ENDLESS SCROLL CANVAS', '// ─── ENDLESS SCROLL CANVAS', listeners, flags=re.DOTALL)
listeners = listeners.replace("navigate('library')", "navigate('admin')")
listeners = listeners.replace("document.getElementById('create-wizard')", "document.getElementById('admin-create-wizard')")
listeners = listeners.replace("const wizard = document.getElementById('create-wizard');", "const wizard = document.getElementById('admin-create-wizard');")
listeners = listeners.replace("showModal({ title: 'Description Needed', content: '<p>Please describe the character first.</p>', confirmText: 'OK' })", "showModal({ title: 'Description Needed', content: '<p>Please describe the character first.</p>' })")
listeners = listeners.replace("showModal({ title: 'Generation Error', content: `<p>${err.message}</p>`, confirmText: 'OK' })", "showModal({ title: 'Generation Error', content: `<p>${err.message}</p>` })")
listeners = listeners.replace("showModal({ title: 'Cannot Delete', content: '<p style=\"line-height:1.6;\">At least one page must remain.</p>', confirmText: 'OK' })", "showModal({ title: 'Cannot Delete', content: '<p style=\"line-height:1.6;\">At least one page must remain.</p>' })")
listeners = listeners.replace("showModal({ title: 'Cannot Delete', content: '<p style=\"line-height:1.6;\">At least one panel must remain in your scroll.</p>', confirmText: 'OK' })", "showModal({ title: 'Cannot Delete', content: '<p style=\"line-height:1.6;\">At least one panel must remain in your scroll.</p>' })")
listeners = listeners.replace("showModal({\n              title: 'Generation Failed',\n              content: `<p style=\"line-height:1.6;\">${err?.message || 'Something went wrong.'}</p>`,\n              confirmText: 'OK',\n            });", "showModal({ title: 'Generation Failed', content: `<p style=\"line-height:1.6;\">${err?.message || 'Something went wrong.'}</p>` });")
listeners = listeners.replace("showModal({\n              title: 'Visual Prompt Required',\n              content: '<p>Please enter a visual prompt for this panel.</p>',\n              confirmText: 'OK',\n            });", "showModal({ title: 'Visual Prompt Required', content: '<p>Please enter a visual prompt for this panel.</p>' });")


end = '''
    if (phase === 'canvas') {
      document.getElementById('btn-toolbar-quit')?.addEventListener('click', () => {
        showModal({
          title: 'Discard Changes?',
          content: '<p style="line-height:1.6;">Your unsaved edits will be lost. Are you sure you want to quit?</p>',
          confirmText: 'Discard',
          cancelText: 'Keep Editing',
          onConfirm: () => { clearDraft(); navigate('admin'); },
        });
      });
    }
  };
}
'''

full_code = imports + state + icons_and_helpers + drafts + canvas_toolbar + scroll_canvas + book_canvas + fullscreen + storyboard_and_fns + settings_func + render_init + listeners + end

full_code = full_code.replace("create-wizard", "admin-create-wizard")

with open('src/views/admin-create.ts', 'w', encoding='utf-8') as f:
    f.write(full_code)
print('Done!')
