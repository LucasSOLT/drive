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

export class KaraokeController {
  private audio: HTMLAudioElement;
  private words: WordTimestamp[];
  private callbacks: KaraokeCallbacks;
  private currentWordIdx = -1;
  private currentLineIdx = -1;
  private _muted = false;
  private _destroyed = false;
  private animFrameId: number | null = null;

  constructor(
    audioUrl: string,
    words: WordTimestamp[],
    callbacks: KaraokeCallbacks = {}
  ) {
    this.audio = new Audio(audioUrl);
    this.audio.preload = 'auto';
    this.words = words.sort((a, b) => a.startTime - b.startTime);
    this.callbacks = callbacks;

    // Use requestAnimationFrame polling for smoother word tracking than timeupdate
    const tick = () => {
      if (this._destroyed) return;
      if (!this.audio.paused) {
        this.updateHighlight();
      }
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.audio.addEventListener('loadedmetadata', () => {
      this.callbacks.onTimeUpdate?.(0, this.audio.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this._destroyed) {
        this.callbacks.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this._destroyed) {
        this.currentWordIdx = -1;
        this.callbacks.onWordChange?.(-1, -1);
        this.callbacks.onFinish?.();
      }
    });

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
   * Build a combined word map from multiple dialogue lines, each with their
   * own audio and alignment data. Offsets audio times by cumulative duration.
   */
  static buildMultiLineWordMap(
    lines: { text: string; alignment: any; duration: number }[],
  ): WordTimestamp[] {
    const allWords: WordTimestamp[] = [];
    let timeOffset = 0;
    let globalWordIdx = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (!line.alignment) { timeOffset += line.duration; continue; }

      const lineWords = KaraokeController.buildWordMap(line.text, line.alignment, lineIdx);
      for (const w of lineWords) {
        allWords.push({
          wordIdx: globalWordIdx++,
          lineIdx,
          startTime: w.startTime + timeOffset,
          endTime: w.endTime + timeOffset,
        });
      }
      timeOffset += line.duration;
    }

    return allWords;
  }

  private updateHighlight(): void {
    const time = this.audio.currentTime;
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
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.duration));
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
