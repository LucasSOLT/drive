// ─── App Settings (persisted to localStorage) ───

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  previewUrl?: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'sarah', name: 'Sarah', description: 'Confident & warm female', voiceId: 'EXAVITQu4vr4xnSDxMaL', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3' },
  { id: 'roger', name: 'Roger', description: 'Laid-back & casual male', voiceId: 'CwhRBWXzGAHq8TQ4Fs17', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3' },
  { id: 'river', name: 'River', description: 'Relaxed & neutral narrator', voiceId: 'SAz9YHcvj6GT2YYXdXww', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3' },
  { id: 'liam', name: 'Liam', description: 'Energetic & confident male', voiceId: 'TX3LPaxmHKxFdv7VOQHJ', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3' },
  { id: 'george', name: 'George', description: 'Warm British storyteller', voiceId: 'JBFqnCBsd6RMkjVDRZzb', previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3' },
];

export interface AppSettings {
  selectedVoiceId: string;   // ElevenLabs voice ID
  darkMode: boolean;
  autoSave: boolean;
  notifications: boolean;
  readingSpeed: 'slow' | 'normal' | 'fast';
  textSize: 'small' | 'medium' | 'large';
  language: string;
  autoPlay: boolean;
}

const SETTINGS_KEY = 'drive_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  selectedVoiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  darkMode: true,
  autoSave: true,
  notifications: true,
  readingSpeed: 'normal',
  textSize: 'medium',
  language: 'English',
  autoPlay: false,
};

let _settings: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (_settings) return _settings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const isDark = typeof parsed.darkMode === 'boolean' ? parsed.darkMode : true;
      _settings = { ...DEFAULT_SETTINGS, ...parsed, darkMode: isDark };
    } else {
      _settings = { ...DEFAULT_SETTINGS };
    }
  } catch {
    _settings = { ...DEFAULT_SETTINGS };
  }
  return _settings!;
}

export function updateSettings(partial: Partial<AppSettings>): void {
  const current = getSettings();
  Object.assign(current, partial);
  _settings = current;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

export function getSelectedVoiceId(): string {
  return getSettings().selectedVoiceId;
}

export function isDarkMode(): boolean {
  return getSettings().darkMode;
}

export function setDarkMode(enabled: boolean): void {
  updateSettings({ darkMode: enabled });
  applyTheme();
}

export function applyTheme(): void {
  const dark = isDarkMode();
  if (dark) {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Update theme-color meta tag for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', dark ? '#141424' : '#F5F0E8');
  }
}

export function setTextSize(size: 'small' | 'medium' | 'large'): void {
  updateSettings({ textSize: size });
  applyTextSize();
}

export function applyTextSize(): void {
  const size = getSettings().textSize;
  document.documentElement.classList.remove('text-size-small', 'text-size-medium', 'text-size-large');
  document.documentElement.classList.add(`text-size-${size}`);
}
