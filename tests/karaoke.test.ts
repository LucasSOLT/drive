import { KaraokeController, LINE_GAP_SECONDS } from '../src/lib/karaoke.ts';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('FAIL', m); } };

// ───────── virtual time ─────────
let nowMs = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => nowMs }, configurable: true });
let rafQ: (() => void)[] = [];
(globalThis as any).requestAnimationFrame = (f: () => void) => { rafQ.push(f); return rafQ.length; };
(globalThis as any).cancelAnimationFrame = () => {};

class FakeAudio {
  paused = true; seeking = false; readyState = 4; playbackRate = 1; duration = 20; muted = false;
  preload = ''; src = ''; private _t = 0; private l: Record<string, Function[]> = {};
  step = 0.25; // coarse media clock step
  playStartPerf = 0; playStartMedia = 0;
  get currentTime() {
    if (this.paused) return this._t;
    const real = this.playStartMedia + (nowMs - this.playStartPerf) / 1000;
    return Math.floor(real / this.step) * this.step; // coarse, like Safari/BT
  }
  set currentTime(v: number) { this._t = v; this.playStartMedia = v; this.playStartPerf = nowMs; }
  realTime() { return this.paused ? this._t : this.playStartMedia + (nowMs - this.playStartPerf) / 1000; }
  addEventListener(e: string, f: Function) { (this.l[e] ||= []).push(f); }
  removeEventListener(e: string, f: Function) { this.l[e] = (this.l[e] || []).filter(x => x !== f); }
  emit(e: string) { (this.l[e] || []).forEach(f => f()); }
  async play() { this.playStartMedia = this._t; this.playStartPerf = nowMs; this.paused = false; this.emit('playing'); }
  pause() { this._t = this.realTime(); this.paused = true; this.emit('pause'); }
  removeAttribute() {} load() {}
}

// ───────── 1. multi-line map respects the real timeline (duration + gap) ─────────
function mkAlign(text: string, perChar: number, pre = 0) {
  const chars = [...text]; const s: number[] = []; const e: number[] = [];
  chars.forEach((_, i) => { s.push(pre + i * perChar); e.push(pre + (i + 1) * perChar); });
  return { characters: chars, character_start_times_seconds: s, character_end_times_seconds: e };
}
const L = [
  { text: 'hello there friend', alignment: mkAlign('hello there friend', 0.05), duration: 0.9 },
  { text: 'second line here now', alignment: mkAlign('second line here now', 0.05), duration: 1.0 },
  { text: 'third one', alignment: mkAlign('third one', 0.05), duration: 0.45 },
];
let map = KaraokeController.buildMultiLineWordMap(L);
ok(map.length === 3 + 4 + 2, 'word count ' + map.length);
// "second" starts at line1.dur + gap + 0
const second = map.find(w => w.wordIdx === 3)!;
ok(Math.abs(second.startTime - (0.9 + LINE_GAP_SECONDS)) < 1e-9, 'line 2 offset includes gap: ' + second.startTime);
const third = map.find(w => w.wordIdx === 7)!;
ok(Math.abs(third.startTime - (0.9 + 1.0 + 2 * LINE_GAP_SECONDS)) < 1e-9, 'line 3 offset includes 2 gaps: ' + third.startTime);
ok(map.every((w, i) => w.wordIdx === i), 'sequential word numbers');

// ───────── 2. unaligned / edited / empty lines keep numbering and timeline ─────────
const L2 = [
  { text: 'one two', alignment: mkAlign('one two', 0.1), duration: 0.7 },
  { text: 'no alignment but duration here', duration: 1.2 },          // estimated inside its window
  { text: '', duration: 0 },                                            // empty: no audio, no gap
  { text: 'edited after recording', alignment: mkAlign('OLD TEXT', 0.1), duration: 1.0 }, // stale alignment
  { text: 'last bit', alignment: mkAlign('last bit', 0.1) },            // no duration: use alignment end
];
map = KaraokeController.buildMultiLineWordMap(L2);
const wc = L2.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
ok(map.length === wc, `all ${wc} displayed words timed, got ${map.length}`);
ok(map.every((w, i) => w.wordIdx === i), 'numbering follows displayed text across unaligned/empty lines');
const l2first = map.find(w => w.lineIdx === 1)!;
ok(Math.abs(l2first.startTime - (0.7 + LINE_GAP_SECONDS)) < 1e-9, 'unaligned line starts at its window');
const l2last = [...map].filter(w => w.lineIdx === 1).pop()!;
ok(Math.abs(l2last.endTime - (0.7 + LINE_GAP_SECONDS + 1.2)) < 1e-6, 'unaligned line fills its window exactly: ' + l2last.endTime);
const l3first = map.find(w => w.lineIdx === 3)!;
ok(Math.abs(l3first.startTime - (0.7 + 1.2 + 2 * LINE_GAP_SECONDS)) < 1e-9, 'empty line adds no gap; line after starts correctly: ' + l3first.startTime);
const l4first = map.find(w => w.lineIdx === 4)!;
ok(Math.abs(l4first.startTime - (0.7 + 1.2 + 1.0 + 3 * LINE_GAP_SECONDS)) < 1e-9, 'following line offset: ' + l4first.startTime);
ok(map.every((w, i) => i === 0 || w.startTime >= map[i - 1].startTime - 1e-9), 'monotonic start times');

// ───────── 3. estimate is proportional + fits to real duration ─────────
const est = KaraokeController.estimateWordTimes(['Hi', 'extraordinarily', 'long,', 'ok.'], 0, 4);
ok(est[1].endTime - est[1].startTime > 2 * (est[0].endTime - est[0].startTime), 'long word gets more time than short word');
ok(Math.abs(est[3].endTime - 4) < 0.5 && est[3].endTime <= 4 + 1e-9, 'estimate stays within window');
{
  const words = [{ wordIdx: 0, lineIdx: 0, startTime: 0, endTime: 1 }, { wordIdx: 1, lineIdx: 0, startTime: 1, endTime: 2 }];
  const a = new FakeAudio(); a.duration = 8;
  const c = new KaraokeController('x', words, {}, a as any, { fitToAudioDuration: true });
  ok(Math.abs(words[1].endTime - 8) < 1e-9, 'fitToAudioDuration stretches last word to audio end: ' + words[1].endTime);
  c.destroy();
}

// ───────── 4. clock: highlight lateness, old (raw coarse clock) vs new (interpolated + lead) ─────────
function run(newClock: boolean) {
  const words = Array.from({ length: 40 }, (_, i) => ({ wordIdx: i, lineIdx: 0, startTime: i * 0.4, endTime: i * 0.4 + 0.35 }));
  const a = new FakeAudio(); a.duration = 20; nowMs = 0; rafQ = [];
  const fired: Record<number, number> = {};
  const c = new KaraokeController('x', words.map(w => ({ ...w })), {
    onWordChange: (i) => { if (i >= 0 && fired[i] === undefined) fired[i] = a.realTime(); },
  }, a as any, { leadSeconds: newClock ? 0.04 : 0 });
  if (!newClock) {
    // emulate the OLD behaviour: raw coarse currentTime, no interpolation
    (c as any).clockTime = () => a.currentTime;
  }
  a.play();
  for (let f = 0; f < 60 * 16; f++) { // 16 s at 60 fps
    nowMs += 1000 / 60;
    const q = rafQ; rafQ = []; q.forEach(fn => fn());
  }
  const late = words.slice(0, 38).map(w => (fired[w.wordIdx] - w.startTime) * 1000);
  const avg = late.reduce((x, y) => x + y, 0) / late.length;
  c.destroy();
  return { avg, max: Math.max(...late), min: Math.min(...late) };
}
const oldR = run(false), newR = run(true);
console.log('lateness ms (coarse 250ms media clock)  OLD avg/max:', oldR.avg.toFixed(0), oldR.max.toFixed(0), ' NEW avg/min/max:', newR.avg.toFixed(0), newR.min.toFixed(0), newR.max.toFixed(0));
ok(newR.max < 60, 'new max lateness < 60ms: ' + newR.max);
ok(newR.max < oldR.max / 3, 'new at least 3x tighter than old');
ok(newR.min > -80, 'new never fires wildly early: ' + newR.min);

// ───────── 5. pause / resume / seek don't make the clock run away ─────────
{
  const words = Array.from({ length: 30 }, (_, i) => ({ wordIdx: i, lineIdx: 0, startTime: i * 0.5, endTime: i * 0.5 + 0.45 }));
  const a = new FakeAudio(); nowMs = 0; rafQ = [];
  let cur = -1;
  const c = new KaraokeController('x', words, { onWordChange: (i) => { cur = i; } }, a as any);
  a.play();
  const frames = (n: number) => { for (let f = 0; f < n; f++) { nowMs += 1000 / 60; const q = rafQ; rafQ = []; q.forEach(fn => fn()); } };
  frames(60 * 2);               // 2 s in => around word 4
  const before = cur; a.pause();
  nowMs += 5000; frames(60);    // 5 s wall time while paused: must not advance
  ok(cur === before, `no advance while paused (was ${before}, now ${cur})`);
  a.play(); frames(30);         // resume for 0.5 s
  ok(cur === before + 1 || cur === before, `resume continues from pause point (was ${before}, now ${cur})`);
  c.seekToWord(20); frames(2);
  ok(cur === 20, 'seek jumps to word 20, got ' + cur);
  frames(60);
  ok(cur === 22 || cur === 21 || cur === 23, 'after seek keeps tracking real time, got ' + cur);
  c.destroy();
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`);
