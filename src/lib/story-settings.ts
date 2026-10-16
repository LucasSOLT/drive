/**
 * Story-level settings shared by every episode of a story (title, synopsis, genre, theme color,
 * cover video, cast). Pure helpers behind the Admin Dashboard "Edit Story Settings" modal.
 */
import type { Story, StoryCharacter } from '../types.ts';
import {
  NARRATOR_ID,
  PLAIN_TEXT_ID,
  PLAIN_TEXT_NAME,
  packCast,
  readReservedVoices,
  realCharacters,
} from './cast-voices.ts';

export interface VoiceSlot {
  voiceId: string;
  color: string;
  muted: boolean;
}

export interface GroupSettings {
  title: string;
  synopsis: string;
  genre: string;
  themeColor: string;
  coverVideo: string;
  narrator: VoiceSlot;
  plainText: VoiceSlot;
  /** Real characters only (the permanent Narrator / Story Text live in the two slots above). */
  characters: StoryCharacter[];
  /** When true, manual episode numbering is enabled for the story. */
  manualNumbering?: boolean;
}

export const DEFAULT_THEME_COLOR = '#141424';

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Episodes of one story, lowest episode number first (stable for ties). */
function byEpisode(episodes: Story[]): Story[] {
  return episodes
    .map((ep, i) => ({ ep, i }))
    .sort((a, b) => ((a.ep.episodeNumber || 1) - (b.ep.episodeNumber || 1)) || (a.i - b.i))
    .map(x => x.ep);
}

/**
 * Current shared settings of a story, read from its episodes. Episode 1 wins; characters that only
 * exist on a later episode are kept so nothing is lost when the cast is saved back to all episodes.
 */
export function readGroupSettings(episodes: Story[]): GroupSettings | null {
  const sorted = byEpisode(episodes);
  const base = sorted[0];
  if (!base) return null;

  // Narrator / Story Text entries come from the first episode that actually has them.
  const withCast = sorted.find(e => (e.characters || []).some(c => c?.id === NARRATOR_ID)) || base;
  const hasPlain = (withCast.characters || []).some(c => c?.id === PLAIN_TEXT_ID);
  const v = readReservedVoices(withCast.characters, {
    narratorVoiceId: withCast.narratorVoiceId,
    narratorHighlightColor: withCast.narratorHighlightColor,
  });
  // The narrator_voice_id column is the source of truth for the narrator voice (same rule as the editor).
  const narratorVoiceId = withCast.narratorVoiceId || v.narratorVoiceId;

  const seen = new Set<string>();
  const characters: StoryCharacter[] = [];
  for (const ep of sorted) {
    for (const c of realCharacters(ep.characters)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      characters.push({ ...c, name: c.name || '' });
    }
  }

  const manualNumbering = Boolean(
    base.manualNumbering ||
    v.manualNumbering ||
    sorted.some(e => e.manualNumbering || readReservedVoices(e.characters).manualNumbering)
  );

  return {
    title: base.title || '',
    synopsis: base.synopsis || '',
    genre: base.genre || 'Fantasy',
    themeColor: base.themeColor || DEFAULT_THEME_COLOR,
    coverVideo: base.coverVideo || '',
    narrator: { voiceId: narratorVoiceId, color: v.narratorColor, muted: !!v.narratorMuted },
    plainText: {
      voiceId: hasPlain ? v.plainTextVoiceId : narratorVoiceId,
      color: v.plainTextColor,
      muted: !!v.plainTextMuted,
    },
    characters,
    manualNumbering,
  };
}

/** Names the screenplay parser already treats specially (it matches speakers by name). */
function isReservedName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === 'narrator' || n === PLAIN_TEXT_NAME.toLowerCase();
}

/** Returns a human-readable problem, or null when the settings can be saved. */
export function validateSettings(input: GroupSettings): string | null {
  if (!input.title.trim()) return 'Give the story a title.';
  if (!isHexColor(input.themeColor)) return 'Theme color must look like #141424.';
  const names = new Set<string>();
  for (const c of input.characters) {
    const name = (c.name || '').trim();
    if (!name) return 'Every character needs a name.';
    if (isReservedName(name)) return `"${name}" is already a permanent voice. Pick another name.`;
    const key = name.toLowerCase();
    if (names.has(key)) return `Two characters are named "${name}". Names must be unique.`;
    names.add(key);
    if (!c.voiceId) return `Pick a voice for ${name}.`;
  }
  if (!input.narrator.voiceId) return 'Pick a voice for the Narrator.';
  if (!input.plainText.voiceId) return 'Pick a voice for Story Text.';
  return null;
}

/** Fields written to every episode of the story. `muted` is only stored when true. */
export function buildGroupPatch(input: GroupSettings): Partial<Story> {
  const manualNumbering = Boolean(input.manualNumbering);
  const characters = packCast(
    input.characters.map(c => {
      const { muted, ...rest } = c;
      return { ...rest, name: c.name.trim(), ...(muted ? { muted: true } : {}) };
    }),
    {
      narratorVoiceId: input.narrator.voiceId,
      narratorColor: input.narrator.color,
      plainTextVoiceId: input.plainText.voiceId,
      plainTextColor: input.plainText.color,
      narratorMuted: input.narrator.muted,
      plainTextMuted: input.plainText.muted,
      ...(manualNumbering ? { manualNumbering: true } : {}),
    }
  );
  return {
    title: input.title.trim(),
    synopsis: input.synopsis,
    genre: input.genre as Story['genre'],
    themeColor: input.themeColor,
    characters,
    narratorVoiceId: input.narrator.voiceId,
    narratorHighlightColor: input.narrator.color,
    ...(input.manualNumbering !== undefined ? { manualNumbering } : {}),
  };
}
