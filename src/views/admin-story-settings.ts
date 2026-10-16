/**
 * Admin Dashboard > "Edit Story Settings" modal.
 *
 * Edits the story-level fields shared by every episode (title, synopsis, genre, theme color,
 * cover video) and the whole cast: custom characters plus the permanent Narrator and Story Text.
 * Every voice (including Narrator and Story Text) has a Mute toggle.
 *
 * This is intentionally NOT subject to the "live episodes are read-only" lock of the episode editor:
 * it is the one place where shared settings and the cast stay editable after going live.
 */
import type { Story, StoryCharacter } from '../types.ts';
import { showModal } from '../components/modal.ts';
import { VOICE_OPTIONS } from '../lib/settings.ts';
import { auditionVoice, primeAuditionAudio } from '../lib/voice-lab.ts';
import { uploadMedia } from '../lib/storage.ts';
import { updateSharedStorySettings } from '../lib/db.ts';
import {
  buildGroupPatch,
  isHexColor,
  readGroupSettings,
  validateSettings,
  type GroupSettings,
} from '../lib/story-settings.ts';
import { CHARACTER_PALETTE, renderGroupedVoiceOptions } from './admin-create.ts';

const ALL_GENRES = [
  'Fantasy', 'Sci-Fi', 'Romance', 'Horror', 'Comedy', 'Drama', 'Mystery', 'Slice of Life',
  'Action', 'Adventure', 'Thriller', 'Historical', 'Superhero', 'Sports', 'Psychological',
  'Supernatural', 'Mecha', 'Musical', 'Custom',
];

/** Narrator / Story Text colors (narrator default first), no repeats. */
const FIXED_PALETTE = ['#7C6FFA', ...CHARACTER_PALETTE];

interface Slot {
  voiceId: string;
  color?: string;
  muted?: boolean;
}

export interface StorySettingsModalOptions {
  /** story_group_id (or the first episode's id for older single-episode stories). */
  groupId: string;
  /** Every official story currently loaded in the dashboard. */
  stories: Story[];
  /** Called after a successful save with the fields now stored on every episode. */
  onSaved: (patch: Partial<Story>) => void;
  /** Called when the modal is dismissed or saved (used to return to the episode editor). */
  onClose?: () => void;
}

function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isFreeVoice(voiceId: string): boolean {
  return voiceId.startsWith('free-google');
}

/** First palette color no character uses yet. */
function nextFreeColor(chars: StoryCharacter[]): string {
  const used = new Set(chars.map(c => (c.color || '').toLowerCase()));
  return CHARACTER_PALETTE.find(c => !used.has(c.toLowerCase())) || CHARACTER_PALETTE[chars.length % CHARACTER_PALETTE.length];
}

function newCharacterId(): string {
  return 'char_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface CardOptions {
  key: string;
  badge: string;
  slot: Slot;
  palette: string[];
  /** Fixed cards (Narrator / Story Text) show a title; custom cards show a name input. */
  fixedTitle?: string;
  fixedDesc?: string;
  name?: string;
}

function renderCard(o: CardOptions): string {
  const color = o.slot.color || o.palette[0];
  const muted = !!o.slot.muted;
  const fixed = o.fixedTitle !== undefined;
  const nameBlock = fixed
    ? `
        <span class="ss-char-card__name-label">Always in your cast</span>
        <div class="sset-fixed-title">${esc(o.fixedTitle || '')}</div>
        <div class="sset-fixed-desc">${esc(o.fixedDesc || '')}</div>`
    : `
        <span class="ss-char-card__name-label">Character name</span>
        <input class="ss-char-card__name-input" data-sset-name="${o.key}" value="${esc(o.name || '')}" placeholder="e.g. Elena, Shadow, Commander Jax" maxlength="30" />`;
  const muteBtn = `
      <button type="button" class="ss-mute-btn ${muted ? 'ss-mute-btn--on' : ''}" data-sset-mute="${o.key}" aria-pressed="${muted}"
        title="${muted ? 'Muted: this voice is silent. Click to unmute.' : 'Click to mute: this voice becomes silent.'}">${muted ? '🔇 Muted' : '🔊 Voice on'}</button>`;
  const deleteBtn = fixed
    ? ''
    : `<button class="ss-char-card__delete-btn" data-sset-delete="${o.key}" type="button" title="Remove character" aria-label="Remove character">🗑</button>`;
  const audition = isFreeVoice(o.slot.voiceId)
    ? `<button class="ss-char-audition-btn" type="button" disabled title="Free Google voices have no preview">🔊 Audition</button>`
    : `<button class="ss-char-audition-btn" data-sset-audition="${o.key}" type="button">🔊 Audition</button>`;

  return `
    <div class="ss-char-card ${fixed ? 'ss-char-card--fixed' : ''} ${muted ? 'ss-char-card--muted' : ''}" data-sset-card="${o.key}" style="--char-color:${color};">
      <div class="ss-char-card__top">
        <div class="ss-char-card__badge" style="background-color:${color}; box-shadow:0 3px 12px ${color}40;">${o.badge}</div>
        <div class="ss-char-card__name-wrap">${nameBlock}
        </div>
        ${muteBtn}
        ${deleteBtn}
      </div>
      <div class="ss-char-card__palette-wrap">
        <span class="ss-char-card__palette-label">Color:</span>
        <div class="ss-char-color-dots">
          ${o.palette
            .map(
              c => `<button type="button" class="ss-char-color-dot ${color.toLowerCase() === c.toLowerCase() ? 'ss-char-color-dot--active' : ''}" data-sset-color="${o.key}" data-color="${c}" style="background-color:${c};" title="Select color" aria-label="Color ${c}"></button>`
            )
            .join('')}
        </div>
      </div>
      <div class="ss-char-card__voice-wrap">
        <span class="ss-char-card__voice-label">Voice Actor</span>
        <div class="ss-char-card__voice-row">
          <select class="ss-char-voice-select" data-sset-voice="${o.key}">
            ${renderGroupedVoiceOptions(o.slot.voiceId)}
          </select>
          ${audition}
        </div>
      </div>
    </div>`;
}

function formHtml(s: GroupSettings): string {
  const genreOptions = ALL_GENRES.includes(s.genre) ? ALL_GENRES : [s.genre, ...ALL_GENRES];
  return `
    <div class="sset">
      <div class="sset-note">These settings apply to <strong>every episode</strong> of this story and can be changed even while episodes are live.</div>

      <div class="sset-section">
        <div class="ss-section__label">Story Information</div>
        <label class="ss-field__label" for="sset-title">Title <span class="ss-required">*</span></label>
        <input type="text" id="sset-title" class="ss-field__input" value="${esc(s.title)}" maxlength="80" />
        <label class="ss-field__label" for="sset-synopsis">Synopsis</label>
        <textarea id="sset-synopsis" class="ss-field__textarea" rows="3" maxlength="500">${esc(s.synopsis)}</textarea>
        <label class="ss-field__label" for="sset-genre">Genre</label>
        <select id="sset-genre" class="ss-field__select">
          ${genreOptions.map(g => `<option value="${esc(g)}" ${g === s.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
        <label class="ss-field__label" for="sset-manual-numbering" style="display:flex; align-items:center; gap:8px; margin-top:12px; cursor:pointer;">
          <input type="checkbox" id="sset-manual-numbering" ${s.manualNumbering ? 'checked' : ''} />
          <span>Manual Episode Numbering (allow custom &amp; decimal episode numbers like 2.5)</span>
        </label>
      </div>

      <div class="sset-section">
        <div class="ss-section__label">Look &amp; Cover</div>
        <label class="ss-field__label" for="sset-theme-color">Theme color</label>
        <div class="sset-row">
          <input type="color" id="sset-theme-color" value="${esc(s.themeColor)}" title="Pick a theme color" />
          <input type="text" id="sset-theme-hex" class="ss-field__input sset-hex" value="${esc(s.themeColor)}" maxlength="7" />
        </div>
        <label class="ss-field__label" for="sset-cover-video">Cover video (plays on hover)</label>
        <div class="sset-row">
          <input type="text" id="sset-cover-video" class="ss-field__input" value="${esc(s.coverVideo)}" placeholder="https://… (optional)" />
          <label class="btn btn--sm btn--secondary sset-upload">Upload<input type="file" id="sset-cover-file" accept="video/*" hidden /></label>
        </div>
        <div class="ss-field__hint" id="sset-cover-status"></div>
      </div>

      <div class="sset-section">
        <div class="ss-section__label">Cast &amp; Characters</div>
        <p class="sset-help">
          Mute any voice, the <strong>Narrator</strong> and <strong>Story Text</strong> included, to make its dialogue silent.
          Muted text stays in the story but is shown faded. Removing a character keeps its dialogue lines; they simply show as an unknown speaker until reassigned.
        </p>
        <div class="ss-char-container" id="sset-cast"></div>
        <button class="ss-char-add-card" id="sset-add-char" type="button">+ Add Character</button>
      </div>

      <div id="sset-error" class="sset-error" role="alert" hidden></div>
    </div>`;
}

/** Opens the modal. Returns false when the story group cannot be found. */
export function openStorySettingsModal(opts: StorySettingsModalOptions): boolean {
  const episodes = opts.stories.filter(s => (s.storyGroupId || s.id) === opts.groupId);
  const loaded = readGroupSettings(episodes);
  if (!loaded) return false;

  const state: GroupSettings = loaded;
  const originalCoverVideo = loaded.coverVideo;

  const slotFor = (key: string): Slot | null => {
    if (key === 'narrator') return state.narrator;
    if (key === 'plain_text') return state.plainText;
    const idx = Number(key.slice(1));
    return key.startsWith('c') && state.characters[idx] ? state.characters[idx] : null;
  };

  const root = (): HTMLElement | null => document.querySelector('.sset');
  const q = <T extends HTMLElement>(sel: string): T | null => root()?.querySelector<T>(sel) ?? null;

  const showError = (message: string): void => {
    const box = q<HTMLElement>('#sset-error');
    if (!box) return;
    box.textContent = message;
    box.hidden = !message;
    if (message) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const renderCast = (): void => {
    const host = q<HTMLElement>('#sset-cast');
    if (!host) return;
    const cards = [
      renderCard({
        key: 'narrator', badge: '🎙️', slot: state.narrator, palette: FIXED_PALETTE,
        fixedTitle: 'Narrator', fixedDesc: 'Reads lines written as NARRATOR: "..."',
      }),
      renderCard({
        key: 'plain_text', badge: '📖', slot: state.plainText, palette: FIXED_PALETTE,
        fixedTitle: 'Story Text', fixedDesc: "Reads normal text that isn't tagged to a character or the Narrator.",
      }),
      ...state.characters.map((c, i) =>
        renderCard({
          key: 'c' + i, badge: esc((c.name.trim().charAt(0) || '?').toUpperCase()),
          slot: c, palette: CHARACTER_PALETTE, name: c.name,
        })
      ),
    ];
    host.innerHTML = cards.join('');
  };

  /** Copy the plain text/select fields into state before validating or saving. */
  const readFormIntoState = (): void => {
    state.title = q<HTMLInputElement>('#sset-title')?.value ?? state.title;
    state.synopsis = q<HTMLTextAreaElement>('#sset-synopsis')?.value ?? state.synopsis;
    state.genre = q<HTMLSelectElement>('#sset-genre')?.value ?? state.genre;
    const hex = (q<HTMLInputElement>('#sset-theme-hex')?.value ?? state.themeColor).trim();
    state.themeColor = hex && !hex.startsWith('#') ? '#' + hex : hex;
    state.coverVideo = (q<HTMLInputElement>('#sset-cover-video')?.value ?? state.coverVideo).trim();
    const manualEl = q<HTMLInputElement>('#sset-manual-numbering');
    if (manualEl) state.manualNumbering = manualEl.checked;
  };

  let auditionBusy: HTMLButtonElement | null = null;
  const runAudition = (btn: HTMLButtonElement, voiceId: string, name: string): void => {
    primeAuditionAudio(); // must run synchronously inside the tap (iPhone)
    if (auditionBusy) return;
    auditionBusy = btn;
    btn.disabled = true;
    btn.textContent = '⏳ Loading...';
    const reset = (): void => {
      auditionBusy = null;
      btn.disabled = false;
      btn.textContent = '🔊 Audition';
    };
    auditionVoice(voiceId, name)
      .then(audio => {
        if (!audio) return reset();
        btn.textContent = '🔊 Playing...';
        audio.addEventListener('ended', reset, { once: true });
        audio.addEventListener('pause', reset, { once: true });
        audio.addEventListener('error', reset, { once: true });
      })
      .catch((err: any) => {
        reset();
        showError(err?.message || 'Could not play this voice.');
      });
  };

  showModal({
    title: `Story Settings: ${esc(state.title)}`,
    content: formHtml(state),
    confirmText: 'Save Settings',
    cancelText: 'Cancel',
    onCancel: () => opts.onClose?.(),
    onConfirm: async () => {
      showError('');
      readFormIntoState();
      const problem = validateSettings(state);
      if (problem) {
        showError(problem);
        return false;
      }
      const patch: Partial<Story> = buildGroupPatch(state);
      if (state.coverVideo !== originalCoverVideo) patch.coverVideo = state.coverVideo;

      const saveBtn = document.getElementById('modal-confirm-btn') as HTMLButtonElement | null;
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
      let saved = false;
      try {
        saved = await updateSharedStorySettings(opts.groupId, patch);
      } catch (err) {
        console.warn('[AdminStorySettings] save failed:', err);
      }
      if (!saved) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Settings'; }
        showError('Could not save to the server. Check your connection and try again.');
        return false;
      }
      opts.onSaved(patch);
      opts.onClose?.();
      return true;
    },
  });

  renderCast();
  const el = root();
  if (!el) return true;

  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;

    const muteBtn = t.closest<HTMLElement>('[data-sset-mute]');
    if (muteBtn) {
      const slot = slotFor(muteBtn.dataset.ssetMute || '');
      if (slot) { slot.muted = !slot.muted; renderCast(); }
      return;
    }
    const dot = t.closest<HTMLElement>('[data-sset-color]');
    if (dot) {
      const slot = slotFor(dot.dataset.ssetColor || '');
      if (slot && dot.dataset.color) { slot.color = dot.dataset.color; renderCast(); }
      return;
    }
    const del = t.closest<HTMLElement>('[data-sset-delete]');
    if (del) {
      const key = del.dataset.ssetDelete || '';
      if (key.startsWith('c')) { state.characters.splice(Number(key.slice(1)), 1); renderCast(); }
      return;
    }
    if (t.closest('#sset-add-char')) {
      showError('');
      state.characters.push({
        id: newCharacterId(),
        name: '',
        voiceId: VOICE_OPTIONS[0]?.voiceId || '',
        color: nextFreeColor(state.characters),
      });
      renderCast();
      const inputs = el.querySelectorAll<HTMLInputElement>('[data-sset-name]');
      inputs[inputs.length - 1]?.focus();
      return;
    }
    const aud = t.closest<HTMLButtonElement>('[data-sset-audition]');
    if (aud) {
      const key = aud.dataset.ssetAudition || '';
      const slot = slotFor(key);
      const name = key === 'narrator' ? 'the Narrator' : key === 'plain_text' ? 'Story Text' : state.characters[Number(key.slice(1))]?.name || 'your character';
      if (slot) runAudition(aud, slot.voiceId, name);
    }
  });

  el.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    const voiceSel = t.closest<HTMLSelectElement>('[data-sset-voice]');
    if (voiceSel) {
      const key = voiceSel.dataset.ssetVoice || '';
      const slot = slotFor(key);
      if (slot) {
        slot.voiceId = voiceSel.value;
        renderCast(); // refresh Audition (free voices have none)
      }
    }
  });

  el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-sset-name]')) {
      const key = t.dataset.ssetName || '';
      const idx = Number(key.slice(1));
      if (state.characters[idx]) {
        state.characters[idx].name = t.value;
        const badge = t.closest('.ss-char-card')?.querySelector('.ss-char-card__badge');
        if (badge) badge.textContent = (t.value.trim().charAt(0) || '?').toUpperCase();
      }
    } else if (t.id === 'sset-theme-color') {
      const hex = q<HTMLInputElement>('#sset-theme-hex');
      if (hex) hex.value = t.value;
    } else if (t.id === 'sset-theme-hex') {
      let v = t.value.trim();
      if (v && !v.startsWith('#')) v = '#' + v;
      if (isHexColor(v)) {
        const picker = q<HTMLInputElement>('#sset-theme-color');
        if (picker) picker.value = v;
      }
    }
  });

  q<HTMLInputElement>('#sset-cover-file')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    const status = q<HTMLElement>('#sset-cover-status');
    if (!file) return;
    if (status) status.textContent = 'Uploading…';
    try {
      const res = await uploadMedia(file, 'covers');
      const field = q<HTMLInputElement>('#sset-cover-video');
      if (field) field.value = res.url;
      if (status) status.textContent = 'Uploaded. Save to apply.';
    } catch (err: any) {
      if (status) status.textContent = 'Upload failed: ' + (err?.message || 'unknown error');
    }
  });

  return true;
}
