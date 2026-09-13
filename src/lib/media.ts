/**
 * Media detection and video compatibility helpers for DRiVE.
 * Ensures consistent behavior across iOS Safari, Android Chrome, and Desktop browsers.
 */

/** Check if a given URL or data URI represents video media */
export function isVideoMedia(url?: string | null, vidUrl?: string | null): boolean {
  const target = vidUrl || url;
  if (!target || typeof target !== 'string') return false;
  const trimmed = target.trim();
  if (trimmed.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|ogg|m4v)($|\?|#)/i.test(trimmed);
}

export function ensureVideoPlayback(el?: HTMLVideoElement | HTMLElement | null): void {
  if (!el) return;
  if (el instanceof HTMLVideoElement) {
    playSingleVideo(el);
  } else {
    el.querySelectorAll('video').forEach(vid => playSingleVideo(vid as HTMLVideoElement));
  }
}

function playSingleVideo(videoEl: HTMLVideoElement): void {
  try {
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('muted', '');

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented playback until user interaction or scroll into view
      });
    }
  } catch (err) {
    console.warn('[Media] Video playback initialization error:', err);
  }
}
