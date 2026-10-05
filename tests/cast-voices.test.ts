// Run: npm run test:cast
import { packCast, readReservedVoices, realCharacters, isNarrationLine, narrationColorFor, PLAIN_TEXT_ID } from '../src/lib/cast-voices.ts';
import { friendlyVoiceError } from '../src/lib/voice-errors.ts';

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

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nAll cast voice tests passed');
