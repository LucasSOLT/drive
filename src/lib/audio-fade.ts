/**
 * Reader autoplay audio helper.
 *
 * Why this exists:
 *  - Browsers (especially iOS Safari) only let an <audio> element start playing outside a tap if
 *    THAT element was already started by a tap once. The reader's auto-play toggle creates one
 *    shared element inside the tap, "unlocks" it, and then reuses it for every page.
 *  - iOS ignores HTMLAudioElement.volume (always 1), so a fade-in there has to go through a
 *    Web Audio GainNode. Everywhere else the plain volume property is used (no Web Audio risk).
 */

// 44-byte silent WAV, used only to unlock the element during the user's tap
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let sharedEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let fadeRaf: number | null = null;

/** Create (once) and unlock the shared element. MUST be called from a user gesture handler. */
export function ensureAutoplayAudio(): HTMLAudioElement {
  if (sharedEl) {
    audioCtx?.resume().catch(() => {});
    return sharedEl;
  }
  const a = new Audio();
  a.crossOrigin = 'anonymous'; // Supabase storage sends Access-Control-Allow-Origin: *
  a.preload = 'auto';

  // Is element.volume actually adjustable here? (iOS: no, it always reads back 1)
  let volumeAdjustable = true;
  try {
    a.volume = 0.5;
    volumeAdjustable = a.volume !== 1;
    a.volume = 1;
  } catch {
    volumeAdjustable = false;
  }

  if (!volumeAdjustable) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const src = audioCtx!.createMediaElementSource(a);
        gainNode = audioCtx!.createGain();
        src.connect(gainNode);
        gainNode.connect(audioCtx!.destination);
        audioCtx!.resume().catch(() => {});
      }
    } catch {
      audioCtx = null;
      gainNode = null;
    }
  }

  // Unlock: start + immediately pause a silent clip while we are inside the tap
  a.src = SILENT_WAV;
  a.play().then(() => { if (a.src === SILENT_WAV) a.pause(); }).catch(() => {});

  sharedEl = a;
  return a;
}

/** The shared element if autoplay is currently armed, otherwise null. */
export function getAutoplayAudio(): HTMLAudioElement | null {
  return sharedEl;
}

function cancelFade(): void {
  if (fadeRaf !== null) {
    cancelAnimationFrame(fadeRaf);
    fadeRaf = null;
  }
  if (gainNode && audioCtx) {
    try { gainNode.gain.cancelScheduledValues(audioCtx.currentTime); } catch { /* ignore */ }
  }
}

/** Set the output to a low level right before starting playback. */
export function prepareFade(from = 0.04): void {
  cancelFade();
  if (gainNode && audioCtx) {
    gainNode.gain.setValueAtTime(from, audioCtx.currentTime);
  } else if (sharedEl) {
    try { sharedEl.volume = from; } catch { /* ignore */ }
  }
}

/** Ramp from the prepared low level up to full volume. */
export function fadeIn(durationMs = 900): void {
  if (gainNode && audioCtx) {
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now);
    gainNode.gain.linearRampToValueAtTime(1, now + durationMs / 1000);
    return;
  }
  const el = sharedEl;
  if (!el) return;
  const startVol = el.volume;
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / durationMs);
    try { el.volume = startVol + (1 - startVol) * p; } catch { /* ignore */ }
    fadeRaf = p < 1 ? requestAnimationFrame(step) : null;
  };
  fadeRaf = requestAnimationFrame(step);
}

/** Back to full volume (used for manual plays so they never start quiet). */
export function resetLevel(): void {
  cancelFade();
  if (gainNode && audioCtx) {
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  } else if (sharedEl) {
    try { sharedEl.volume = 1; } catch { /* ignore */ }
  }
}

/** Play a single URL on the shared element (used by the scroll/waterfall reader). */
export async function playAutoplayUrl(url: string, withFade: boolean): Promise<boolean> {
  const el = sharedEl;
  if (!el) return false;
  stopAutoplayUrl();
  el.src = url;
  if (withFade) prepareFade(); else resetLevel();
  try {
    await audioCtx?.resume();
    await el.play();
    if (withFade) fadeIn();
    return true;
  } catch {
    resetLevel();
    return false;
  }
}

/** Stop whatever the shared element is playing (keeps the element unlocked for reuse). */
export function stopAutoplayUrl(): void {
  if (!sharedEl) return;
  cancelFade();
  sharedEl.pause();
  sharedEl.removeAttribute('src');
  sharedEl.load();
}

/** Disarm autoplay: stop audio and drop the element + audio graph. */
export function releaseAutoplayAudio(): void {
  cancelFade();
  if (sharedEl) {
    sharedEl.pause();
    sharedEl.removeAttribute('src');
    sharedEl.load();
  }
  sharedEl = null;
  gainNode = null;
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}
