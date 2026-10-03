/**
 * Media Preloader — LRU cache of pre-loaded Image & Video elements.
 * Eliminates the 1–3s black screen when readers turn pages.
 */

const MAX_CACHE = 30;
const cache = new Map<string, HTMLImageElement | HTMLVideoElement>();
const order: string[] = []; // LRU order tracking

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov') || lower.includes('video/');
}

function evictIfNeeded(): void {
  while (order.length > MAX_CACHE) {
    const oldest = order.shift();
    if (oldest) {
      const el = cache.get(oldest);
      if (el && el instanceof HTMLVideoElement) {
        el.src = ''; // Free video memory
        el.load();
      }
      cache.delete(oldest);
    }
  }
}

function touchLRU(url: string): void {
  const idx = order.indexOf(url);
  if (idx > -1) order.splice(idx, 1);
  order.push(url);
}

/** Preload a single media URL. Returns the cached element. */
export function preloadMedia(url: string): Promise<HTMLImageElement | HTMLVideoElement> {
  if (!url) return Promise.reject(new Error('No URL'));

  // Already cached
  const existing = cache.get(url);
  if (existing) {
    touchLRU(url);
    return Promise.resolve(existing);
  }

  evictIfNeeded();

  if (isVideoUrl(url)) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      const onReady = () => {
        cache.set(url, video);
        touchLRU(url);
        resolve(video);
      };
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('error', () => {
        // Still cache video element so we don't retry endlessly
        cache.set(url, video);
        touchLRU(url);
        resolve(video);
      }, { once: true });
      video.load();
    });
  } else {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      const onReady = () => {
        cache.set(url, img);
        touchLRU(url);
        resolve(img);
      };
      img.addEventListener('load', onReady, { once: true });
      img.addEventListener('error', () => {
        cache.set(url, img);
        touchLRU(url);
        resolve(img);
      }, { once: true });
    });
  }
}

/** Check if a URL is already preloaded */
export function isPreloaded(url: string): boolean {
  return cache.has(url);
}

/** Get a preloaded element (or null if not cached) */
export function getPreloadedElement(url: string): HTMLImageElement | HTMLVideoElement | null {
  const el = cache.get(url);
  if (el) touchLRU(url);
  return el || null;
}

/** Preload adjacent pages (current ± 1) for a story */
export function preloadAdjacentPages(
  panels: string[],
  pageVideos: Record<number, string> | undefined,
  currentPage: number
): void {
  const pages = [currentPage - 1, currentPage + 1];
  for (const idx of pages) {
    if (idx < 0 || idx >= panels.length) continue;
    const media = (pageVideos && pageVideos[idx]) || panels[idx];
    if (media) preloadMedia(media).catch(() => {});
  }
}

/** Preload first page of each episode (called from Series Info screen) */
export function preloadEpisodeFirstPages(
  episodes: Array<{ panels?: string[]; pageVideos?: Record<number, string> }>
): void {
  for (const ep of episodes) {
    const firstMedia = (ep.pageVideos && ep.pageVideos[0]) || ep.panels?.[0];
    if (firstMedia) preloadMedia(firstMedia).catch(() => {});
  }
}

/** Clear the entire preload cache */
export function clearPreloadCache(): void {
  for (const [, el] of cache) {
    if (el instanceof HTMLVideoElement) {
      el.src = '';
      el.load();
    }
  }
  cache.clear();
  order.length = 0;
}
