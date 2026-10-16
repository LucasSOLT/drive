import type { DialogueLine, StoryCharacter } from "../types.ts";
import { PLAIN_TEXT_ID, PLAIN_TEXT_NAME } from "./cast-voices.ts";

export const DEFAULT_PLAIN_TEXT_ID = PLAIN_TEXT_ID;
export const DEFAULT_PLAIN_TEXT_NAME = PLAIN_TEXT_NAME;
export const DEFAULT_NARRATOR_COLOR = "#6EE7B7";
export const DEFAULT_PLAIN_TEXT_COLOR = "#c4b5fd";

export const SCREENPLAY_PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#22c55e",
  "#f97316",
  "#06b6d4",
  "#eab308",
  "#10B981",
];

export interface ScreenplayParseOptions {
  plainTextId?: string;
  plainTextName?: string;
}

export interface ScreenplayColorOptions extends ScreenplayParseOptions {
  storyCharacters?: StoryCharacter[];
  narratorColor?: string;
  plainTextColor?: string;
}

export interface ResolvedSpeakerInfo {
  characterId: string;
  characterName: string;
  isUnknown: boolean;
  isNarrator: boolean;
  isPlain: boolean;
}

interface SpeakerTagMatch {
  fullMatch: string;
  speakerRaw: string;
  length: number;
}

/**
 * Strips straight and curly double quotation marks so TTS never reads quote characters aloud.
 */
export function stripDialogueQuotes(text: string): string {
  if (!text) return "";
  return text.replace(/["\u201C\u201D\u201E\u201F]/g, "");
}

/**
 * Normalizes curly single and double quotation marks to straight ASCII equivalents.
 */
export function normalizeCurlyQuotes(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanSpeakerToken(raw: string): string {
  return (raw || "")
    .replace(/^(?:📖|🎙️|👤|🔇)\s*/u, "")
    .trim();
}

/**
 * Resolves a raw speaker cue (e.g. "SARAH", "Narrator", "Story Text", or null)
 * against the story's cast list.
 */
export function resolveSpeakerInfo(
  speakerRaw: string | null | undefined,
  storyCharacters: StoryCharacter[] = [],
  options?: ScreenplayParseOptions,
): ResolvedSpeakerInfo {
  const plainTextId = options?.plainTextId || DEFAULT_PLAIN_TEXT_ID;
  const plainTextName = options?.plainTextName || DEFAULT_PLAIN_TEXT_NAME;

  if (!speakerRaw || !speakerRaw.trim()) {
    return {
      characterId: plainTextId,
      characterName: "📖 " + plainTextName,
      isUnknown: false,
      isNarrator: false,
      isPlain: true,
    };
  }

  const clean = cleanSpeakerToken(speakerRaw);
  if (!clean) {
    return {
      characterId: plainTextId,
      characterName: "📖 " + plainTextName,
      isUnknown: false,
      isNarrator: false,
      isPlain: true,
    };
  }

  const lower = clean.toLowerCase();
  if (
    /^(?:plain|plain_text|story\s*text)$/i.test(clean) ||
    lower === plainTextName.toLowerCase() ||
    lower === plainTextId.toLowerCase()
  ) {
    return {
      characterId: plainTextId,
      characterName: "📖 " + plainTextName,
      isUnknown: false,
      isNarrator: false,
      isPlain: true,
    };
  }

  if (/^narrator$/i.test(clean)) {
    return {
      characterId: "narrator",
      characterName: "🎙️ Narrator",
      isUnknown: false,
      isNarrator: true,
      isPlain: false,
    };
  }

  const matchedChar = storyCharacters.find(
    (c) =>
      c.name.trim().toLowerCase() === lower ||
      c.id.trim().toLowerCase() === lower,
  );
  if (matchedChar) {
    return {
      characterId: matchedChar.id,
      characterName: matchedChar.name,
      isUnknown: false,
      isNarrator: false,
      isPlain: false,
    };
  }

  return {
    characterId: "unknown",
    characterName: clean,
    isUnknown: true,
    isNarrator: false,
    isPlain: false,
  };
}

/**
 * Resolves the highlight color for a speaker name or character ID.
 * Known characters use their assigned color; Narrator and Story Text use their setting colors;
 * unknown characters receive a deterministic fallback color from SCREENPLAY_PALETTE.
 */
export function resolveSpeakerColor(
  speakerOrCharId: string | null | undefined,
  options?: ScreenplayColorOptions,
): string {
  const storyCharacters = options?.storyCharacters || [];
  const narratorColor = options?.narratorColor || DEFAULT_NARRATOR_COLOR;
  const plainTextColor =
    options?.plainTextColor || narratorColor || DEFAULT_PLAIN_TEXT_COLOR;

  const info = resolveSpeakerInfo(speakerOrCharId, storyCharacters, options);
  if (info.isPlain) return plainTextColor;
  if (info.isNarrator) return narratorColor;

  if (!info.isUnknown) {
    const idx = storyCharacters.findIndex((c) => c.id === info.characterId);
    const ch = idx >= 0 ? storyCharacters[idx] : undefined;
    if (ch?.color && ch.color.trim()) return ch.color.trim();
    const paletteIdx = idx >= 0 ? idx % SCREENPLAY_PALETTE.length : 0;
    return SCREENPLAY_PALETTE[paletteIdx] || "#60a5fa";
  }

  // Deterministic system-assigned color for unknown characters
  const key = info.characterName.toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return SCREENPLAY_PALETTE[hash % SCREENPLAY_PALETTE.length] || "#60a5fa";
}

function isKnownSpeakerName(
  candidate: string,
  storyCharacters: StoryCharacter[],
  options?: ScreenplayParseOptions,
): boolean {
  const clean = cleanSpeakerToken(candidate);
  if (!clean) return false;
  const lower = clean.toLowerCase();
  const plainTextId = (options?.plainTextId || DEFAULT_PLAIN_TEXT_ID).toLowerCase();
  const plainTextName = (
    options?.plainTextName || DEFAULT_PLAIN_TEXT_NAME
  ).toLowerCase();

  if (
    /^(?:narrator|plain|plain_text|story\s*text)$/i.test(clean) ||
    lower === plainTextId ||
    lower === plainTextName
  ) {
    return true;
  }

  return storyCharacters.some(
    (c) =>
      c.name.trim().toLowerCase() === lower ||
      c.id.trim().toLowerCase() === lower,
  );
}

function isAllCapsCue(candidate: string, followedByQuote: boolean): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  // Must contain at least one uppercase letter (ASCII or Unicode) and no lowercase letters
  if (!/\p{Lu}/u.test(trimmed) || /\p{Ll}/u.test(trimmed)) return false;
  // Single-letter uppercase cues (e.g. "A:") require an opening quote; 2+ alphanumeric chars (e.g. "BOB:", "2D:", "ZOË:") qualify
  const alphaNumCount = (trimmed.match(/[\p{Lu}\p{N}]/gu) || []).length;
  return alphaNumCount >= 2 || followedByQuote;
}

function isTitleCaseCue(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/[ \t]+/);
  if (words.length > 3) return false;
  return words.every((w) => /^\p{Lu}[\p{Ll}\p{N}_.'-]*$/u.test(w));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Attempts to match a valid speaker cue (e.g. `SARAH:`, `[Narrator]:`, `GUARD 1 (shouting):`)
 * at `pos` in `text`. Rejects timestamps (`10:30`), URL schemes (`https://`), and lowercase prose colons (`she said:`).
 */
function matchSpeakerTagAt(
  text: string,
  pos: number,
  storyCharacters: StoryCharacter[],
  options: ScreenplayParseOptions | undefined,
  atLineStart: boolean,
  afterClosingQuote: boolean,
): SpeakerTagMatch | null {
  if (pos < 0 || pos >= text.length) return null;

  // Must be at start of string or preceded by whitespace or closing quote
  if (pos > 0 && !/[\s"\u201C\u201D\u201E\u201F]/.test(text[pos - 1])) {
    return null;
  }

  const slice = text.slice(pos);

  // 1. Bracketed speaker tag: [Name]: or [Name] (note):
  const bracketMatch = slice.match(
    /^\[([^\][\r\n]+)\][ \t]*(?:\([^)\r\n]*\))?[ \t]*:/,
  );
  if (bracketMatch) {
    const fullMatch = bracketMatch[0];
    const afterColon = slice.slice(fullMatch.length);
    if (afterColon.startsWith("//")) return null;
    const speakerRaw = bracketMatch[1].trim();
    if (speakerRaw) {
      return {
        fullMatch,
        speakerRaw,
        length: fullMatch.length,
      };
    }
  }

  // 2. Direct check for known characters in storyCharacters (longest name first so multi-word or special-char names always match)
  if (storyCharacters.length > 0) {
    const sortedChars = [...storyCharacters]
      .filter((c) => c && c.name && c.name.trim())
      .sort((a, b) => b.name.trim().length - a.name.trim().length);
    for (const ch of sortedChars) {
      const cleanName = ch.name.trim();
      const charRegex = new RegExp(
        `^(${escapeRegex(cleanName)})([ \\t]*(?:\\([^)\\r\\n]*\\))?[ \\t]*:)`,
        "i",
      );
      const m = slice.match(charRegex);
      if (m) {
        const fullMatch = m[0];
        const candidate = m[1].trim();
        const afterColon = slice.slice(fullMatch.length);
        if (afterColon.startsWith("//") || /^\d/.test(afterColon)) continue;
        const followedByQuote = /^[ \t]*["\u201C\u201D\u201E\u201F]/.test(
          afterColon,
        );
        if (
          atLineStart ||
          afterClosingQuote ||
          followedByQuote ||
          isAllCapsCue(candidate, true)
        ) {
          return {
            fullMatch,
            speakerRaw: candidate,
            length: fullMatch.length,
          };
        }
      }
    }
  }

  // 3. Unbracketed speaker tag: Candidate (optional note):
  const wordPattern =
    "(?:(?:Mr|Mrs|Ms|Dr|St|Prof|Capt|Gen|Lt|Sgt|Jr|Sr|\\p{Lu})\\.|(?:[0-9]+\\p{L}|\\p{L})[\\p{L}\\p{N}_'-]*)";
  const tokenPattern = `${wordPattern}(?:[ \\t]+(?:${wordPattern}|[0-9]+)){0,4}`;
  const colonRegex = new RegExp(
    `^(${tokenPattern})([ \\t]*(?:\\([^)\\r\\n]*\\))?[ \\t]*:)`,
    "u",
  );
  const colonMatch = slice.match(colonRegex);
  if (!colonMatch) return null;

  const fullMatch = colonMatch[0];
  const candidate = colonMatch[1].trim();
  const afterColon = slice.slice(fullMatch.length);

  // Reject URL schemes like https:// or http://
  if (afterColon.startsWith("//")) return null;
  // Reject when colon is immediately followed by a digit with no space (e.g. ratio/time)
  if (/^\d/.test(afterColon)) return null;

  const followedByQuote = /^[ \t]*["\u201C\u201D\u201E\u201F]/.test(afterColon);

  // Check if candidate is a known speaker (Narrator, Story Text, or in storyCharacters)
  if (
    isKnownSpeakerName(candidate, storyCharacters, options) &&
    (atLineStart ||
      afterClosingQuote ||
      followedByQuote ||
      isAllCapsCue(candidate, true))
  ) {
    return {
      fullMatch,
      speakerRaw: candidate,
      length: fullMatch.length,
    };
  }

  // Check if candidate is an ALL-CAPS cue (e.g. SARAH, LUCAS, BOB, GUARD 1, 2D, ZOË)
  if (isAllCapsCue(candidate, followedByQuote)) {
    return {
      fullMatch,
      speakerRaw: candidate,
      length: fullMatch.length,
    };
  }

  // Check if candidate is a Title Case cue (e.g. `Sarah: "Hi!"`) at line start or after a closing quote, followed by a quote
  if (
    (atLineStart || afterClosingQuote) &&
    followedByQuote &&
    isTitleCaseCue(candidate)
  ) {
    return {
      fullMatch,
      speakerRaw: candidate,
      length: fullMatch.length,
    };
  }

  return null;
}

function isQuoteChar(ch: string): boolean {
  return (
    ch === '"' ||
    ch === "\u201C" ||
    ch === "\u201D" ||
    ch === "\u201E" ||
    ch === "\u201F"
  );
}

/**
 * Determines whether a quote character at `idx` inside an already-open outer quotation
 * is opening a nested inner quote (e.g. `NARRATOR: "There isn't much a 2D "thing" can do."`)
 * rather than closing the current dialogue quotation level.
 */
function isInnerQuoteOpener(
  text: string,
  idx: number,
  lastOpenQuoteIdx: number,
  storyCharacters: StoryCharacter[],
  options?: ScreenplayParseOptions,
): boolean {
  const ch = text[idx];
  const prevChar = idx > 0 ? text[idx - 1] : "";
  const nextChar = idx + 1 < text.length ? text[idx + 1] : "";

  // An inner opening quote cannot be at EOF, nor followed by whitespace, closing punctuation, or a closing quote
  if (!nextChar || /[\s.,!?;:)\]}—–\u201D]/.test(nextChar)) {
    return false;
  }

  // If followed by another quote char, it is only an opener if preceded by an opener context AND the next quote is followed by word text
  if (isQuoteChar(nextChar)) {
    const afterNext = idx + 2 < text.length ? text[idx + 2] : "";
    if (!afterNext || /[\s.,!?;:)\]}—–"\u201C\u201D\u201E\u201F]/.test(afterNext)) {
      return false;
    }
  }

  // If what follows immediately is a speaker tag (e.g. `"LUCAS: "Hey!"`), then `idx` is a closing quote, not an inner quote
  const tagAfter = matchSpeakerTagAt(
    text,
    idx + 1,
    storyCharacters,
    options,
    prevChar === "\n",
    true,
  );
  if (tagAfter) {
    return false;
  }

  // Left/low curly quote `\u201C`, `\u201E`, `\u201F` followed by word text is always an inner quote opener
  if (ch === "\u201C" || ch === "\u201E" || ch === "\u201F") {
    return true;
  }

  // Right curly quote `\u201D` is a closing quote
  if (ch === "\u201D") {
    return false;
  }

  // Straight quote `"`: opener if immediately adjacent to the previous opening quote (`""Hello`)
  // or preceded by whitespace / opening punctuation (`(`, `[`, `—`, `–`, `-`)
  const prevIsOpenerContext =
    idx === lastOpenQuoteIdx + 1 || /[ \t\r\n(\[—–-]/.test(prevChar);
  return prevIsOpenerContext;
}

/**
 * Given the index of an opening outer quotation mark at `openIdx`, scans forward
 * to find the index of the matching closing outer quotation mark (accounting for nested inner quotes).
 * Returns -1 if the outer quotation remains unclosed at the end of `text`.
 */
export function findClosingQuoteIndex(
  text: string,
  openIdx: number,
  storyCharacters: StoryCharacter[] = [],
  options?: ScreenplayParseOptions,
): number {
  let innerQuoteDepth = 0;
  let lastOpenQuoteIdx = openIdx;

  for (let i = openIdx + 1; i < text.length; i++) {
    const ch = text[i];
    if (!isQuoteChar(ch)) continue;

    if (
      isInnerQuoteOpener(
        text,
        i,
        lastOpenQuoteIdx,
        storyCharacters,
        options,
      )
    ) {
      innerQuoteDepth++;
      lastOpenQuoteIdx = i;
      continue;
    }

    if (innerQuoteDepth > 0) {
      innerQuoteDepth--;
      continue;
    }

    return i;
  }
  return -1;
}

/**
 * Strips double-quote character entries from a legacy ElevenLabs alignment object so
 * `alignment.characters.join("") === strippedText` remains true for karaoke word mapping.
 */
function sanitizeAlignmentForStrippedText(
  alignment: NonNullable<DialogueLine["alignment"]>,
  strippedText: string,
): NonNullable<DialogueLine["alignment"]> {
  if (
    !alignment ||
    !Array.isArray(alignment.characters) ||
    alignment.characters.join("") === strippedText
  ) {
    return alignment;
  }

  const starts = Array.isArray(alignment.character_start_times_seconds)
    ? alignment.character_start_times_seconds
    : [];
  const ends = Array.isArray(alignment.character_end_times_seconds)
    ? alignment.character_end_times_seconds
    : [];

  const filteredChars: string[] = [];
  const filteredStarts: number[] = [];
  const filteredEnds: number[] = [];

  for (let i = 0; i < alignment.characters.length; i++) {
    const c = alignment.characters[i];
    if (/["\u201C\u201D\u201E\u201F]/.test(c)) continue;
    filteredChars.push(c);
    if (starts[i] !== undefined) filteredStarts.push(starts[i]);
    if (ends[i] !== undefined) filteredEnds.push(ends[i]);
  }

  // Trim leading/trailing whitespace characters if needed to match `strippedText`
  while (
    filteredChars.length > 0 &&
    /^\s$/.test(filteredChars[0]) &&
    filteredChars.join("") !== strippedText
  ) {
    filteredChars.shift();
    filteredStarts.shift();
    filteredEnds.shift();
  }
  while (
    filteredChars.length > 0 &&
    /^\s$/.test(filteredChars[filteredChars.length - 1]) &&
    filteredChars.join("") !== strippedText
  ) {
    filteredChars.pop();
    filteredStarts.pop();
    filteredEnds.pop();
  }

  if (filteredChars.join("") === strippedText) {
    return {
      characters: filteredChars,
      character_start_times_seconds: filteredStarts,
      character_end_times_seconds: filteredEnds,
    };
  }

  return alignment;
}

/**
 * Parses unified screenplay text into structured `DialogueLine[]`.
 *
 * Handles:
 * - Straight (`"`) and curly (`“`, `”`) quotation marks (stripped from `DialogueLine.text` for TTS)
 * - Multi-line and multi-paragraph continuation inside open quotes until a closing quote
 * - Inner quotes (e.g. `NARRATOR: "There isn't much a 2D "thing" can do."`) without premature closing
 * - Returning subsequent untagged text after a closing quote to Story Text (`plain`)
 * - Multiple speakers on a single line (`SARAH: "Hi!" LUCAS: "Hey!"`)
 * - Ignoring false-positive colons (`10:30`, `https://`, lowercase prose `she said:`)
 * - Preserving pre-recorded `audioUrl`, `alignment`, and `duration` from `existingLines`
 */
export function parseScreenplayToDialogueLines(
  text: string,
  existingLines?: DialogueLine[],
  storyCharacters: StoryCharacter[] = [],
  options?: ScreenplayParseOptions,
): DialogueLine[] {
  if (!text || !text.trim()) return [];

  const result: DialogueLine[] = [];
  const usedExistingIndices = new Set<number>();

  let currentSpeakerRaw: string | null = null;
  let currentBuffer = "";
  let inQuote = false;
  let innerQuoteDepth = 0;
  let lastOpenQuoteIdx = -1;
  let quoteClosedInSegment = false;
  let afterClosingQuote = false;
  let atLineStart = true;

  const flushBuffer = () => {
    const combined = currentBuffer.trim();
    currentBuffer = "";
    if (!combined) {
      return;
    }

    const stripped = stripDialogueQuotes(combined).trim();
    if (!stripped) {
      return;
    }

    const speakerInfo = resolveSpeakerInfo(
      currentSpeakerRaw,
      storyCharacters,
      options,
    );
    const charId = speakerInfo.characterId;
    const charName = speakerInfo.characterName;

    const matchExisting = (allowUsed: boolean): DialogueLine | undefined => {
      if (!existingLines || existingLines.length === 0) return undefined;
      for (let idx = 0; idx < existingLines.length; idx++) {
        if (!allowUsed && usedExistingIndices.has(idx)) continue;
        const el = existingLines[idx];
        const speakerMatches = speakerInfo.isPlain
          ? el.characterId === charId ||
            el.characterId === DEFAULT_PLAIN_TEXT_ID ||
            el.characterId === "narrator"
          : el.characterId === charId ||
            cleanSpeakerToken(el.characterName).toLowerCase() ===
              cleanSpeakerToken(charName).toLowerCase();

        if (!speakerMatches) continue;

        const elStripped = stripDialogueQuotes(el.text).trim();
        const textMatches =
          el.text === stripped ||
          elStripped === stripped ||
          el.text.trim() === combined;

        if (textMatches) {
          usedExistingIndices.add(idx);
          return el;
        }
      }
      return undefined;
    };

    const existing = matchExisting(false) || matchExisting(true);

    const lineObj: DialogueLine = {
      id:
        existing && !result.some((r) => r.id === existing.id)
          ? existing.id
          : "dl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      characterId: charId,
      characterName: charName,
      text: stripped,
      audioUrl: existing?.audioUrl || null,
    };

    if (existing?.alignment) {
      lineObj.alignment = sanitizeAlignmentForStrippedText(
        existing.alignment,
        stripped,
      );
    }
    if (existing?.duration !== undefined) {
      lineObj.duration = existing.duration;
    }

    result.push(lineObj);
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (inQuote) {
      if (isQuoteChar(ch)) {
        if (
          isInnerQuoteOpener(
            text,
            i,
            lastOpenQuoteIdx,
            storyCharacters,
            options,
          )
        ) {
          innerQuoteDepth++;
          lastOpenQuoteIdx = i;
          currentBuffer += ch;
          i++;
          continue;
        }

        if (innerQuoteDepth > 0) {
          innerQuoteDepth--;
          currentBuffer += ch;
          i++;
          continue;
        }

        // Closes the outer dialogue quotation
        inQuote = false;
        innerQuoteDepth = 0;
        quoteClosedInSegment = true;
        afterClosingQuote = true;
        atLineStart = false;
        currentBuffer += ch;
        i++;

        // Keep any immediate trailing sentence punctuation (e.g. `"Hello".`) attached to the quote
        while (i < text.length && /[.,!?;:]/.test(text[i])) {
          currentBuffer += text[i];
          i++;
        }
        continue;
      }

      currentBuffer += ch;
      if (ch === "\n") {
        atLineStart = true;
      } else if (ch !== " " && ch !== "\t" && ch !== "\r") {
        atLineStart = false;
      }
      i++;
      continue;
    }

    // Outside quotes (`inQuote === false`)
    if (ch === "\n") {
      currentBuffer += ch;
      atLineStart = true;
      i++;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      currentBuffer += ch;
      i++;
      continue;
    }

    // Check for speaker tag at `i`
    const tagMatch = matchSpeakerTagAt(
      text,
      i,
      storyCharacters,
      options,
      atLineStart,
      afterClosingQuote,
    );
    if (tagMatch) {
      flushBuffer();
      currentSpeakerRaw = tagMatch.speakerRaw;
      inQuote = false;
      innerQuoteDepth = 0;
      lastOpenQuoteIdx = -1;
      quoteClosedInSegment = false;
      afterClosingQuote = false;
      atLineStart = false;
      i += tagMatch.length;
      continue;
    }

    // Check for opening quotation mark
    if (isQuoteChar(ch)) {
      if (quoteClosedInSegment && currentSpeakerRaw !== null && atLineStart) {
        // A new quoted line after the previous quote already closed on an earlier line
        flushBuffer();
        currentSpeakerRaw = null;
      }
      inQuote = true;
      innerQuoteDepth = 0;
      lastOpenQuoteIdx = i;
      quoteClosedInSegment = false;
      afterClosingQuote = false;
      atLineStart = false;
      currentBuffer += ch;
      i++;
      continue;
    }

    // Ordinary untagged text outside quotes:
    // If a speaker's quote already closed, subsequent untagged text returns to Story Text (TXT-2).
    if (quoteClosedInSegment && currentSpeakerRaw !== null) {
      flushBuffer();
      currentSpeakerRaw = null;
      quoteClosedInSegment = false;
      afterClosingQuote = false;
    }

    currentBuffer += ch;
    atLineStart = false;
    afterClosingQuote = false;
    i++;
  }

  flushBuffer();
  return result;
}

/**
 * Generates HTML for the screenplay editor highlight backdrop (TXT-4):
 * - Speaker tags (`NAME:`) remain uncolored.
 * - When an opening quotation mark is unclosed, ALL text after that opening quotation mark
 *   is underlined (`text-decoration: underline`).
 * - When a closing quotation mark completes the segment, the text between the quotation marks
 *   is colored in the character's chosen/assigned color.
 * - Preserves exact character positions so the backdrop aligns with the `<textarea>` caret.
 */
export function highlightScreenplayHtml(
  text: string,
  options?: ScreenplayColorOptions,
): string {
  if (!text) return "";

  const storyCharacters = options?.storyCharacters || [];
  let html = "";
  let currentSpeakerRaw: string | null = null;
  let quoteClosedInSegment = false;
  let afterClosingQuote = false;
  let atLineStart = true;

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\n") {
      html += "\n";
      atLineStart = true;
      i++;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\r") {
      html += escapeHtml(ch);
      i++;
      continue;
    }

    // 1. Check for speaker tag at `i`
    const tagMatch = matchSpeakerTagAt(
      text,
      i,
      storyCharacters,
      options,
      atLineStart,
      afterClosingQuote,
    );
    if (tagMatch) {
      currentSpeakerRaw = tagMatch.speakerRaw;
      quoteClosedInSegment = false;
      afterClosingQuote = false;
      atLineStart = false;
      const speakerInfo = resolveSpeakerInfo(
        currentSpeakerRaw,
        storyCharacters,
        options,
      );
      html += `<span class="screenplay-speaker-tag" data-speaker="${escapeHtml(speakerInfo.characterId)}">${escapeHtml(tagMatch.fullMatch)}</span>`;
      i += tagMatch.length;
      continue;
    }

    // 2. Check for opening quotation mark at `i`
    if (isQuoteChar(ch)) {
      if (quoteClosedInSegment && currentSpeakerRaw !== null && atLineStart) {
        currentSpeakerRaw = null;
      }
      const speakerInfo = resolveSpeakerInfo(
        currentSpeakerRaw,
        storyCharacters,
        options,
      );
      const closeIdx = findClosingQuoteIndex(
        text,
        i,
        storyCharacters,
        options,
      );

      if (closeIdx === -1) {
        // Unclosed opening quote: underline ALL text after the opening quotation mark
        const openQuoteChar = text[i];
        const restOfText = text.slice(i + 1);
        html += `<span class="screenplay-quote-open" data-quote-state="open" data-speaker="${escapeHtml(speakerInfo.characterId)}" style="text-decoration: underline;">${escapeHtml(openQuoteChar)}<span class="screenplay-quote-text" style="text-decoration: underline;">${escapeHtml(restOfText)}</span></span>`;
        i = text.length;
        break;
      } else {
        // Closed quote: color the text between the quotation marks in the speaker's assigned color
        const openQuoteChar = text[i];
        const innerText = text.slice(i + 1, closeIdx);
        const closeQuoteChar = text[closeIdx];
        const color = resolveSpeakerColor(currentSpeakerRaw, options);
        html += `<span class="screenplay-quote-closed" data-quote-state="closed" data-speaker="${escapeHtml(speakerInfo.characterId)}" style="color: ${escapeHtml(color)};">${escapeHtml(openQuoteChar)}<span class="screenplay-quote-text" style="color: ${escapeHtml(color)};">${escapeHtml(innerText)}</span>${escapeHtml(closeQuoteChar)}</span>`;
        quoteClosedInSegment = true;
        afterClosingQuote = true;
        atLineStart = false;
        i = closeIdx + 1;
        continue;
      }
    }

    // 3. Ordinary untagged character outside quotes
    if (quoteClosedInSegment && currentSpeakerRaw !== null) {
      currentSpeakerRaw = null;
      quoteClosedInSegment = false;
      afterClosingQuote = false;
    }

    html += escapeHtml(ch);
    atLineStart = false;
    afterClosingQuote = false;
    i++;
  }

  return html;
}
