/**
 * KaraokeController — State machine for synchronized word-by-word audio highlighting.
 *
 * Bridges ElevenLabs character-level alignment timestamps with the reader's
 * cc-word span system. Supports play/pause/resume/seek/restart, mute mode
 * (highlighting continues without sound), and click-to-word seeking.
 *
 * Usage:
 *   const ctrl = new KaraokeController(audioUrl, wordMap, callbacks);
 *   ctrl.play();           // Start or resume
 *   ctrl.pause();          // Pause audio + highlighting
 *   ctrl.seekToWord(12);   // Jump to word 12
 *   ctrl.restart();        // Back to word 0
 *   ctrl.setMuted(true);   // Highlight without sound
 *   ctrl.destroy();        // Cleanup
 */

export interface WordTimestamp {
  /** Index matching data-word-idx in the DOM */
  wordIdx: number;
  /** Index matching data-line-idx (dialogue line) */
  lineIdx: number;
  /** Start time in seconds within the audio */
  startTime: number;
  /** End time in seconds */
  endTime: number;
}

export interface KaraokeCallbacks {
  /** Fired when the active word changes. -1 = no active word. */
  onWordChange?: (wordIdx: number, lineIdx: number) => void;
  /** Fired when the active dialogue line changes. */
  onLineChange?: (lineIdx: number) => void;
  /** Fired when playback reaches the end. */
  onFinish?: () => void;
  /** Fired on each timeupdate — for scrubber UI. */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export interface KaraokeOptions {
  /**
   * The word times are only a rough estimate (no alignment data). Once the real audio length is
   * known, stretch/shrink every word time so the last word ends exactly when the audio ends.
   */
  fitToAudioDuration?: boolean;
  /**
   * Seconds to light each word EARLY, to cancel the delay between "the clock says this word started"
   * and "the highlight is actually painted on screen" (one animation frame + paint). Default 0.04.
   */
  leadSeconds?: number;
}

/**
 * The silence (seconds) inserted between dialogue lines when a page's lines are joined into one
 * audio file. MUST match the `pauseMs` used by `preRecordPageAudio` in tts.ts (150 ms) — if the
 * two drift apart, every line after the first is highlighted early by (difference x line number).
 */
export const LINE_GAP_SECONDS = 0.15;

/** How far (seconds) the clock may be advanced past the last real audio-clock reading. */
const MAX_INTERPOLATION_S = 0.3;
/** Default highlight lead (seconds) — see KaraokeOptions.leadSeconds. */
const DEFAULT_LEAD_S = 0.04;

export class KaraokeController {
  private audio: HTMLAudioElement;
  private words: WordTimestamp[];
  private callbacks: KaraokeCallbacks;
  private currentWordIdx = -1;
  private currentLineIdx = -1;
  private _muted = false;
  private _destroyed = false;
  private animFrameId: number | null = null;
  private opts: KaraokeOptions;

  // ─── Smooth clock ───
  // `audio.currentTime` only advances in coarse steps on some browsers (up to ~250 ms on Safari/Firefox
  // and with Bluetooth output), so reading it raw makes the highlight trail the voice by up to a whole
  // step. We remember when the media clock last changed and add the real elapsed time since then.
  private anchorMedia = -1;
  private anchorPerf = 0;
  private lastClock = 0;

  private onLoadedMetadata = () => {
    if (this._destroyed) return;
    this.fitEstimateToDuration();
    this.callbacks.onTimeUpdate?.(0, this.audio.duration);
  };
  private onTimeUpdateEv = () => {
    if (!this._destroyed) {
      this.callbacks.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
    }
  };
  private onEnded = () => {
    if (!this._destroyed) {
      this.currentWordIdx = -1;
      this.callbacks.onWordChange?.(-1, -1);
      this.callbacks.onFinish?.();
    }
  };
  /** Anything that breaks the "clock keeps ticking" assumption: forget the anchor. */
  private resetClock = () => { this.anchorMedia = -1; };

  /**
   * @param sharedAudio Optional pre-unlocked element to reuse (reader auto-play, needed for iOS).
   *                    When omitted a fresh Audio element is created.
   */
  constructor(
    audioUrl: string,
    words: WordTimestamp[],
    callbacks: KaraokeCallbacks = {},
    sharedAudio?: HTMLAudioElement | null,
    options: KaraokeOptions = {}
  ) {
    if (sharedAudio) {
      this.audio = sharedAudio;
      this.audio.src = audioUrl;
    } else {
      this.audio = new Audio(audioUrl);
    }
    this.audio.preload = 'auto';
    this.words = words.sort((a, b) => a.startTime - b.startTime);
    this.callbacks = callbacks;
    this.opts = options;

    // Use requestAnimationFrame polling for smoother word tracking than timeupdate
    const tick = () => {
      if (this._destroyed) return;
      if (!this.audio.paused) {
        this.updateHighlight();
      }
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.audio.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.addEventListener('durationchange', this.onLoadedMetadata);
    this.audio.addEventListener('timeupdate', this.onTimeUpdateEv);
    this.audio.addEventListener('ended', this.onEnded);
    for (const ev of ['seeking', 'seeked', 'pause', 'playing', 'waiting', 'stalled']) {
      this.audio.addEventListener(ev, this.resetClock);
    }

    // The element may already know its length (re-used shared element, cached file)
    this.fitEstimateToDuration();

    // Start the animation frame loop
    this.animFrameId = requestAnimationFrame(tick);
  }

  /** Map character-level ElevenLabs alignment to word-level timestamps. */
  static buildWordMap(
    fullText: string,
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    },
    lineIdx: number = 0
  ): WordTimestamp[] {
    const words: WordTimestamp[] = [];
    // Split text into words, tracking their character offsets
    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null;
    let wordI = 0;

    while ((match = wordRegex.exec(fullText)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length - 1;

      // Find earliest start time and latest end time across the word's characters
      let startTime = Infinity;
      let endTime = -Infinity;

      for (let ci = wordStart; ci <= wordEnd && ci < alignment.characters.length; ci++) {
        const s = alignment.character_start_times_seconds[ci];
        const e = alignment.character_end_times_seconds[ci];
        if (s !== undefined && s < startTime) startTime = s;
        if (e !== undefined && e > endTime) endTime = e;
      }

      if (startTime !== Infinity && endTime !== -Infinity) {
        words.push({ wordIdx: wordI, lineIdx, startTime, endTime });
      }
      wordI++;
    }

    return words;
  }

  /**
   * Spread `words` over the window [start, end] in proportion to how long each takes to say
   * (letters, plus a short pause after commas / sentence ends). Used whenever no real alignment
   * exists. Far closer to real speech than a flat "0.35 s per word".
   */
  static estimateWordTimes(
    words: string[],
    start: number,
    end: number
  ): { startTime: number; endTime: number }[] {
    if (words.length === 0) return [];
    const span = Math.max(0, end - start);
    const weights = words.map(w => {
      const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length || 1;
      let pause = 0;
      if (/[.!?…]["'”’)]*$/.test(w)) pause = 4;
      else if (/[,;:—–-]["'”’)]*$/.test(w)) pause = 2;
      return { speak: letters + 1, pause };
    });
    const total = weights.reduce((n, w) => n + w.speak + w.pause, 0) || 1;
    const out: { startTime: number; endTime: number }[] = [];
    let cursor = start;
    for (const w of weights) {
      const speakLen = (w.speak / total) * span;
      out.push({ startTime: cursor, endTime: cursor + speakLen });
      cursor += speakLen + (w.pause / total) * span;
    }
    return out;
  }

  /**
   * Build a combined word map from multiple dialogue lines, each with their
   * own audio and alignment data. Offsets audio times by cumulative duration
   * PLUS the silence that was inserted between the lines when they were joined.
   *
   * - Word numbers (wordIdx) always follow the DISPLAYED text of every line, so a line without
   *   alignment can never shift the numbering of later lines.
   * - A line whose alignment no longer matches its text (text edited after recording) is spread
   *   over its audio window by estimate instead of being highlighted with stale times.
   */
  static buildMultiLineWordMap(
    lines: { text: string; alignment?: any; duration?: number }[],
    gapSeconds: number = LINE_GAP_SECONDS,
  ): WordTimestamp[] {
    const allWords: WordTimestamp[] = [];
    let timeOffset = 0;
    let wordBase = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const text = line.text || '';
      const lineWordTexts = text.split(/\s+/).filter(Boolean);
      const hasSegment = text.trim().length > 0; // empty lines are never recorded: no audio, no gap

      const al = line.alignment;
      const alOk = !!al
        && Array.isArray(al.characters)
        && al.characters.join('') === text
        && Array.isArray(al.character_start_times_seconds)
        && Array.isArray(al.character_end_times_seconds);

      // Real length of this line's audio; fall back to where the alignment ends
      let duration = line.duration && line.duration > 0 ? line.duration : 0;
      if (!duration && alOk) {
        const ends = al.character_end_times_seconds as number[];
        duration = ends.length ? Math.max(...ends.filter(n => typeof n === 'number')) : 0;
        if (!isFinite(duration)) duration = 0;
      }

      let timed: { startTime: number; endTime: number }[] | null = null;
      if (alOk) {
        const byIdx = new Map<number, WordTimestamp>();
        for (const w of KaraokeController.buildWordMap(text, al, lineIdx)) byIdx.set(w.wordIdx, w);
        timed = [];
        for (let i = 0; i < lineWordTexts.length; i++) {
          const w = byIdx.get(i);
          if (w) {
            timed.push({ startTime: w.startTime, endTime: w.endTime });
          } else {
            // A word with no timing: sit it between its neighbours so numbering never slips
            const prevEnd = timed.length ? timed[timed.length - 1].endTime : 0;
            timed.push({ startTime: prevEnd, endTime: prevEnd });
          }
        }
      } else if (duration > 0 && lineWordTexts.length > 0) {
        timed = KaraokeController.estimateWordTimes(lineWordTexts, 0, duration);
      }

      if (timed) {
        for (let i = 0; i < timed.length; i++) {
          allWords.push({
            wordIdx: wordBase + i,
            lineIdx,
            startTime: timed[i].startTime + timeOffset,
            endTime: timed[i].endTime + timeOffset,
          });
        }
      }

      wordBase += lineWordTexts.length;
      if (hasSegment) timeOffset += duration + gapSeconds;
    }

    return allWords;
  }

  /** Stretch estimated word times so they exactly span the real audio length. */
  private fitEstimateToDuration(): void {
    if (!this.opts.fitToAudioDuration || this.words.length === 0) return;
    const dur = this.audio.duration;
    if (!dur || !isFinite(dur)) return;
    const lastEnd = this.words[this.words.length - 1].endTime;
    if (lastEnd <= 0) return;
    const k = dur / lastEnd;
    if (Math.abs(k - 1) < 0.001) return;
    for (const w of this.words) {
      w.startTime *= k;
      w.endTime *= k;
    }
  }

  /** Playback position in seconds, smoothed between the audio element's coarse clock updates. */
  private clockTime(): number {
    const a = this.audio;
    const cur = a.currentTime;
    // Not actually advancing (paused / seeking / buffering): trust the element, don't extrapolate
    if (a.paused || a.seeking || (a.readyState !== undefined && a.readyState < 3)) {
      this.anchorMedia = -1;
      this.lastClock = cur;
      return cur;
    }
    const now = performance.now();
    if (this.anchorMedia < 0 || cur !== this.anchorMedia) {
      // The media clock just ticked (or this is the first sample): re-anchor on it
      this.anchorMedia = cur;
      this.anchorPerf = now;
      // Tiny backwards jitter (our estimate ran slightly ahead) must not flicker the highlight back
      const t = cur < this.lastClock && this.lastClock - cur < 0.15 ? this.lastClock : cur;
      this.lastClock = t;
      return t;
    }
    const rate = a.playbackRate || 1;
    let t = cur + Math.min(((now - this.anchorPerf) / 1000) * rate, MAX_INTERPOLATION_S);
    const dur = a.duration;
    if (dur && isFinite(dur) && t > dur) t = dur;
    if (t < this.lastClock && this.lastClock - t < 0.15) t = this.lastClock;
    this.lastClock = t;
    return t;
  }

  private updateHighlight(): void {
    const time = this.clockTime() + (this.opts.leadSeconds ?? DEFAULT_LEAD_S);
    let newWordIdx = -1;
    let newLineIdx = -1;

    // Binary-ish search — words are sorted by startTime
    for (let i = 0; i < this.words.length; i++) {
      const w = this.words[i];
      if (time >= w.startTime && time <= w.endTime) {
        newWordIdx = w.wordIdx;
        newLineIdx = w.lineIdx;
        break;
      }
      // If we've passed this word but haven't reached the next, keep it lit
      if (time > w.endTime) {
        const next = this.words[i + 1];
        if (!next || time < next.startTime) {
          newWordIdx = w.wordIdx;
          newLineIdx = w.lineIdx;
        }
      }
    }

    if (newWordIdx !== this.currentWordIdx) {
      this.currentWordIdx = newWordIdx;
      this.callbacks.onWordChange?.(newWordIdx, newLineIdx);
    }
    if (newLineIdx !== this.currentLineIdx) {
      this.currentLineIdx = newLineIdx;
      this.callbacks.onLineChange?.(newLineIdx);
    }
  }

  play(): void {
    if (this._destroyed) return;
    this.audio.muted = this._muted;
    this.audio.play().catch(() => {});
  }

  /** Like play(), but resolves false if the browser blocked playback (autoplay policy). */
  async tryPlay(): Promise<boolean> {
    if (this._destroyed) return false;
    this.audio.muted = this._muted;
    try {
      await this.audio.play();
      return !this._destroyed;
    } catch {
      return false;
    }
  }

  pause(): void {
    if (this._destroyed) return;
    this.audio.pause();
    // Word stays highlighted at pause point
  }

  resume(): void {
    this.play();
  }

  get paused(): boolean {
    return this.audio.paused;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get duration(): number {
    return this.audio.duration || 0;
  }

  restart(): void {
    if (this._destroyed) return;
    this.audio.currentTime = 0;
    this.resetClock();
    this.lastClock = 0;
    this.currentWordIdx = -1;
    this.currentLineIdx = -1;
    this.callbacks.onWordChange?.(-1, -1);
    this.play();
  }

  /** Seek to a specific word. Audio jumps to that word's start time. */
  seekToWord(wordIdx: number): void {
    if (this._destroyed) return;
    const word = this.words.find(w => w.wordIdx === wordIdx);
    if (word) {
      this.audio.currentTime = word.startTime;
      this.resetClock();
      this.lastClock = word.startTime;
      this.currentWordIdx = word.wordIdx;
      this.currentLineIdx = word.lineIdx;
      this.callbacks.onWordChange?.(word.wordIdx, word.lineIdx);
      this.callbacks.onLineChange?.(word.lineIdx);
      // Auto-play from the seek point
      this.play();
    }
  }

  /** Seek to a specific time in seconds. */
  seekToTime(seconds: number): void {
    if (this._destroyed) return;
    const target = Math.max(0, Math.min(seconds, this.duration));
    this.audio.currentTime = target;
    this.resetClock();
    this.lastClock = target;
    this.updateHighlight();
  }

  /** Toggle mute: highlighting continues, audio is silent. */
  setMuted(muted: boolean): void {
    this._muted = muted;
    this.audio.muted = muted;
  }

  get muted(): boolean {
    return this._muted;
  }

  destroy(): void {
    this._destroyed = true;
    this.audio.removeEventListener('loadedmetadata', this.onLoadedMetadata);
    this.audio.removeEventListener('durationchange', this.onLoadedMetadata);
    this.audio.removeEventListener('timeupdate', this.onTimeUpdateEv);
    this.audio.removeEventListener('ended', this.onEnded);
    for (const ev of ['seeking', 'seeked', 'pause', 'playing', 'waiting', 'stalled']) {
      this.audio.removeEventListener(ev, this.resetClock);
    }
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // Release resources
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.currentWordIdx = -1;
    this.currentLineIdx = -1;
  }
}
