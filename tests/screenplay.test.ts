// Run: npm run test:screenplay
import fs from "fs";
import {
  stripDialogueQuotes,
  normalizeCurlyQuotes,
  resolveSpeakerInfo,
  resolveSpeakerColor,
  findClosingQuoteIndex,
  parseScreenplayToDialogueLines,
  highlightScreenplayHtml,
} from "../src/lib/screenplay.ts";
import { PLAIN_TEXT_ID, PLAIN_TEXT_NAME } from "../src/lib/cast-voices.ts";
import { KaraokeController } from "../src/lib/karaoke.ts";
import type { DialogueLine, StoryCharacter } from "../src/types.ts";

let fails = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    fails++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok  ", msg);
  }
};

const cast: StoryCharacter[] = [
  { id: "char_sarah", name: "Sarah", voiceId: "v_sarah", color: "#ef4444" },
  { id: "char_lucas", name: "Lucas", voiceId: "v_lucas", color: "#3b82f6" },
  { id: "char_old_man", name: "Old Man", voiceId: "v_old", color: "#f59e0b" },
];

const simplify = (lines: DialogueLine[]) =>
  lines.map((l) => ({
    charId: l.characterId,
    charName: l.characterName,
    text: l.text,
  }));

// ── 1. Curly Quote Normalization & Quote Stripping (TXT-1) ──
ok(
  stripDialogueQuotes('“Hello "world"!”') === "Hello world!",
  "stripDialogueQuotes removes straight and curly double quotes",
);
ok(
  stripDialogueQuotes("There isn’t much a 'thing' can't do.") ===
    "There isn’t much a 'thing' can't do.",
  "stripDialogueQuotes preserves straight and curly apostrophes",
);
ok(
  normalizeCurlyQuotes("“Don’t stop,” she said.") ===
    '"Don\'t stop," she said.',
  "normalizeCurlyQuotes normalizes curly double and single quotes",
);

const curlySingle = parseScreenplayToDialogueLines("SARAH: “Hello there!”", [], cast);
ok(
  curlySingle.length === 1 &&
    curlySingle[0].characterId === "char_sarah" &&
    curlySingle[0].text === "Hello there!",
  "TXT-1: curly quotes parsed for character and stripped from DialogueLine.text",
);

const mixedQuotes = parseScreenplayToDialogueLines('SARAH: “Hello world!"', [], cast);
ok(
  mixedQuotes.length === 1 &&
    mixedQuotes[0].characterId === "char_sarah" &&
    mixedQuotes[0].text === "Hello world!",
  "TXT-1: mixed curly opening and straight closing quote parsed and stripped",
);

// ── 2. Paragraph Spans / Continuation & Inner Quotes (TXT-2) ──
const multiParaQuoted = parseScreenplayToDialogueLines(
  `SARAH: "This is my story.\n\nIt is very long."`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(multiParaQuoted)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "This is my story.\n\nIt is very long.",
      },
    ]),
  "TXT-2: multi-paragraph quoted dialogue stays with speaker until closing quote",
);

const quoteOnOwnLine = parseScreenplayToDialogueLines(
  `SARAH: "\nFirst line of speech.\n\nSecond paragraph of speech."\nHe walked away.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(quoteOnOwnLine)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "First line of speech.\n\nSecond paragraph of speech.",
      },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "He walked away.",
      },
    ]),
  "TXT-2: opening quote at end of speaker tag line continues across lines and returns to Story Text after closing quote",
);

const untaggedAfterQuoteNextLine = parseScreenplayToDialogueLines(
  `SARAH: "Hi!"\nHe walks away.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(untaggedAfterQuoteNextLine)) ===
    JSON.stringify([
      { charId: "char_sarah", charName: "Sarah", text: "Hi!" },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "He walks away.",
      },
    ]),
  "TXT-2: untagged line immediately after closed quote returns to Story Text",
);

const untaggedAfterQuoteBlankLine = parseScreenplayToDialogueLines(
  `SARAH: "Hi!"   \n\nHe walks away.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(untaggedAfterQuoteBlankLine)) ===
    JSON.stringify([
      { charId: "char_sarah", charName: "Sarah", text: "Hi!" },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "He walks away.",
      },
    ]),
  "TXT-2: untagged line after blank line and trailing spaces returns to Story Text",
);

const untaggedAfterQuoteSameLine = parseScreenplayToDialogueLines(
  `SARAH: "Hi!" He walks away.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(untaggedAfterQuoteSameLine)) ===
    JSON.stringify([
      { charId: "char_sarah", charName: "Sarah", text: "Hi!" },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "He walks away.",
      },
    ]),
  "TXT-2: untagged prose on the same line after a closing quote returns to Story Text",
);

const unquotedMultiPara = parseScreenplayToDialogueLines(
  `SARAH: This is my\nfirst paragraph.\n\nAnd my second.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(unquotedMultiPara)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "This is my\nfirst paragraph.\n\nAnd my second.",
      },
    ]),
  "TXT-2: unquoted speaker text continues across paragraphs when no quote was closed",
);

const innerQuotesStraight = parseScreenplayToDialogueLines(
  `NARRATOR: "There isn't much a 2D "thing" can do."`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(innerQuotesStraight)) ===
    JSON.stringify([
      {
        charId: "narrator",
        charName: "🎙️ Narrator",
        text: "There isn't much a 2D thing can do.",
      },
    ]),
  'TXT-2: inner straight quotes ("thing") do not prematurely close the dialogue segment',
);

const innerQuotesCurly = parseScreenplayToDialogueLines(
  `NARRATOR: “There isn't much a 2D “thing” can do.”\nThe end.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(innerQuotesCurly)) ===
    JSON.stringify([
      {
        charId: "narrator",
        charName: "🎙️ Narrator",
        text: "There isn't much a 2D thing can do.",
      },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "The end.",
      },
    ]),
  "TXT-2: inner curly quotes (“thing”) do not prematurely close the dialogue segment, and subsequent untagged text returns to Story Text",
);

const multipleInnerQuotes = parseScreenplayToDialogueLines(
  `SARAH: "He called the "cat" a "tiger" yesterday."`,
  [],
  cast,
);
ok(
  multipleInnerQuotes.length === 1 &&
    multipleInnerQuotes[0].characterId === "char_sarah" &&
    multipleInnerQuotes[0].text === "He called the cat a tiger yesterday.",
  "TXT-2: multiple inner quoted phrases in one dialogue segment stay in one line",
);

// ── 3. Multiple Speakers, False-Positive Colons, Unknown Characters (TXT-3) ──
const multiSpeakersOneLine = parseScreenplayToDialogueLines(
  `SARAH: "Hi!" LUCAS: "Hey!"`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(multiSpeakersOneLine)) ===
    JSON.stringify([
      { charId: "char_sarah", charName: "Sarah", text: "Hi!" },
      { charId: "char_lucas", charName: "Lucas", text: "Hey!" },
    ]),
  "TXT-3: multiple speakers on a single line are split into distinct DialogueLines",
);

const multiWordKnownSpeaker = parseScreenplayToDialogueLines(
  `OLD MAN: "Stay back!" [Sarah] (gasping): "Run!"`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(multiWordKnownSpeaker)) ===
    JSON.stringify([
      { charId: "char_old_man", charName: "Old Man", text: "Stay back!" },
      { charId: "char_sarah", charName: "Sarah", text: "Run!" },
    ]),
  "TXT-3: multi-word character names, bracketed tags, and parenthetical emotions are supported",
);

const unknownChar = parseScreenplayToDialogueLines(`BOB: "Yo"`, [], cast);
ok(
  JSON.stringify(simplify(unknownChar)) ===
    JSON.stringify([{ charId: "unknown", charName: "BOB", text: "Yo" }]),
  "TXT-3: unknown character is tagged with characterId='unknown' and preserves name",
);

const falsePositiveColons = parseScreenplayToDialogueLines(
  `At 10:30 she said: "Check https://example.com for the rule: run!"`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(falsePositiveColons)) ===
    JSON.stringify([
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "At 10:30 she said: Check https://example.com for the rule: run!",
      },
    ]),
  "TXT-3: timestamps (10:30), URLs (https://), and lowercase prose colons (she said:, rule:) do not trigger false speaker tags",
);

const colonInsideOpenQuote = parseScreenplayToDialogueLines(
  `SARAH: "And then LUCAS: said meet at 10:30!"`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(colonInsideOpenQuote)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "And then LUCAS: said meet at 10:30!",
      },
    ]),
  "TXT-3: speaker-like cue inside an open quote is kept as part of the spoken dialogue",
);

const storyTextTag = parseScreenplayToDialogueLines(
  `Story Text: "The wind howled."\n[🎙️ Narrator]: "Listen closely."`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(storyTextTag)) ===
    JSON.stringify([
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "The wind howled.",
      },
      {
        charId: "narrator",
        charName: "🎙️ Narrator",
        text: "Listen closely.",
      },
    ]),
  "TXT-3: explicit Story Text and emoji Narrator tags resolve cleanly without unknown character warnings",
);

// Check that admin-create.ts fixed the literal '?? Unknown character' typo to '⚠️ Unknown character'
const adminCreateSrc = fs.readFileSync("src/views/admin-create.ts", "utf-8");
ok(
  adminCreateSrc.includes("⚠️ Unknown character detected in script. Add to Cast.") &&
    !adminCreateSrc.includes("?? Unknown character detected in script"),
  "TXT-3: admin-create.ts uses ⚠️ warning icon instead of literal ?? in unknown character chip",
);

// ── 4. Character Color Highlighting & Underlining (TXT-4) ──
const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const unclosedText = `SARAH: "Hello world\nStill typing across lines`;
const unclosedHtml = highlightScreenplayHtml(unclosedText, {
  storyCharacters: cast,
  narratorColor: "#6EE7B7",
  plainTextColor: "#c4b5fd",
});
ok(
  unclosedHtml.includes('class="screenplay-speaker-tag"') &&
    !unclosedHtml.includes('class="screenplay-speaker-tag" style="color:'),
  "TXT-4: speaker tag (SARAH:) remains uncolored",
);
ok(
  unclosedHtml.includes('class="screenplay-quote-open"') &&
    unclosedHtml.includes('data-quote-state="open"') &&
    unclosedHtml.includes("text-decoration: underline") &&
    !unclosedHtml.includes("#ef4444"),
  "TXT-4: unclosed opening quote underlines all text after it without applying closed character color",
);
ok(
  stripHtml(unclosedHtml) === unclosedText,
  "TXT-4: highlightScreenplayHtml preserves exact character sequence for unclosed quote",
);

const unclosedWithInnerQuote = `NARRATOR: "There isn't much a 2D "thing" can do`;
const unclosedInnerHtml = highlightScreenplayHtml(unclosedWithInnerQuote, {
  storyCharacters: cast,
  narratorColor: "#6EE7B7",
  plainTextColor: "#c4b5fd",
});
ok(
  unclosedInnerHtml.includes('data-quote-state="open"') &&
    unclosedInnerHtml.includes("text-decoration: underline") &&
    !unclosedInnerHtml.includes('data-quote-state="closed"'),
  "TXT-4: inner quote does not prematurely close underline state while outer quote is still unclosed",
);

const closedText = `SARAH: "Hello world!"`;
const closedHtml = highlightScreenplayHtml(closedText, {
  storyCharacters: cast,
  narratorColor: "#6EE7B7",
  plainTextColor: "#c4b5fd",
});
ok(
  closedHtml.includes('class="screenplay-quote-closed"') &&
    closedHtml.includes('data-quote-state="closed"') &&
    closedHtml.includes("color: #ef4444;") &&
    !closedHtml.includes("text-decoration: underline"),
  "TXT-4: closed quote colors text between quotation marks in character's assigned color (#ef4444) and removes underline",
);
ok(
  stripHtml(closedHtml) === closedText,
  "TXT-4: highlightScreenplayHtml preserves exact character sequence for closed quote",
);

const unknownClosedHtml = highlightScreenplayHtml(`BOB: “Yo!”`, {
  storyCharacters: cast,
});
const bobColor = resolveSpeakerColor("BOB", { storyCharacters: cast });
ok(
  Boolean(bobColor) &&
    unknownClosedHtml.includes(`color: ${bobColor};`) &&
    unknownClosedHtml.includes("“") &&
    unknownClosedHtml.includes("”"),
  "TXT-4 & TXT-1: unknown character gets deterministic system palette color and visually preserves curly quotes",
);

// ── 5. Audio & Timestamp Alignment Preservation ──
const existingLines: DialogueLine[] = [
  {
    id: "dl_existing_1",
    characterId: "char_sarah",
    characterName: "Sarah",
    text: '"Hello!"', // legacy unstripped text
    audioUrl: "https://cdn.example.com/sarah_1.mp3",
    duration: 1.8,
    alignment: {
      characters: ["H", "e", "l", "l", "o", "!"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    },
  },
  {
    id: "dl_existing_2",
    characterId: "char_lucas",
    characterName: "Lucas",
    text: "Stay close.", // already stripped text
    audioUrl: "https://cdn.example.com/lucas_1.mp3",
    duration: 2.1,
  },
];

const reparsed = parseScreenplayToDialogueLines(
  `SARAH: “Hello!”\nLUCAS: "Stay close."`,
  existingLines,
  cast,
);
ok(
  reparsed.length === 2 &&
    reparsed[0].id === "dl_existing_1" &&
    reparsed[0].text === "Hello!" &&
    reparsed[0].audioUrl === "https://cdn.example.com/sarah_1.mp3" &&
    reparsed[0].duration === 1.8 &&
    reparsed[0].alignment?.characters.length === 6 &&
    reparsed[1].id === "dl_existing_2" &&
    reparsed[1].audioUrl === "https://cdn.example.com/lucas_1.mp3" &&
    reparsed[1].duration === 2.1,
  "Audio Preservation: re-parsing preserves id, audioUrl, duration, and alignment for both legacy-quoted and quote-stripped existing lines",
);

// ── 6. Edge Cases (Empty Inputs, Boundary Values, Unclosed Quotes, Escaping, Duplicate Lines) ──
ok(
  parseScreenplayToDialogueLines("", [], cast).length === 0 &&
    parseScreenplayToDialogueLines("   \n\n  ", [], cast).length === 0,
  "Edge case: empty or whitespace-only input returns empty array",
);

ok(
  parseScreenplayToDialogueLines('SARAH: ""', [], cast).length === 0 &&
    parseScreenplayToDialogueLines("SARAH: “”", [], cast).length === 0 &&
    parseScreenplayToDialogueLines("SARAH:", [], cast).length === 0,
  "Edge case: speaker tag with empty quotes or no speech produces no empty DialogueLine",
);

const unclosedWhileTyping = parseScreenplayToDialogueLines(
  `SARAH: "Still typing first line\nAnd second line`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(unclosedWhileTyping)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "Still typing first line\nAnd second line",
      },
    ]),
  "Edge case: unclosed quote while user is typing still parses into speaker line with opening quote stripped",
);

const innerQuoteAtEnd = parseScreenplayToDialogueLines(
  `SARAH: "Don't call me "kid""\nHe laughed.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(innerQuoteAtEnd)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "Don't call me kid",
      },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "He laughed.",
      },
    ]),
  'Edge case: inner quote at the very end of outer quote ("Don\'t call me "kid"") closes inner then outer quote properly',
);

const innerQuotePlusSecondSpeaker = parseScreenplayToDialogueLines(
  `NARRATOR: "There isn't much a 2D "thing" can do." SARAH: "Watch me!"`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(innerQuotePlusSecondSpeaker)) ===
    JSON.stringify([
      {
        charId: "narrator",
        charName: "🎙️ Narrator",
        text: "There isn't much a 2D thing can do.",
      },
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "Watch me!",
      },
    ]),
  "Edge case: inner quote followed by a second speaker on the same line splits both speakers accurately",
);

const titleCaseUnknownWithQuotes = parseScreenplayToDialogueLines(
  `Alice: "Where are we?" Rabbit: "We're late!"\nNote: the door was locked.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(titleCaseUnknownWithQuotes)) ===
    JSON.stringify([
      { charId: "unknown", charName: "Alice", text: "Where are we?" },
      { charId: "unknown", charName: "Rabbit", text: "We're late!" },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "Note: the door was locked.",
      },
    ]),
  "Edge case: Title-Case speakers before quotes are detected while unquoted 'Note: ...' stays Story Text",
);

const htmlSpecialChars = `SARAH: "5 < 10 & 20 > 3"`;
const htmlSpecialOut = highlightScreenplayHtml(htmlSpecialChars, {
  storyCharacters: cast,
});
ok(
  htmlSpecialOut.includes("5 &lt; 10 &amp; 20 &gt; 3") &&
    stripHtml(htmlSpecialOut) === htmlSpecialChars,
  "Edge case: HTML special characters inside quotes are escaped safely and preserve character alignment",
);

const dupLines = parseScreenplayToDialogueLines(
  `SARAH: "Wait!"\nLUCAS: "Why?"\nSARAH: "Wait!"`,
  [
    {
      id: "dl_wait_1",
      characterId: "char_sarah",
      characterName: "Sarah",
      text: "Wait!",
      audioUrl: "https://cdn.example.com/wait.mp3",
    },
  ],
  cast,
);
ok(
  dupLines.length === 3 &&
    dupLines[0].id === "dl_wait_1" &&
    dupLines[2].id !== "dl_wait_1" &&
    dupLines[0].audioUrl === "https://cdn.example.com/wait.mp3",
  "Edge case: duplicate dialogue lines by the same speaker do not receive duplicate line IDs",
);

// ── 7. Regression Tests for Reviewer-Discovered Edge Cases ──

// 7a. Closing quote after em-dash/hyphen followed by punctuation or prose
const emDashClosed = parseScreenplayToDialogueLines(
  `SARAH: "Wait—", she said.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(emDashClosed)) ===
    JSON.stringify([
      { charId: "char_sarah", charName: "Sarah", text: "Wait—," },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "she said.",
      },
    ]),
  'Regression: closing quote after em-dash ("Wait—", she said.) closes dialogue and returns to Story Text',
);

const emDashClosedHtml = highlightScreenplayHtml(`SARAH: "Wait—".`, {
  storyCharacters: cast,
});
ok(
  emDashClosedHtml.includes('data-quote-state="closed"') &&
    !emDashClosedHtml.includes('data-quote-state="open"'),
  'Regression: highlightScreenplayHtml marks "Wait—". as closed quote, not unclosed',
);

// 7b. Adjacent & doubly-nested inner quotes
const adjacentInnerQuotes = parseScreenplayToDialogueLines(
  `SARAH: ""Hello," he said, "goodbye.""\nHe left.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(adjacentInnerQuotes)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "Hello, he said, goodbye.",
      },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "He left.",
      },
    ]),
  'Regression: adjacent opening/closing inner quotes (""Hello," he said, "goodbye."") parse cleanly',
);

const doublyNestedQuotes = parseScreenplayToDialogueLines(
  `SARAH: "He said, "Don't call me "kid"!""\nShe smiled.`,
  [],
  cast,
);
ok(
  JSON.stringify(simplify(doublyNestedQuotes)) ===
    JSON.stringify([
      {
        charId: "char_sarah",
        charName: "Sarah",
        text: "He said, Don't call me kid!",
      },
      {
        charId: PLAIN_TEXT_ID,
        charName: "📖 " + PLAIN_TEXT_NAME,
        text: "She smiled.",
      },
    ]),
  "Regression: doubly-nested inner quotes stay in one segment until all quote levels close",
);

// 7c. Unclosed quote on line 1 above a line containing inner quotes stays unclosed (underlined)
const unclosedAboveInnerQuotedLine = `SARAH: "Still typing this line\nLUCAS: "There isn't much a 2D "thing" can do."`;
const unclosedAboveInnerHtml = highlightScreenplayHtml(
  unclosedAboveInnerQuotedLine,
  { storyCharacters: cast },
);
ok(
  findClosingQuoteIndex(unclosedAboveInnerQuotedLine, 7, cast) === -1 &&
    unclosedAboveInnerHtml.includes('data-quote-state="open"') &&
    !unclosedAboveInnerHtml.includes('data-quote-state="closed"'),
  "Regression: unclosed quote above a line with inner quotes remains unclosed and underlined",
);

// 7d. 4+ word character names, alphanumeric names (2D), and Unicode names (Zoë)
const extendedCast: StoryCharacter[] = [
  ...cast,
  {
    id: "char_wolf",
    name: "The Big Bad Wolf",
    voiceId: "v_wolf",
    color: "#22c55e",
  },
  { id: "char_zoe", name: "Zoë", voiceId: "v_zoe", color: "#ec4899" },
];
const specialSpeakers = parseScreenplayToDialogueLines(
  `THE BIG BAD WOLF: "Little pig!"\nZOË: "Bonjour!"\n2D: "I am flat!"`,
  [],
  extendedCast,
);
ok(
  JSON.stringify(simplify(specialSpeakers)) ===
    JSON.stringify([
      {
        charId: "char_wolf",
        charName: "The Big Bad Wolf",
        text: "Little pig!",
      },
      { charId: "char_zoe", charName: "Zoë", text: "Bonjour!" },
      { charId: "unknown", charName: "2D", text: "I am flat!" },
    ]),
  "Regression: 4-word known characters, Unicode names (ZOË), and alphanumeric cues (2D) match as speakers",
);

// Mid-sentence unquoted known character name with colon in prose should not split Story Text
const midSentenceKnownChar = parseScreenplayToDialogueLines(
  `The message was for Sarah: do not open the door.`,
  [],
  cast,
);
ok(
  midSentenceKnownChar.length === 1 &&
    midSentenceKnownChar[0].characterId === PLAIN_TEXT_ID,
  "Regression: mid-sentence unquoted prose 'for Sarah: do not...' stays Story Text",
);

// 7e. Legacy alignment containing quote characters is sanitized so characters.join('') === stripped text
const legacyQuotedAlignmentLines: DialogueLine[] = [
  {
    id: "dl_legacy_al",
    characterId: "char_sarah",
    characterName: "Sarah",
    text: '"Hello!"',
    audioUrl: "https://cdn.example.com/sarah_al.mp3",
    duration: 1.2,
    alignment: {
      characters: ['"', "H", "e", "l", "l", "o", "!", '"'],
      character_start_times_seconds: [0.0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55],
      character_end_times_seconds: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6],
    },
  },
];
const reparsedWithLegacyAlignment = parseScreenplayToDialogueLines(
  `SARAH: "Hello!"`,
  legacyQuotedAlignmentLines,
  cast,
);
ok(
  reparsedWithLegacyAlignment.length === 1 &&
    reparsedWithLegacyAlignment[0].text === "Hello!" &&
    reparsedWithLegacyAlignment[0].alignment?.characters.join("") ===
      "Hello!" &&
    reparsedWithLegacyAlignment[0].alignment?.character_start_times_seconds
      .length === 6 &&
    reparsedWithLegacyAlignment[0].alignment
      ?.character_start_times_seconds[0] === 0.05,
  "Regression: legacy alignment with quote characters is sanitized to match quote-stripped text for karaoke",
);

const karaokeMap = KaraokeController.buildMultiLineWordMap(
  reparsedWithLegacyAlignment,
);
ok(
  karaokeMap.length === 1 &&
    Math.abs(karaokeMap[0].startTime - 0.05) < 1e-6 &&
    Math.abs(karaokeMap[0].endTime - 0.55) < 1e-6,
  "Regression: KaraokeController.buildMultiLineWordMap uses exact character timestamps from sanitized legacy alignment",
);

// 7f. Re-parsing after adding an unknown character to Cast resolves characterId and preserves audio
const beforeCastAdd = parseScreenplayToDialogueLines(`BOB: "Yo!"`, [], cast);
beforeCastAdd[0].audioUrl = "https://cdn.example.com/bob_yo.mp3";
const castWithBob: StoryCharacter[] = [
  ...cast,
  { id: "char_bob", name: "Bob", voiceId: "v_bob", color: "#22c55e" },
];
const afterCastAdd = parseScreenplayToDialogueLines(
  `BOB: "Yo!"`,
  beforeCastAdd,
  castWithBob,
);
ok(
  beforeCastAdd[0].characterId === "unknown" &&
    afterCastAdd.length === 1 &&
    afterCastAdd[0].characterId === "char_bob" &&
    afterCastAdd[0].characterName === "Bob" &&
    afterCastAdd[0].audioUrl === "https://cdn.example.com/bob_yo.mp3",
  "Regression: re-parsing after adding Bob to Cast upgrades characterId from 'unknown' to 'char_bob' while preserving audioUrl",
);

if (fails > 0) {
  console.error(`\n${fails} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll screenplay tests passed!");
