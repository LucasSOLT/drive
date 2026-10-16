// Run: npm run test:settings
import { buildGroupPatch, readGroupSettings, validateSettings } from '../src/lib/story-settings.ts';
import { packCast, readReservedVoices, realCharacters, NARRATOR_ID, PLAIN_TEXT_ID } from '../src/lib/cast-voices.ts';
import { findEpisodeNeighbors } from '../src/lib/episode-nav.ts';
import type { Story, StoryCharacter } from '../src/types.ts';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else { console.log('ok  ', m); } };

const maya: StoryCharacter = { id: 'char_maya', name: 'Maya', voiceId: 'v_maya', color: '#ef4444' };
const leo: StoryCharacter = { id: 'char_leo', name: 'Leo', voiceId: 'v_leo', color: '#3b82f6', muted: true };

const ep = (over: Partial<Story>): Story => ({
  id: 'e1', title: 'Saga', author: 'A', genre: 'Fantasy', format: 'book', synopsis: 'S', coverImage: '',
  readCount: 0, isFeatured: false, isEditorPick: false, panels: [], ...over,
} as Story);

// ── mute round-trips through the reserved entries ──
const packed = packCast([maya, leo], {
  narratorVoiceId: 'v_nar', narratorColor: '#7C6FFA', plainTextVoiceId: 'v_txt', plainTextColor: '#22c55e',
  narratorMuted: true, plainTextMuted: false,
});
const narratorEntry = packed.find(c => c.id === NARRATOR_ID)!;
const plainEntry = packed.find(c => c.id === PLAIN_TEXT_ID)!;
ok(narratorEntry.muted === true, 'muted Narrator is stored on its entry');
ok(!('muted' in plainEntry), 'un-muted Story Text stores no muted key');
const rv = readReservedVoices(packed);
ok(rv.narratorMuted === true && !rv.plainTextMuted, 'reserved mute flags read back');
ok(realCharacters(packed).find(c => c.id === 'char_leo')?.muted === true, 'custom character mute survives pack/unpack');
ok(JSON.stringify(JSON.parse(JSON.stringify(packed))) === JSON.stringify(packed), 'mute survives JSON save/load');

// ── reading a story's settings: episode 1 wins, later-only characters are kept ──
const ep1 = ep({ id: 'e1', storyGroupId: 'g', episodeNumber: 1, title: 'Saga', themeColor: '#000000', narratorVoiceId: 'v_nar', characters: packed });
const ep2 = ep({ id: 'e2', storyGroupId: 'g', episodeNumber: 2, title: 'Old title', characters: [maya, { id: 'char_zed', name: 'Zed', voiceId: 'v_zed' }] });
const s = readGroupSettings([ep2, ep1])!;
ok(s.title === 'Saga' && s.themeColor === '#000000', 'episode 1 provides title and theme color');
ok(s.characters.map(c => c.id).join() === 'char_maya,char_leo,char_zed', 'characters merged without duplicates, later-only kept');
ok(s.narrator.muted === true && s.narrator.voiceId === 'v_nar', 'narrator mute and voice read');
ok(s.plainText.voiceId === 'v_txt' && s.plainText.muted === false, 'story text voice read');
ok(readGroupSettings([]) === null, 'no episodes -> null');

const legacy = readGroupSettings([ep({ id: 'old', characters: [maya], narratorVoiceId: 'v_old' })])!;
ok(legacy.narrator.voiceId === 'v_old' && legacy.plainText.voiceId === 'v_old', 'older story without reserved entries falls back to the narrator voice');
ok(!legacy.narrator.muted && !legacy.plainText.muted, 'older story is not muted');

// ── saving: remove a character, mute story text ──
const edited = { ...s, characters: s.characters.filter(c => c.id !== 'char_maya'), plainText: { ...s.plainText, muted: true } };
ok(validateSettings(edited) === null, 'edited settings validate');
const patch = buildGroupPatch(edited);
const saved = patch.characters!;
ok(!saved.some(c => c.id === 'char_maya'), 'removed character is gone from the saved cast');
ok(saved.find(c => c.id === PLAIN_TEXT_ID)?.muted === true, 'muted Story Text is saved');
ok(saved.find(c => c.id === NARRATOR_ID)?.muted === true, 'muted Narrator still saved');
ok(saved.find(c => c.id === 'char_leo')?.muted === true, 'muted character still saved');
ok(saved.filter(c => c.id === NARRATOR_ID || c.id === PLAIN_TEXT_ID).length === 2, 'Narrator and Story Text always present exactly once');
ok(patch.narratorVoiceId === 'v_nar', 'narrator voice column value is carried');

const unmuted = buildGroupPatch({ ...edited, narrator: { ...edited.narrator, muted: false }, characters: [{ ...leo, muted: false }] });
ok(unmuted.characters!.every(c => c.muted !== true || c.id === PLAIN_TEXT_ID), 'unmuting removes the muted flag');

// ── manualNumbering round-trip ──
const withManual = buildGroupPatch({ ...edited, manualNumbering: true });
ok(withManual.manualNumbering === true, 'buildGroupPatch carries manualNumbering=true');
ok(withManual.characters!.find(c => c.id === NARRATOR_ID)?.manualNumbering === true, 'manualNumbering=true stored on Narrator entry');
ok(readReservedVoices(withManual.characters!).manualNumbering === true, 'readReservedVoices reads manualNumbering=true back');
const readBackManual = readGroupSettings([ep({ id: 'e_man', characters: withManual.characters! })])!;
ok(readBackManual.manualNumbering === true, 'readGroupSettings reads manualNumbering=true from cast metadata');

const withoutManual = buildGroupPatch({ ...edited, manualNumbering: false });
ok(!('manualNumbering' in withoutManual.characters!.find(c => c.id === NARRATOR_ID)!), 'manualNumbering=false omits key on Narrator entry');
ok(!readReservedVoices(withoutManual.characters!).manualNumbering, 'readReservedVoices reads manualNumbering=false back');
const readBackDisabled = readGroupSettings([ep({ id: 'e_man_off', characters: withoutManual.characters! })])!;
ok(readBackDisabled.manualNumbering === false, 'readGroupSettings reads manualNumbering=false after toggle off');

// ── decimal episode numbering & sequential next-ep formula ──
const decEpisodes = [
  ep({ id: 'e1', storyGroupId: 'g', episodeNumber: 1 }),
  ep({ id: 'e15', storyGroupId: 'g', episodeNumber: 1.5, episodeTitle: 'Bonus 1.5' }),
  ep({ id: 'e2', storyGroupId: 'g', episodeNumber: 2 }),
  ep({ id: 'e25', storyGroupId: 'g', episodeNumber: 2.5, episodeTitle: 'Bonus 2.5' }),
];
const neighbors15 = findEpisodeNeighbors(decEpisodes, 'g', 1.5, 'e15');
ok(neighbors15.prev?.id === 'e1' && neighbors15.next?.id === 'e2', 'decimal episode 1.5 has neighbors ep 1 and ep 2');
const nextAfterDec = Math.floor(Math.max(0, ...decEpisodes.map((e, idx) => e.episodeNumber ?? (idx + 1))) + 1);
ok(nextAfterDec === 3, 'next episode after [1, 1.5, 2, 2.5] is 3');
const gapEpisodes = [
  ep({ id: 'e1', storyGroupId: 'g', episodeNumber: 1 }),
  ep({ id: 'e2', storyGroupId: 'g', episodeNumber: 2 }),
  ep({ id: 'e4', storyGroupId: 'g', episodeNumber: 4 }),
];
const nextAfterGap = Math.floor(Math.max(0, ...gapEpisodes.map((e, idx) => e.episodeNumber ?? (idx + 1))) + 1);
ok(nextAfterGap === 5, 'next episode after [1, 2, 4] (deleted ep 3) is 5 (no duplicate ep 4)');

// ── validation ──
const base = { ...s };
ok(validateSettings({ ...base, title: '  ' }) !== null, 'empty title rejected');
ok(validateSettings({ ...base, themeColor: 'red' }) !== null, 'bad theme color rejected');
ok(validateSettings({ ...base, characters: [{ ...maya, name: ' ' }] }) !== null, 'blank character name rejected');
ok(validateSettings({ ...base, characters: [{ ...maya, name: 'narrator' }] }) !== null, 'name "narrator" rejected');
ok(validateSettings({ ...base, characters: [{ ...maya, name: 'Story Text' }] }) !== null, 'name "Story Text" rejected');
ok(validateSettings({ ...base, characters: [maya, { ...leo, name: 'maya' }] }) !== null, 'duplicate names rejected (case-insensitive)');
ok(validateSettings({ ...base, characters: [{ ...maya, voiceId: '' }] }) !== null, 'missing voice rejected');

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nAll story settings tests passed');
