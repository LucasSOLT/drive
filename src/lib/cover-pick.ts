/**
 * Which picture represents a series / an episode?  (Pure functions: no DOM, no network, unit-testable.)
 *
 * Rules
 * - EPISODE thumbnail = the episode's first page (first non-empty page). If that page is a video, a still
 *   frame of it is used.
 * - SERIES cover = a cover that was set on purpose (differs from the first page), otherwise the first page
 *   of Episode 1. Videos are shown as a still frame.
 * - A generated still is stored with a "#s=<tag>" suffix: the tag is a hash of the media it was taken from.
 *   If the source later changes, the tag no longer matches and the stored still is ignored (and regenerated
 *   on the next editor save). A stored image WITHOUT a tag was set by hand and is never replaced.
 */
import { isVideoMedia } from './media.ts';

export interface CoverSourceStory {
  panels?: string[];
  coverImage?: string | null;
  coverVideo?: string | null;
  episodeThumbnail?: string | null;
  seriesCoverImage?: string | null;
}

export type CoverDisplay =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'none' };

/** FNV-1a hash (32-bit, hex) of a string. */
export function stillTag(sourceUrl: string): string {
  const s = (sourceUrl || '').split('#')[0];
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Stored-still URL with the tag of its source attached. */
export function withStillTag(stillUrl: string, sourceUrl: string): string {
  return `${stillUrl.split('#')[0]}#s=${stillTag(sourceUrl)}`;
}

/** The tag a stored still was made from, or null if it has none (set by hand). */
export function parseStillTag(stillUrl: string): string | null {
  const m = /#s=([0-9a-f]+)$/i.exec(stillUrl || '');
  return m ? m[1].toLowerCase() : null;
}

/** A stored still is usable when it is an image and still matches its source (or was set by hand). */
export function isStillCurrent(stored: string | null | undefined, sourceUrl: string): boolean {
  if (!stored || isVideoMedia(stored)) return false;
  const tag = parseStillTag(stored);
  return tag === null || tag === stillTag(sourceUrl);
}

/** First non-empty page. */
export function firstPageMedia(panels?: string[] | null): string {
  if (!panels) return '';
  for (const p of panels) if (typeof p === 'string' && p.trim()) return p;
  return '';
}

function toDisplay(url: string): CoverDisplay {
  if (!url) return { kind: 'none' };
  return isVideoMedia(url) ? { kind: 'video', url } : { kind: 'image', url };
}

/** What the EPISODE tile should show. */
export function episodeThumbDisplay(s: CoverSourceStory): CoverDisplay {
  const first = firstPageMedia(s.panels);
  if (first) {
    if (isStillCurrent(s.episodeThumbnail, first)) return { kind: 'image', url: s.episodeThumbnail as string };
    return toDisplay(first);
  }
  // No pages with media: fall back to the story cover
  if (s.coverImage && !isVideoMedia(s.coverImage)) return { kind: 'image', url: s.coverImage };
  if (s.coverVideo) return { kind: 'video', url: s.coverVideo };
  return { kind: 'none' };
}

/** The media the SERIES cover is taken from (before any still is made). */
export function seriesCoverSource(s: CoverSourceStory): string {
  const first = firstPageMedia(s.panels);
  const customImage = s.coverImage && s.coverImage !== first && !isVideoMedia(s.coverImage) ? s.coverImage : '';
  const customVideo = s.coverVideo && s.coverVideo !== first ? s.coverVideo : '';
  // A cover image set on purpose wins; then a cover video set on purpose; else the first page.
  return customImage || customVideo || first || (s.coverImage && !isVideoMedia(s.coverImage) ? s.coverImage : '') || s.coverVideo || '';
}

/** What the SERIES hero / cover should show. */
export function seriesCoverDisplay(s: CoverSourceStory): CoverDisplay {
  const src = seriesCoverSource(s);
  if (!src) return { kind: 'none' };
  if (isStillCurrent(s.seriesCoverImage, src)) return { kind: 'image', url: s.seriesCoverImage as string };
  return toDisplay(src);
}

/** Does this episode need a generated still? (first page is a video and no current still is stored) */
export function episodeNeedsStill(s: CoverSourceStory): string | null {
  const first = firstPageMedia(s.panels);
  if (!first || !isVideoMedia(first)) return null;
  return isStillCurrent(s.episodeThumbnail, first) ? null : first;
}

/** Does the series cover need a generated still? Returns the video to capture from, or null. */
export function seriesCoverNeedsStill(s: CoverSourceStory): string | null {
  const src = seriesCoverSource(s);
  if (!src || !isVideoMedia(src)) return null;
  return isStillCurrent(s.seriesCoverImage, src) ? null : src;
}
