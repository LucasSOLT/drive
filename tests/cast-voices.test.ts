// Run: npm run test:cast
import {
  packCast,
  readReservedVoices,
  realCharacters,
  isNarrationLine,
  narrationColorFor,
  PLAIN_TEXT_ID,
  isLineMuted,
  getAudibleDialogueLines,
  areAllLinesMuted,
  buildAudiblePageWordMap,
  getSilentRangeAction,
} from '../src/lib/cast-voices.ts';
import { friendlyVoiceError } from '../src/lib/voice-errors.ts';
import { buildDialogueHtml } from '../src/lib/story-preview.ts';
import { runPreflightChecks } from '../src/lib/publishing.ts';
import type { DialogueLine } from '../src/types.ts';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else { console.log('ok  ', m); } };

const chars = [{ id: 'char_1', name: 'Maya', voiceId: 'v_maya', color: '#ef4444' }];
const voices = { narratorVoiceId: 'v_nar', narratorColor: '#7C6FFA', plainTextVoiceId: 'v_text', plainTextColor: '#22c55e' };

const packed = packCast(chars, voices);
ok(packed.length === 3, 'pack adds Narrator + Story Text');
ok(JSON.stringify(realCharacters(packed)) === JSON.stringify(chars), 'realCharacters hides the permanent entries');
ok(JSON.stringify(readReservedVoices(packed)) === JSON.stringify(voices), 'permanent voices read back exactly');
ok(packCast(packed, voices).length === 3, 'packing twice does not duplicate');

const old = readReservedVoices(chars, { narratorVoiceId: 'v_old', narratorHighlightColor: '#111111' });
ok(old.plainTextVoiceId === 'v_old' && old.plainTextColor === '#111111', 'older stories: Story Text falls back to narrator voice/color');

ok(isNarrationLine({ characterId: 'narrator' }), 'narrator line is narration');
ok(isNarrationLine({ characterId: PLAIN_TEXT_ID, characterName: '📖 Story Text' }), 'story text line is narration');
ok(!isNarrationLine({ characterId: 'char_1', characterName: 'Maya' }), 'character line is not narration');

const story = { characters: packed };
ok(narrationColorFor({ characterId: PLAIN_TEXT_ID }, story) === '#22c55e', 'reader uses Story Text color');
ok(narrationColorFor({ characterId: 'narrator' }, story) === '#7C6FFA', 'reader uses Narrator color');

ok(/out of credits/i.test(friendlyVoiceError({ code: 'quota_exceeded', message: 'This request exceeds your quota' })), 'quota error explained');
ok(friendlyVoiceError('Something odd') === 'Something odd', 'other errors pass through');

// ── Mute detection: Narrator, Story Text, and Custom Characters ──
const castWithMutedMayaAndPlain = packCast(
  [
    { id: 'char_maya', name: 'Maya', voiceId: 'v_maya', color: '#ef4444', muted: true },
    { id: 'char_leo', name: 'Leo', voiceId: 'v_leo', color: '#3b82f6', muted: false },
  ],
  {
    narratorVoiceId: 'v_nar',
    narratorColor: '#7C6FFA',
    plainTextVoiceId: 'v_text',
    plainTextColor: '#22c55e',
    narratorMuted: false,
    plainTextMuted: true,
  },
);

ok(isLineMuted({ characterId: 'char_maya', characterName: 'Maya' }, castWithMutedMayaAndPlain), 'muted character is muted by id');
ok(isLineMuted({ characterId: 'unknown', characterName: 'maya' }, castWithMutedMayaAndPlain), 'muted character is muted by case-insensitive name');
ok(!isLineMuted({ characterId: 'char_leo', characterName: 'Leo' }, castWithMutedMayaAndPlain), 'unmuted character is audible');
ok(!isLineMuted({ characterId: 'narrator', characterName: '🎙️ Narrator' }, castWithMutedMayaAndPlain), 'Narrator stays audible when only Story Text is muted');
ok(isLineMuted({ characterId: PLAIN_TEXT_ID, characterName: '📖 Story Text' }, castWithMutedMayaAndPlain), 'Story Text is muted when plainTextMuted is true');

const castWithMutedNarratorOnly = packCast(chars, {
  ...voices,
  narratorMuted: true,
  plainTextMuted: false,
});
ok(isLineMuted({ characterId: 'narrator', characterName: '🎙️ Narrator' }, castWithMutedNarratorOnly), 'Narrator is muted when narratorMuted is true');
ok(!isLineMuted({ characterId: PLAIN_TEXT_ID, characterName: '📖 Story Text' }, castWithMutedNarratorOnly), 'Story Text stays audible when only Narrator is muted');

// ── Audible lines & all-lines-muted helpers ──
const sampleLines: DialogueLine[] = [
  { id: 'l1', characterId: PLAIN_TEXT_ID, characterName: '📖 Story Text', text: 'Silent opening description' },
  { id: 'l2', characterId: 'char_leo', characterName: 'Leo', text: 'Hello world' },
  { id: 'l3', characterId: 'char_maya', characterName: 'Maya', text: 'Muted reply' },
];
const audible = getAudibleDialogueLines(sampleLines, castWithMutedMayaAndPlain);
ok(audible.length === 1 && audible[0].id === 'l2', 'getAudibleDialogueLines filters out muted Story Text and muted character');
ok(!areAllLinesMuted(sampleLines, castWithMutedMayaAndPlain), 'areAllLinesMuted is false when at least one line is audible');
ok(
  areAllLinesMuted(
    [sampleLines[0], sampleLines[2]],
    castWithMutedMayaAndPlain,
  ),
  'areAllLinesMuted is true when all non-empty lines on page are muted',
);
ok(
  areAllLinesMuted([], castWithMutedMayaAndPlain, 'Fallback plain text paragraph'),
  'areAllLinesMuted is true for fallback script text when Story Text is muted',
);
ok(
  !areAllLinesMuted([], castWithMutedNarratorOnly, 'Fallback plain text paragraph'),
  'areAllLinesMuted is false for fallback script text when only Narrator is muted and Story Text is unmuted',
);
ok(
  areAllLinesMuted([], [{ id: 'narrator', name: 'Narrator', voiceId: 'v_nar', muted: true }], 'Fallback plain text paragraph'),
  'areAllLinesMuted falls back to Narrator mute flag on legacy casts without a plain_text entry',
);
ok(
  !areAllLinesMuted([], packed, 'Fallback plain text paragraph'),
  'areAllLinesMuted is false for fallback script text when unmuted',
);

// ── Karaoke word map & silentRanges with muted lines ──
const makeCharAlignment = (text: string, startSec: number, stepSec = 0.05) => {
  const chars = text.split('');
  return {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => startSec + i * stepSec),
    character_end_times_seconds: chars.map((_, i) => startSec + (i + 1) * stepSec),
  };
};

// Case A: Muted line was skipped during pre-recording (no duration/alignment on muted line)
const unrecordedMutedLines: DialogueLine[] = [
  {
    id: 'l1',
    characterId: 'char_maya',
    characterName: 'Maya',
    text: 'Silent words here', // 3 words: indices 0, 1, 2 in DOM
  },
  {
    id: 'l2',
    characterId: 'char_leo',
    characterName: 'Leo',
    text: 'Audible speech', // 2 words: indices 3, 4 in DOM
    duration: 1.0,
    alignment: makeCharAlignment('Audible speech', 0.0),
  },
];
const mapA = buildAudiblePageWordMap(unrecordedMutedLines, '', castWithMutedMayaAndPlain, 0.3);
ok(mapA.wordMap.length === 2, 'Case A: muted line words are excluded from karaoke wordMap');
ok(mapA.wordMap[0].wordIdx === 3 && mapA.wordMap[1].wordIdx === 4, 'Case A: audible line word indices match DOM .cc-word indices after muted line');
ok(mapA.wordMap[0].startTime === 0.0, 'Case A: unrecorded muted line adds no time offset or gap before first audible line');
ok(mapA.silentRanges.length === 0, 'Case A: unrecorded muted line produces no silentRanges to skip');

// Case B: Character was muted AFTER a combined pageAudio file was recorded (muted line still has duration/alignment)
const recordedThenMutedLines: DialogueLine[] = [
  {
    id: 'l1',
    characterId: 'char_maya',
    characterName: 'Maya',
    text: 'Recorded earlier', // 2 words: indices 0, 1
    duration: 1.2,
    alignment: makeCharAlignment('Recorded earlier', 0.0),
  },
  {
    id: 'l2',
    characterId: 'char_leo',
    characterName: 'Leo',
    text: 'Still audible', // 2 words: indices 2, 3
    duration: 1.0,
    alignment: makeCharAlignment('Still audible', 0.0),
  },
  {
    id: 'l3',
    characterId: 'char_maya',
    characterName: 'Maya',
    text: 'Trailing muted line', // 3 words: indices 4, 5, 6
    duration: 1.1,
    alignment: makeCharAlignment('Trailing muted line', 0.0),
  },
];
const mapB = buildAudiblePageWordMap(recordedThenMutedLines, '', castWithMutedMayaAndPlain, 0.3);
ok(mapB.wordMap.length === 2 && mapB.wordMap[0].wordIdx === 2, 'Case B: only audible line words are in wordMap with preserved DOM index');
ok(Math.abs(mapB.wordMap[0].startTime - 1.5) < 1e-6, 'Case B: audible line timestamp preserves offset (1.2s + 0.3s gap) in combined audio');
ok(mapB.silentRanges.length === 2 && mapB.silentRanges[0].start === 0 && Math.abs(mapB.silentRanges[0].end - 1.5) < 1e-6, 'Case B: silentRanges covers leading and trailing muted line spans');
const initialAction = getSilentRangeAction(0, mapB.silentRanges, mapB.wordMap, 0);
ok(initialAction?.type === 'seek' && Math.abs((initialAction.seekTo || 0) - 1.5) < 1e-6, 'getSilentRangeAction seeks past leading muted line even before audio duration metadata loads (duration=0)');
const audibleAction = getSilentRangeAction(1.6, mapB.silentRanges, mapB.wordMap, 4.0);
ok(audibleAction === null, 'getSilentRangeAction returns null during audible line playback');
const trailingAction = getSilentRangeAction(mapB.silentRanges[1].start + 0.05, mapB.silentRanges, mapB.wordMap, 4.5);
ok(trailingAction?.type === 'finish', 'getSilentRangeAction finishes page playback when entering trailing muted line with no audible words after it');

// ── Visual fading in buildDialogueHtml ──
const previewHtml = buildDialogueHtml(sampleLines, '', '#7C6FFA', castWithMutedMayaAndPlain);
ok(previewHtml.includes('reader-dialogue-row--muted') && previewHtml.includes('data-muted="true"'), 'buildDialogueHtml marks muted lines with reader-dialogue-row--muted and data-muted="true"');
const rowMatches = previewHtml.match(/class="reader-dialogue-row[^"]*"/g) || [];
ok(
  rowMatches.length === 3 &&
    rowMatches[0].includes('reader-dialogue-row--muted') &&
    !rowMatches[1].includes('reader-dialogue-row--muted') &&
    rowMatches[2].includes('reader-dialogue-row--muted'),
  'buildDialogueHtml fades only the muted lines and keeps audible lines normal',
);

// ── Preflight checks ignore muted characters without voices and all-muted pages ──
const preflightReport = runPreflightChecks({
  title: 'Silent Test Story',
  synopsis: 'A story with a muted character and silent page',
  coverImage: 'https://example.com/cover.jpg',
  characters: packCast(
    [{ id: 'char_silent', name: 'Ghost', voiceId: '', muted: true }],
    { ...voices, plainTextMuted: true },
  ),
  pages: [
    {
      image: 'https://example.com/p1.jpg',
      text: 'Silent story text',
      dialogueLines: [
        { id: 'dl1', characterId: PLAIN_TEXT_ID, characterName: '📖 Story Text', text: 'Silent story text' },
      ],
    } as any,
    {
      image: 'https://example.com/p2.jpg',
      text: 'Silent ghost dialogue',
      dialogueLines: [
        { id: 'dl2', characterId: 'char_silent', characterName: 'Ghost', text: 'Silent ghost dialogue' },
      ],
    } as any,
  ],
});
const charVoiceCheck = preflightReport.checks.find(c => c.id === 'voices');
const audioCheck = preflightReport.checks.find(c => c.id === 'audio');
ok(charVoiceCheck?.status === 'pass', 'preflight check passes when a character without a voice is muted');
ok(audioCheck?.status === 'pass', 'preflight check passes when all dialogue lines on a page are intentionally muted');

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nAll cast voice tests passed');



