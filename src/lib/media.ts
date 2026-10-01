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

export function ensureVideoPlayback(el?: HTMLVideoElement | HTMLElement | null, muted = true): void {
  if (!el) return;
  if (el instanceof HTMLVideoElement) {
    playSingleVideo(el, muted);
  } else {
    el.querySelectorAll('video').forEach(vid => playSingleVideo(vid as HTMLVideoElement, muted));
  }
}

function playSingleVideo(videoEl: HTMLVideoElement, muted = true): void {
  try {
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');

    if (muted) {
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.setAttribute('muted', '');
    } else {
      videoEl.muted = false;
      videoEl.defaultMuted = false;
      videoEl.removeAttribute('muted');
    }

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (!muted) {
          // Unmuted autoplay blocked by browser policy — fall back to muted, then unmute on user gesture
          videoEl.muted = true;
          videoEl.setAttribute('muted', '');
          videoEl.play().catch(() => {});
          const unmuteOnGesture = () => {
            videoEl.muted = false;
            videoEl.removeAttribute('muted');
            document.removeEventListener('click', unmuteOnGesture);
            document.removeEventListener('touchstart', unmuteOnGesture);
          };
          document.addEventListener('click', unmuteOnGesture, { once: true });
          document.addEventListener('touchstart', unmuteOnGesture, { once: true });
        }
      });
    }
  } catch (err) {
    console.warn('[Media] Video playback initialization error:', err);
  }
}
