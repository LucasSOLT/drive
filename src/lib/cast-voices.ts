/**
 * Cast voices: the two permanent "voices" every story has, plus helpers.
 *
 *  - Narrator   (characterId 'narrator')   — lines written as `NARRATOR: "..."`.
 *  - Story Text (characterId 'plain_text') — untagged text that is not a character
 *    and not the narrator, but is still read out loud.
 *
 * Both are stored inside the story's existing `characters` JSON list as reserved
 * entries, so they save and sync across episodes without any database change.
 * Everything that shows a cast list must use `realCharacters()` to hide them.
 */
import type { StoryCharacter } from '../types.ts';

export const NARRATOR_ID = 'narrator';
export const PLAIN_TEXT_ID = 'plain_text';
export const PLAIN_TEXT_NAME = 'Story Text';

export const DEFAULT_NARRATOR_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
export const DEFAULT_NARRATOR_COLOR = '#7C6FFA';

export interface ReservedVoices {
  narratorVoiceId: string;
  narratorColor: string;
  plainTextVoiceId: string;
  plainTextColor: string;
}

export function isReservedCastId(id: string | undefined | null): boolean {
  return id === NARRATOR_ID || id === PLAIN_TEXT_ID;
}

/** Characters the creator actually added (reserved entries removed). */
export function realCharacters(list: StoryCharacter[] | undefined | null): StoryCharacter[] {
  return (list || []).filter(c => c && !isReservedCastId(c.id));
}

/** True for narrator lines and plain story text (both render as narration, no speaker badge). */
export function isNarrationLine(line: { characterId?: string; characterName?: string } | null | undefined): boolean {
  if (!line) return true;
  const id = line.characterId;
  if (!id || id === NARRATOR_ID || id === PLAIN_TEXT_ID) return true;
  const name = (line.characterName || '').toLowerCase();
  return name === 'narrator' || name.includes('narrator');
}

/** Read the reserved voices out of a saved `characters` list (falls back to story-level fields). */
export function readReservedVoices(
  list: StoryCharacter[] | undefined | null,
  fallback: { narratorVoiceId?: string; narratorHighlightColor?: string } = {}
): ReservedVoices {
  const narrator = (list || []).find(c => c?.id === NARRATOR_ID);
  const plain = (list || []).find(c => c?.id === PLAIN_TEXT_ID);
  const narratorVoiceId = narrator?.voiceId || fallback.narratorVoiceId || DEFAULT_NARRATOR_VOICE_ID;
  const narratorColor = narrator?.color || fallback.narratorHighlightColor || DEFAULT_NARRATOR_COLOR;
  return {
    narratorVoiceId,
    narratorColor,
    // Story Text defaults to the narrator's voice/color so older stories sound the same.
    plainTextVoiceId: plain?.voiceId || narratorVoiceId,
    plainTextColor: plain?.color || narratorColor,
  };
}

/** Build the list to save: real characters + the two reserved entries. */
export function packCast(chars: StoryCharacter[], v: ReservedVoices): StoryCharacter[] {
  return [
    ...realCharacters(chars),
    { id: NARRATOR_ID, name: 'Narrator', voiceId: v.narratorVoiceId, color: v.narratorColor },
    { id: PLAIN_TEXT_ID, name: PLAIN_TEXT_NAME, voiceId: v.plainTextVoiceId, color: v.plainTextColor },
  ];
}

/** Highlight color for a narration line in the reader. */
export function narrationColorFor(
  line: { characterId?: string } | null | undefined,
  story: { characters?: StoryCharacter[]; narratorHighlightColor?: string }
): string {
  const v = readReservedVoices(story.characters, { narratorHighlightColor: story.narratorHighlightColor });
  return line?.characterId === PLAIN_TEXT_ID ? v.plainTextColor : v.narratorColor;
}
