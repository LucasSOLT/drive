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
import { KaraokeController, LINE_GAP_SECONDS, type WordTimestamp } from './karaoke.ts';

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
  /** Silent Narrator / Story Text. Only present (true) when muted. */
  narratorMuted?: boolean;
  plainTextMuted?: boolean;
  /** Manual episode numbering enabled for the story. Only present (true) when enabled. */
  manualNumbering?: boolean;
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
  const plainMuted = plain ? Boolean(plain.muted) : Boolean(narrator?.muted);
  return {
    narratorVoiceId,
    narratorColor,
    // Story Text defaults to the narrator's voice/color so older stories sound the same.
    plainTextVoiceId: plain?.voiceId || narratorVoiceId,
    plainTextColor: plain?.color || narratorColor,
    // Mute flags are only added when true, so un-muted stories keep their exact old shape.
    ...(narrator?.muted ? { narratorMuted: true } : {}),
    ...(plainMuted ? { plainTextMuted: true } : {}),
    ...(narrator?.manualNumbering ? { manualNumbering: true } : {}),
  };
}

/** Build the list to save: real characters + the two reserved entries. */
export function packCast(chars: StoryCharacter[], v: ReservedVoices): StoryCharacter[] {
  return [
    ...realCharacters(chars),
    {
      id: NARRATOR_ID,
      name: 'Narrator',
      voiceId: v.narratorVoiceId,
      color: v.narratorColor,
      ...(v.narratorMuted ? { muted: true } : {}),
      ...(v.manualNumbering ? { manualNumbering: true } : {}),
    },
    { id: PLAIN_TEXT_ID, name: PLAIN_TEXT_NAME, voiceId: v.plainTextVoiceId, color: v.plainTextColor, ...(v.plainTextMuted ? { muted: true } : {}) },
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

/**
 * True when a dialogue line's speaker (Narrator, Story Text, or a custom character)
 * has been muted in Story Settings.
 */
export function isLineMuted(
  line: { characterId?: string; characterName?: string } | null | undefined,
  characters: StoryCharacter[] | undefined | null
): boolean {
  const v = readReservedVoices(characters);
  if (!line) return Boolean(v.narratorMuted);
  const id = line.characterId;
  const nameLower = (line.characterName || '').trim().toLowerCase();
  if (id === PLAIN_TEXT_ID || nameLower === PLAIN_TEXT_NAME.toLowerCase() || nameLower.includes('story text')) {
    return Boolean(v.plainTextMuted);
  }
  if (isNarrationLine(line)) {
    return Boolean(v.narratorMuted);
  }
  const matched = (characters || []).find(
    c =>
      c &&
      !isReservedCastId(c.id) &&
      ((id && c.id === id) || (nameLower && (c.name || '').trim().toLowerCase() === nameLower))
  );
  return Boolean(matched?.muted);
}

/** Filter dialogue lines to those with non-empty text whose speaker is NOT muted. */
export function getAudibleDialogueLines<
  T extends { characterId?: string; characterName?: string; text?: string }
>(lines: T[] | undefined | null, characters: StoryCharacter[] | undefined | null): T[] {
  return (lines || []).filter(l => l && Boolean((l.text || '').trim()) && !isLineMuted(l, characters));
}

/**
 * True when a page has text/dialogue and EVERY non-empty line on the page is muted
 * (or, for pages with only raw `fallbackScriptText` and no `dialogueLines`, when
 * Story Text is muted — falling back to Narrator on legacy casts without `plain_text`).
 */
export function areAllLinesMuted(
  lines: Array<{ characterId?: string; characterName?: string; text?: string }> | undefined | null,
  characters: StoryCharacter[] | undefined | null,
  fallbackScriptText?: string
): boolean {
  const nonEmpty = (lines || []).filter(l => l && Boolean((l.text || '').trim()));
  if (nonEmpty.length > 0) {
    return nonEmpty.every(l => isLineMuted(l, characters));
  }
  if (fallbackScriptText && fallbackScriptText.trim().length > 0) {
    const v = readReservedVoices(characters);
    return Boolean(v.plainTextMuted);
  }
  return false;
}

export interface AudibleWordMapResult {
  wordMap: WordTimestamp[];
  estimatedMap: boolean;
  silentRanges: Array<{ start: number; end: number }>;
  audibleWordCount: number;
}

export interface SilentRangeAction {
  type: 'seek' | 'finish';
  seekTo?: number;
}

/**
 * Given the current playback position `currentTime` and the `silentRanges` / `wordMap`
 * returned by `buildAudiblePageWordMap`, determine whether playback is inside a muted
 * line's baked-in audio range and whether to seek to the next audible segment or finish
 * page playback (when all remaining lines on the page are muted).
 */
export function getSilentRangeAction(
  currentTime: number,
  silentRanges: Array<{ start: number; end: number }>,
  wordMap: WordTimestamp[],
  audioDuration: number = 0
): SilentRangeAction | null {
  if (!silentRanges || silentRanges.length === 0) return null;
  for (const r of silentRanges) {
    if (currentTime >= r.start - 0.01 && currentTime < r.end - 0.02) {
      const hasAudibleAfter = wordMap.some(w => w.startTime >= r.end - 0.02);
      if (!hasAudibleAfter || (audioDuration > 0 && r.end >= audioDuration - 0.05)) {
        return { type: 'finish' };
      }
      return { type: 'seek', seekTo: r.end };
    }
  }
  return null;
}

/**
 * Build a karaoke word map for a page that respects muted lines:
 * - Muted lines produce no WordTimestamp entries (so their words never highlight).
 * - DOM word indices (`data-word-idx`) on unmuted lines stay aligned with the rendered spans.
 * - If a muted line was skipped during pre-recording (no duration/alignment), it adds no time offset or gap.
 * - If a character was muted *after* a combined page audio file was already recorded (the muted line still
 *   has `duration` or `alignment`), its baked-in time window is returned in `silentRanges` so playback can
 *   skip over that range while keeping subsequent lines' timestamps aligned with the audio file.
 */
export function buildAudiblePageWordMap(
  dialogueLines: Array<{
    text: string;
    characterId?: string;
    characterName?: string;
    alignment?: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    } | null;
    duration?: number;
  }>,
  scriptText: string,
  characters: StoryCharacter[] | undefined | null,
  gapSeconds: number = LINE_GAP_SECONDS
): AudibleWordMapResult {
  if (dialogueLines.length === 0) {
    if (!scriptText || !scriptText.trim() || areAllLinesMuted([], characters, scriptText)) {
      return { wordMap: [], estimatedMap: false, silentRanges: [], audibleWordCount: 0 };
    }
    const words = String(scriptText).split(/\s+/).filter(Boolean);
    const est = KaraokeController.estimateWordTimes(words, 0, words.length * 0.35);
    const wordMap = est.map((w, i) => ({ wordIdx: i, lineIdx: 0, startTime: w.startTime, endTime: w.endTime }));
    return { wordMap, estimatedMap: true, silentRanges: [], audibleWordCount: words.length };
  }

  const mutedFlags = dialogueLines.map(l => isLineMuted(l, characters));
  const wordCounts = dialogueLines.map(l => String(l.text || '').split(/\s+/).filter(Boolean).length);
  const audibleWordCount = wordCounts.reduce((sum, count, idx) => sum + (mutedFlags[idx] ? 0 : count), 0);

  if (audibleWordCount === 0) {
    return { wordMap: [], estimatedMap: false, silentRanges: [], audibleWordCount: 0 };
  }

  const extraWordShift: number[] = new Array(dialogueLines.length).fill(0);
  let cumulativeSkippedWords = 0;

  const linesForKaraoke = dialogueLines.map((line, idx) => {
    extraWordShift[idx] = cumulativeSkippedWords;
    const isMuted = mutedFlags[idx];
    const hasBakedSegment =
      (typeof line.duration === 'number' && line.duration > 0) ||
      Boolean(line.alignment && Array.isArray(line.alignment.characters) && line.alignment.characters.length > 0);

    if (isMuted && !hasBakedSegment) {
      cumulativeSkippedWords += wordCounts[idx];
      return { text: '', alignment: null, duration: 0 };
    }
    return line;
  });

  const rawMap = KaraokeController.buildMultiLineWordMap(linesForKaraoke, gapSeconds);

  // Collect silent time windows for muted lines that still have baked-in segments in combined audio
  const silentRanges: Array<{ start: number; end: number }> = [];
  for (let idx = 0; idx < dialogueLines.length; idx++) {
    if (!mutedFlags[idx]) continue;
    const lineWords = rawMap.filter(w => w.lineIdx === idx);
    if (lineWords.length > 0) {
      const prevWords = rawMap.filter(w => w.lineIdx < idx);
      const nextWords = rawMap.filter(w => w.lineIdx > idx);
      const start =
        prevWords.length === 0
          ? 0
          : Math.min(lineWords[0].startTime, prevWords[prevWords.length - 1].endTime + 0.03);
      const lineDur = dialogueLines[idx].duration || 0;
      const rawEnd = Math.max(lineWords[lineWords.length - 1].endTime, lineWords[0].startTime + lineDur);
      const end = nextWords.length > 0 ? nextWords[0].startTime : rawEnd + gapSeconds;
      if (end > start) {
        if (silentRanges.length > 0 && Math.abs(silentRanges[silentRanges.length - 1].end - start) < 0.05) {
          silentRanges[silentRanges.length - 1].end = end;
        } else {
          silentRanges.push({ start, end });
        }
      }
    }
  }

  let wordMap: WordTimestamp[] = rawMap
    .filter(w => !mutedFlags[w.lineIdx])
    .map(w => ({
      ...w,
      wordIdx: w.wordIdx + (extraWordShift[w.lineIdx] || 0),
    }));

  let estimatedMap = false;
  if (wordMap.length < audibleWordCount) {
    const audibleWordTokens: Array<{ text: string; wordIdx: number; lineIdx: number }> = [];
    let domWordIdx = 0;
    dialogueLines.forEach((line, lineIdx) => {
      const tokens = String(line.text || '').split(/\s+/).filter(Boolean);
      const isMuted = mutedFlags[lineIdx];
      for (const token of tokens) {
        if (!isMuted) {
          audibleWordTokens.push({ text: token, wordIdx: domWordIdx, lineIdx });
        }
        domWordIdx++;
      }
    });
    const est = KaraokeController.estimateWordTimes(
      audibleWordTokens.map(t => t.text),
      0,
      audibleWordTokens.length * 0.35
    );
    wordMap = est.map((w, i) => ({
      wordIdx: audibleWordTokens[i].wordIdx,
      lineIdx: audibleWordTokens[i].lineIdx,
      startTime: w.startTime,
      endTime: w.endTime,
    }));
    estimatedMap = true;
  }

  return { wordMap, estimatedMap, silentRanges, audibleWordCount };
}

