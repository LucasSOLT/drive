/**
 * BGM Ducking Controller
 *
 * Routes background music through the Web Audio API GainNode so we can
 * smoothly automate volume changes — ducking the music when voice/narration
 * plays, and restoring it when voice stops.
 *
 * Architecture:
 *   HTMLAudioElement → MediaElementSourceNode → GainNode → AudioContext.destination
 *
 * The GainNode is what gives us sub-frame-accurate volume automation via
 * linearRampToValueAtTime, which HTMLAudioElement.volume cannot do smoothly.
 */

export class BgmDuckingController {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private baseVolume: number;
  private duckRatio: number;
  private rampSeconds: number;
  private isDucked = false;
  private destroyed = false;

  /**
   * @param audioEl     - The BGM HTMLAudioElement (must not already be connected to a MediaElementSource)
   * @param baseVolume  - Normal (un-ducked) volume, 0–1. Default 0.25.
   * @param duckRatio   - How much to reduce volume when ducking, 0–1. Default 0.3 (30% of base = 70% reduction).
   * @param rampSeconds - How long the volume fade takes. Default 0.4s.
   */
  constructor(
    audioEl: HTMLAudioElement,
    baseVolume = 0.25,
    duckRatio = 0.3,
    rampSeconds = 0.4
  ) {
    this.audioEl = audioEl;
    this.baseVolume = Math.max(0, Math.min(1, baseVolume));
    this.duckRatio = Math.max(0, Math.min(1, duckRatio));
    this.rampSeconds = rampSeconds;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        // Fallback: no Web Audio API — just use HTMLAudioElement.volume directly
        audioEl.volume = this.baseVolume;
        return;
      }

      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.baseVolume;

      // Connect: audio element → source → gain → speakers
      this.sourceNode = this.ctx.createMediaElementSource(audioEl);
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      // The audio element's own volume should be 1.0 since gain is controlled
      // entirely by the GainNode now
      audioEl.volume = 1.0;
    } catch (err) {
      console.warn('[BGM Ducking] Failed to initialize Web Audio API, falling back to basic volume:', err);
      audioEl.volume = this.baseVolume;
      this.ctx = null;
      this.gainNode = null;
      this.sourceNode = null;
    }
  }

  /** Smoothly reduce BGM volume — call when voice/narration starts playing. */
  duck(): void {
    if (this.destroyed || this.isDucked) return;
    this.isDucked = true;

    if (this.gainNode && this.ctx) {
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(
        this.baseVolume * this.duckRatio,
        now + this.rampSeconds
      );
    } else if (this.audioEl) {
      // Fallback: instant volume change
      this.audioEl.volume = this.baseVolume * this.duckRatio;
    }
  }

  /** Smoothly restore BGM volume — call when voice/narration stops. */
  unduck(): void {
    if (this.destroyed || !this.isDucked) return;
    this.isDucked = false;

    if (this.gainNode && this.ctx) {
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(
        this.baseVolume,
        now + this.rampSeconds
      );
    } else if (this.audioEl) {
      this.audioEl.volume = this.baseVolume;
    }
  }

  /** Update the base (un-ducked) volume, e.g. from a user volume slider. */
  setBaseVolume(vol: number): void {
    this.baseVolume = Math.max(0, Math.min(1, vol));
    if (this.destroyed) return;

    if (this.gainNode && this.ctx) {
      const target = this.isDucked
        ? this.baseVolume * this.duckRatio
        : this.baseVolume;
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(target, now + 0.1);
    } else if (this.audioEl) {
      this.audioEl.volume = this.isDucked
        ? this.baseVolume * this.duckRatio
        : this.baseVolume;
    }
  }

  /** Mute BGM entirely (e.g. user hits mute button). */
  mute(): void {
    if (this.audioEl) this.audioEl.muted = true;
  }

  /** Unmute BGM. */
  unmute(): void {
    if (this.audioEl) this.audioEl.muted = false;
  }

  /** Whether BGM is currently muted. */
  get isMuted(): boolean {
    return this.audioEl?.muted ?? false;
  }

  /** Whether BGM is currently in ducked state. */
  get ducked(): boolean {
    return this.isDucked;
  }

  /** Clean up Web Audio nodes. Call when leaving the reader. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    try {
      this.sourceNode?.disconnect();
      this.gainNode?.disconnect();
      this.ctx?.close().catch(() => {});
    } catch {}

    this.sourceNode = null;
    this.gainNode = null;
    this.ctx = null;
    this.audioEl = null;
  }
}
