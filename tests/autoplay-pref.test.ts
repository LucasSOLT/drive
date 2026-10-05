import { readAutoplayPref, writeAutoplayPref, AUTOPLAY_PREF_KEY } from '../src/lib/autoplay-pref.ts';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } };

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    raw: m,
  };
}

// default is OFF
{
  const s = fakeStore();
  ok(readAutoplayPref(s as any) === false, 'default off');
}

// ON in one story persists for the next story/episode (same device storage)
{
  const s = fakeStore();
  writeAutoplayPref(true, s as any);
  ok(s.raw.get(AUTOPLAY_PREF_KEY) === '1', 'stored as 1');
  ok(readAutoplayPref(s as any) === true, 'story 2 sees ON');
  ok(readAutoplayPref(s as any) === true, 'story 3 sees ON');
}

// OFF afterwards persists for all following stories
{
  const s = fakeStore({ [AUTOPLAY_PREF_KEY]: '1' });
  writeAutoplayPref(false, s as any);
  ok(readAutoplayPref(s as any) === false, 'OFF persists');
}

// garbage value is treated as OFF
{
  const s = fakeStore({ [AUTOPLAY_PREF_KEY]: 'banana' });
  ok(readAutoplayPref(s as any) === false, 'garbage -> off');
}

// blocked / throwing storage never crashes
{
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  ok(readAutoplayPref(bad as any) === false, 'throwing read -> off');
  let threw = false;
  try { writeAutoplayPref(true, bad as any); } catch { threw = true; }
  ok(!threw, 'throwing write does not throw');
  ok(readAutoplayPref(null) === false, 'null storage -> off');
  writeAutoplayPref(true, null);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
