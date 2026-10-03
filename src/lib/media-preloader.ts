/**
 * Media Preloader — LRU cache of pre-loaded Image & Video elements.
 * Eliminates the 1–3s black screen when readers turn pages.
 */

import { isVideoMedia } from './media.ts';

const MAX_CACHE = 30;
const cache = new Map<string, HTMLImageElement | HTMLVideoElement>();
const order: string[] = []; // LRU order tracking
/** In-flight loads, so the same URL is never fetched twice at the same time */
const inflight = new Map<string, Promise<HTMLImageElement | HTMLVideoElement>>();

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return isVideoMedia(url) || url.toLowerCase().includes('video/');
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

  // Already loading
  const pending = inflight.get(url);
  if (pending) return pending;

  const p: Promise<HTMLImageElement | HTMLVideoElement> = isVideoUrl(url)
    ? new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        video.addEventListener('loadeddata', () => {
          evictIfNeeded();
          cache.set(url, video);
          touchLRU(url);
          resolve(video);
        }, { once: true });
        // Failures are NOT cached, so the reader retries them when the page is opened
        video.addEventListener('error', () => resolve(video), { once: true });
        video.load();
      })
    : new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.addEventListener('load', () => {
          // Decode now so the first paint is instant when the page is shown
          const finish = () => {
            evictIfNeeded();
            cache.set(url, img);
            touchLRU(url);
            resolve(img);
          };
          if (typeof img.decode === 'function') img.decode().then(finish, finish);
          else finish();
        }, { once: true });
        img.addEventListener('error', () => resolve(img), { once: true });
        img.src = url;
      });

  inflight.set(url, p);
  p.finally(() => inflight.delete(url));
  return p;
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

/**
 * Preload the pages around the current one.
 * Order matters (browsers fetch in request order): current → next → previous → next+2.
 * Images are preloaded 2 ahead; videos only 1 ahead / 1 behind (they're heavy).
 */
export function preloadAdjacentPages(
  panels: string[],
  pageVideos: Record<number, string> | undefined,
  currentPage: number
): void {
  const plan: Array<{ idx: number; imagesOnly: boolean }> = [
    { idx: currentPage, imagesOnly: false },
    { idx: currentPage + 1, imagesOnly: false },
    { idx: currentPage - 1, imagesOnly: false },
    { idx: currentPage + 2, imagesOnly: true },
  ];
  for (const { idx, imagesOnly } of plan) {
    if (idx < 0 || idx >= panels.length) continue;
    const media = (pageVideos && pageVideos[idx]) || panels[idx];
    if (!media) continue;
    if (imagesOnly && isVideoUrl(media)) continue;
    preloadMedia(media).catch(() => {});
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
