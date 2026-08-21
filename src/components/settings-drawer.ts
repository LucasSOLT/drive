// ─── Settings Drawer Component ───

import { getSettings, updateSettings, setDarkMode, isDarkMode, VOICE_OPTIONS, setTextSize } from '../lib/settings.ts';
import { isAuthenticated } from '../lib/auth.ts';
import { navigate } from '../router.ts';
import { supabase } from '../lib/supabase.ts';

const PREVIEW_TEXT = 'Welcome to DRiVE. Let me narrate your story.';

const GEAR_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const STOP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

let _previewAudio: HTMLAudioElement | null = null;
let _previewUrl: string | null = null;
let _previewingVoiceId: string | null = null;
let _previewBtn: HTMLElement | null = null;

function getPlaybackRate(): number {
  const speed = getSettings().readingSpeed;
  if (speed === 'slow') return 0.75;
  if (speed === 'fast') return 1.35;
  return 1.0;
}

function stopPreview(): void {
  if (_previewAudio) {
    _previewAudio.pause();
    _previewAudio.removeAttribute('src');
    _previewAudio = null;
  }
  if (_previewUrl) {
    URL.revokeObjectURL(_previewUrl);
    _previewUrl = null;
  }
  _previewingVoiceId = null;
  _previewBtn = null;
  // Reset all preview button icons
  document.querySelectorAll('.settings-voice-card__preview').forEach(btn => {
    btn.innerHTML = PLAY_ICON;
    btn.classList.remove('settings-voice-card__preview--playing');
  });
}

async function playPreview(voiceId: string, btn: HTMLElement): Promise<void> {
  if (_previewingVoiceId === voiceId) {
    stopPreview();
    return;
  }

  stopPreview();
  _previewingVoiceId = voiceId;
  _previewBtn = btn;
  btn.innerHTML = STOP_ICON;
  btn.classList.add('settings-voice-card__preview--playing');

  try {
    // Try static preview URL first
    const voiceOption = VOICE_OPTIONS.find(v => v.voiceId === voiceId);
    if (voiceOption?.previewUrl) {
      const audio = new Audio(voiceOption.previewUrl);
      audio.playbackRate = getPlaybackRate();
      _previewAudio = audio;
      audio.addEventListener('ended', () => stopPreview());
      audio.addEventListener('error', () => {
        console.warn('[TTS Preview] Static preview failed, trying edge function...');
        playViaEdgeFunction(voiceId, btn);
      });
      await audio.play();
      return;
    }

    // Fall back to edge function
    await playViaEdgeFunction(voiceId, btn);
  } catch (err) {
    console.warn('[TTS Preview] Failed:', err);
    stopPreview();
  }
}

async function playViaEdgeFunction(voiceId: string, btn: HTMLElement): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
      body: {
        endpoint: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        body: {
          text: PREVIEW_TEXT,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }
      }
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || 'TTS preview failed');
    }

    const binaryStr = atob(data.audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.content_type || 'audio/mpeg' });

    const url = URL.createObjectURL(blob);
    _previewUrl = url;

    const audio = new Audio(url);
    audio.playbackRate = getPlaybackRate();
    _previewAudio = audio;
    audio.addEventListener('ended', () => stopPreview());
    audio.addEventListener('error', () => stopPreview());
    await audio.play();
  } catch (err) {
    console.warn('[TTS Preview] Edge function failed:', err);
    stopPreview();
  }
}

export function getGearButtonHtml(): string {
  return `
    <button class="header-settings-btn" id="header-settings-btn" aria-label="Settings">
      ${GEAR_ICON}
    </button>
  `;
}

function renderReadingSpeedSelector(current: string): string {
  const options = ['slow', 'normal', 'fast'];
  return options.map(opt => {
    const isActive = opt === current;
    return `<button class="settings-speed-btn ${isActive ? 'settings-speed-btn--active' : ''}" data-speed="${opt}">${opt.charAt(0).toUpperCase() + opt.slice(1)}</button>`;
  }).join('');
}

function renderTextSizeSelector(current: string): string {
  const options = ['small', 'medium', 'large'];
  return options.map(opt => {
    const isActive = opt === current;
    return `<button class="settings-speed-btn ${isActive ? 'settings-speed-btn--active' : ''}" data-textsize="${opt}">${opt.charAt(0).toUpperCase() + opt.slice(1)}</button>`;
  }).join('');
}

function renderSettingsDrawer(): string {
  const settings = getSettings();
  const currentVoice = settings.selectedVoiceId;
  const authed = isAuthenticated();

  const voiceCards = VOICE_OPTIONS.map(v => {
    const isSelected = v.voiceId === currentVoice;
    return `
      <div class="settings-voice-card ${isSelected ? 'settings-voice-card--active' : ''}" data-voice-id="${v.voiceId}">
        <div class="settings-voice-card__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        </div>
        <div class="settings-voice-card__info">
          <span class="settings-voice-card__name">${v.name}</span>
          <span class="settings-voice-card__desc">${v.description}</span>
        </div>
        <button class="settings-voice-card__preview" data-preview-voice="${v.voiceId}" title="Preview voice">${PLAY_ICON}</button>
        ${isSelected ? '<span class="settings-voice-card__check">✓</span>' : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="settings-drawer-backdrop" id="settings-drawer-backdrop">
      <div class="settings-drawer" id="settings-drawer">
        <!-- Handle -->
        <div class="settings-drawer__handle"><span></span></div>

        <!-- Header -->
        <div class="settings-drawer__header">
          <h2 class="settings-drawer__title">Settings</h2>
          <button class="settings-drawer__close" id="settings-drawer-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Scrollable content -->
        <div class="settings-drawer__content">

          <!-- APPEARANCE -->
          <div class="settings-section">
            <h3 class="settings-section__title">Appearance</h3>
            <div class="settings-row">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                <span>Dark Mode</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settings-dark-mode" ${settings.darkMode ? 'checked' : ''}>
                <span class="settings-toggle__slider"></span>
              </label>
            </div>
            <div class="settings-row">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V4h16v3"></path><path d="M9 20h6"></path><path d="M12 4v16"></path></svg>
                <span>Text Size</span>
              </div>
              <div class="settings-speed-group" id="settings-text-size-group">
                ${renderTextSizeSelector(settings.textSize)}
              </div>
            </div>
          </div>

          <!-- VOICE -->
          <div class="settings-section">
            <h3 class="settings-section__title">Narrator Voice</h3>
            <p class="settings-section__subtitle">Tap a card to select · press ▶ to preview</p>
            <div class="settings-voice-grid" id="settings-voice-grid">
              ${voiceCards}
            </div>
          </div>

          <!-- READING -->
          <div class="settings-section">
            <h3 class="settings-section__title">Reading</h3>
            <div class="settings-row">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Reading Speed</span>
              </div>
              <div class="settings-speed-group" id="settings-speed-group">
                ${renderReadingSpeedSelector(settings.readingSpeed)}
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                <span>Auto-Play Pages</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settings-autoplay" ${settings.autoPlay ? 'checked' : ''}>
                <span class="settings-toggle__slider"></span>
              </label>
            </div>
          </div>

          <!-- GENERAL -->
          <div class="settings-section">
            <h3 class="settings-section__title">General</h3>
            <div class="settings-row">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span>Auto-Save Drafts</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" id="settings-autosave" ${settings.autoSave ? 'checked' : ''}>
                <span class="settings-toggle__slider"></span>
              </label>
            </div>
            <div class="settings-row settings-row--disabled">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span>Notifications</span>
              </div>
              <label class="settings-toggle">
                <input type="checkbox" disabled ${settings.notifications ? 'checked' : ''}>
                <span class="settings-toggle__slider"></span>
              </label>
            </div>
            <div class="settings-row settings-row--disabled">
              <div class="settings-row__left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <span>Language</span>
              </div>
              <span class="settings-row__value">${settings.language}</span>
            </div>
          </div>

          <!-- ACCOUNT ACTIONS -->
          ${authed ? `
            <div class="settings-section" style="border-bottom:none; padding-bottom:0;">
              <button class="settings-add-account-btn" id="settings-add-account-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                <span>Add Another Account</span>
              </button>
              <button class="settings-logout-btn" id="settings-logout-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Log Out</span>
              </button>
            </div>
          ` : ''}

        </div>
      </div>
    </div>
  `;
}

export function injectSettingsDrawer(): void {
  // Remove old drawer if exists
  document.getElementById('settings-drawer-backdrop')?.remove();
  stopPreview();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderSettingsDrawer();
  const backdrop = wrapper.firstElementChild as HTMLElement;
  document.body.appendChild(backdrop);

  // Close button
  document.getElementById('settings-drawer-close')?.addEventListener('click', closeSettings);

  // Backdrop click to close
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSettings();
  });

  // Dark mode toggle
  document.getElementById('settings-dark-mode')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    setDarkMode(checked);
  });

  // Auto-Save toggle
  document.getElementById('settings-autosave')?.addEventListener('change', (e) => {
    updateSettings({ autoSave: (e.target as HTMLInputElement).checked });
  });

  // Auto-Play toggle
  document.getElementById('settings-autoplay')?.addEventListener('change', (e) => {
    updateSettings({ autoPlay: (e.target as HTMLInputElement).checked });
  });

  // Reading Speed selector
  document.getElementById('settings-speed-group')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-speed]') as HTMLElement;
    if (!btn) return;
    const speed = btn.getAttribute('data-speed') as 'slow' | 'normal' | 'fast';
    updateSettings({ readingSpeed: speed });
    // Update UI
    const group = document.getElementById('settings-speed-group');
    if (group) {
      group.querySelectorAll('.settings-speed-btn').forEach(b => b.classList.remove('settings-speed-btn--active'));
    }
    btn.classList.add('settings-speed-btn--active');

    // If a voice preview is currently playing, restart it at the new speed
    if (_previewingVoiceId && _previewBtn) {
      const currentVoiceId = _previewingVoiceId;
      const currentBtn = _previewBtn;
      stopPreview();
      playPreview(currentVoiceId, currentBtn);
    }
  });

  // Text Size selector
  document.getElementById('settings-text-size-group')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-textsize]') as HTMLElement;
    if (!btn) return;
    const size = btn.getAttribute('data-textsize') as 'small' | 'medium' | 'large';
    setTextSize(size);
    // Update UI
    const group = document.getElementById('settings-text-size-group');
    if (group) {
      group.querySelectorAll('.settings-speed-btn').forEach(b => b.classList.remove('settings-speed-btn--active'));
    }
    btn.classList.add('settings-speed-btn--active');
  });

  // Voice selection (click card body, not preview button)
  document.getElementById('settings-voice-grid')?.addEventListener('click', (e) => {
    // Don't select voice if preview button was clicked
    if ((e.target as HTMLElement).closest('[data-preview-voice]')) return;

    const card = (e.target as HTMLElement).closest('[data-voice-id]') as HTMLElement;
    if (!card) return;
    const voiceId = card.getAttribute('data-voice-id')!;
    updateSettings({ selectedVoiceId: voiceId });

    // Update UI: remove active from all, add to clicked
    document.querySelectorAll('.settings-voice-card').forEach(c => {
      c.classList.remove('settings-voice-card--active');
      const check = c.querySelector('.settings-voice-card__check');
      if (check) check.remove();
    });
    card.classList.add('settings-voice-card--active');
    card.insertAdjacentHTML('beforeend', '<span class="settings-voice-card__check">✓</span>');
  });

  // Voice preview buttons
  document.querySelectorAll('[data-preview-voice]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const voiceId = (btn as HTMLElement).getAttribute('data-preview-voice')!;
      playPreview(voiceId, btn as HTMLElement);
    });
  });

  // Logout
  document.getElementById('settings-logout-btn')?.addEventListener('click', async () => {
    closeSettings();
    try {
      const { supabase } = await import('../lib/supabase.ts');
      const { clearCache } = await import('../lib/db.ts');
      await supabase.auth.signOut();
      clearCache();
      localStorage.removeItem('drive_subscription');
      localStorage.removeItem('drive_user_stories');
      localStorage.removeItem('drive_library_unlocked');
      localStorage.removeItem('drive_migrated');
      navigate('home');
      setTimeout(() => window.location.reload(), 100);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });

  // Add Another Account
  document.getElementById('settings-add-account-btn')?.addEventListener('click', async () => {
    closeSettings();
    try {
      const { supabase } = await import('../lib/supabase.ts');
      const { clearCache } = await import('../lib/db.ts');
      await supabase.auth.signOut();
      clearCache();
      navigate('signup');
    } catch (err) {
      console.error('Switch account failed:', err);
    }
  });

  // Escape key
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSettings();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Animate open
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
  });
}

function closeSettings(): void {
  stopPreview();
  const backdrop = document.getElementById('settings-drawer-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  setTimeout(() => backdrop.remove(), 350);
}

export function openSettings(): void {
  injectSettingsDrawer();
}
