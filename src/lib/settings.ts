// ─── App Settings (persisted to localStorage) ───

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  previewUrl?: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  // ── Female Voices ──
  { id: 'sarah', name: 'Sarah', description: 'Confident & warm narrator', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
  { id: 'rachel', name: 'Rachel', description: 'Calm & composed female', voiceId: '21m00Tcm4TlvDq8ikWAM' },
  { id: 'domi', name: 'Domi', description: 'Strong & expressive female', voiceId: 'AZnzlk1XvdvUeBnXmlld' },
  { id: 'elli', name: 'Elli', description: 'Gentle & youthful female', voiceId: 'MF3mGyEYCl7XYWbV9V6O' },
  { id: 'charlotte', name: 'Charlotte', description: 'Elegant & articulate female', voiceId: 'XB0fDUnXU5powFXDhCwa' },
  { id: 'alice', name: 'Alice', description: 'Friendly & conversational female', voiceId: 'Xb7hH8MSUJpSbSDYk0k2' },
  { id: 'lily', name: 'Lily', description: 'Soft & soothing female', voiceId: 'pFZP5JQG7iQjIQuC4Bku' },
  { id: 'matilda', name: 'Matilda', description: 'Warm & motherly female', voiceId: 'XrExE9yKIg1WjnnlVkGX' },
  { id: 'grace', name: 'Grace', description: 'Poised & professional female', voiceId: 'oWAxZDx7w5VEj9dCyTzz' },
  // ── Male Voices ──
  { id: 'roger', name: 'Roger', description: 'Laid-back & casual male', voiceId: 'CwhRBWXzGAHq8TQ4Fs17' },
  { id: 'liam', name: 'Liam', description: 'Energetic & confident male', voiceId: 'TX3LPaxmHKxFdv7VOQHJ' },
  { id: 'george', name: 'George', description: 'Warm British storyteller', voiceId: 'JBFqnCBsd6RMkjVDRZzb' },
  { id: 'adam', name: 'Adam', description: 'Deep & authoritative male', voiceId: 'pNInz6obpgDQGcFmaJgB' },
  { id: 'antoni', name: 'Antoni', description: 'Smooth & friendly male', voiceId: 'ErXwobaYiN019PkySvjV' },
  { id: 'josh', name: 'Josh', description: 'Youthful & upbeat male', voiceId: 'TxGEqnHWrfWFTfGW9XjX' },
  { id: 'sam', name: 'Sam', description: 'Raspy & rugged male', voiceId: 'yoZ06aMxZJJ28mfd3POQ' },
  { id: 'arnold', name: 'Arnold', description: 'Gravelly & dramatic male', voiceId: 'VR6AewLTigWG4xSOukaG' },
  { id: 'daniel', name: 'Daniel', description: 'Clear British narrator', voiceId: 'onwK4e9ZLuTAKqWW03F9' },
  { id: 'james', name: 'James', description: 'Deep & refined male', voiceId: 'ZQe5CZNOzWyzPSCn5a3c' },
  { id: 'callum', name: 'Callum', description: 'Versatile transatlantic male', voiceId: 'N2lVS1w4EtoT3dr4eOWO' },
  // ── Character & Unique Voices ──
  { id: 'clyde', name: 'Clyde', description: 'Gruff war veteran', voiceId: '2EiwWnXFnvU5JabPnv8n' },
  { id: 'glinda', name: 'Glinda', description: 'Whimsical witch', voiceId: 'z9fAnlkpzviPz146aGWa' },
  { id: 'charlie', name: 'Charlie', description: 'Casual Australian male', voiceId: 'IKne3meq5aSn9XLyUdCD' },
  // ── Youth Voices ──
  { id: 'fin', name: 'Fin', description: 'Young adventurous male', voiceId: 'D38z5RcWu1voky8WS1ja' },
  { id: 'freya', name: 'Freya', description: 'Young spirited female', voiceId: 'jsCqWAovK2LkecY7zXl4' },
  // ── Neutral / Narrator ──
  { id: 'river', name: 'River', description: 'Relaxed & neutral narrator', voiceId: 'SAz9YHcvj6GT2YYXdXww' },
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
