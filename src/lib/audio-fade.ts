/**
 * Reader autoplay audio helper.
 *
 * Why this exists:
 *  - Browsers (especially iOS Safari) only let an <audio> element start playing outside a tap if
 *    THAT element was already started by a tap once. The reader's auto-play toggle creates one
 *    shared element inside the tap, "unlocks" it, and then reuses it for every page.
 *
 * Audio always plays at full volume: there is NO fade in / fade out (it sounded clippy), and no
 * Web Audio graph (that only existed to fade on iOS, and it added output latency).
 * (File name kept so existing imports don't move.)
 */

// 44-byte silent WAV, used only to unlock the element during the user's tap
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let sharedEl: HTMLAudioElement | null = null;

/** Create (once) and unlock the shared element. MUST be called from a user gesture handler. */
export function ensureAutoplayAudio(): HTMLAudioElement {
  if (sharedEl) return sharedEl;
  const a = new Audio();
  a.crossOrigin = 'anonymous'; // Supabase storage sends Access-Control-Allow-Origin: *
  a.preload = 'auto';
  try { a.volume = 1; } catch { /* ignore */ }

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

/** Make sure the shared element plays at full volume. */
export function resetLevel(): void {
  if (sharedEl) {
    try { sharedEl.volume = 1; } catch { /* ignore */ }
  }
}

/** Play a single URL on the shared element (used by the scroll/waterfall reader). Full volume, no fade. */
export async function playAutoplayUrl(url: string): Promise<boolean> {
  const el = sharedEl;
  if (!el) return false;
  stopAutoplayUrl();
  el.src = url;
  resetLevel();
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
}

/** Stop whatever the shared element is playing (keeps the element unlocked for reuse). */
export function stopAutoplayUrl(): void {
  if (!sharedEl) return;
  sharedEl.pause();
  sharedEl.removeAttribute('src');
  sharedEl.load();
}

/** Disarm autoplay: stop audio and drop the element. */
export function releaseAutoplayAudio(): void {
  if (sharedEl) {
    sharedEl.pause();
    sharedEl.removeAttribute('src');
    sharedEl.load();
  }
  sharedEl = null;
}
