/**
 * Make a still picture (JPEG) from the first frame of a video, and upload it.
 * Used by the admin editor on save so a story's episode thumbnail / series cover is a static image
 * even when the first page is a video. Never throws: any failure just means "no still this time"
 * (the app falls back to showing the video's first frame).
 */
import { uploadMedia } from './storage.ts';
import { withStillTag, episodeNeedsStill, seriesCoverNeedsStill, firstPageMedia, type CoverSourceStory } from './cover-pick.ts';

const MAX_WIDTH = 720;
const CAPTURE_TIMEOUT_MS = 9000;
/** Sources that already failed this session, so repeated saves don't retry (and wait) every time. */
const failedSources = new Set<string>();

function once(el: EventTarget, ok: string, bad = 'error'): Promise<boolean> {
  return new Promise(resolve => {
    const done = (v: boolean) => { el.removeEventListener(ok, onOk); el.removeEventListener(bad, onBad); resolve(v); };
    const onOk = () => done(true);
    const onBad = () => done(false);
    el.addEventListener(ok, onOk);
    el.addEventListener(bad, onBad);
  });
}

/** Grab a frame near the start of a video as a JPEG blob. Null if it can't be done (CORS, codec, timeout). */
export async function captureVideoStill(videoUrl: string, timeoutMs = CAPTURE_TIMEOUT_MS): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const video = document.createElement('video');
  try {
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl.split('#')[0];

    const work = (async (): Promise<Blob | null> => {
      if (!(await once(video, 'loadeddata'))) return null;
      const target = Math.min(0.1, (video.duration || 0.2) / 2);
      if (target > 0) {
        video.currentTime = target;
        if (!(await once(video, 'seeked'))) return null;
      }
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return null;
      const scale = Math.min(1, MAX_WIDTH / vw);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob | null>(resolve => {
        try { canvas.toBlob(b => resolve(b), 'image/jpeg', 0.82); } catch { resolve(null); }
      });
    })();
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([work, timeout]);
  } catch (err) {
    console.warn('[Still] Capture failed:', err);
    return null;
  } finally {
    try { video.removeAttribute('src'); video.load(); } catch {}
  }
}

/** Capture + upload. Returns the tagged still URL, or '' if it couldn't be made. */
async function makeStill(videoUrl: string): Promise<string> {
  if (failedSources.has(videoUrl)) return '';
  const blob = await captureVideoStill(videoUrl);
  if (!blob || blob.size < 500) { failedSources.add(videoUrl); return ''; }
  try {
    const res = await uploadMedia(new File([blob], 'still.jpg', { type: 'image/jpeg' }), 'stills');
    // Never store a data: URL in the database; only a real uploaded file counts.
    if (!res.isRemote || !res.url || res.url.startsWith('data:')) { failedSources.add(videoUrl); return ''; }
    return withStillTag(res.url, videoUrl);
  } catch (err) {
    console.warn('[Still] Upload failed:', err);
    failedSources.add(videoUrl);
    return '';
  }
}

export interface AutoStills {
  episodeThumbnail?: string;
  seriesCoverImage?: string;
}

/**
 * Fill in missing stills for a story being saved. Only fills what is missing/out of date
 * (a still that was set by hand is never replaced). `isFirstEpisode` also handles the series cover.
 */
export async function makeMissingStills(s: CoverSourceStory, isFirstEpisode: boolean): Promise<AutoStills> {
  const out: AutoStills = {};
  const epSrc = episodeNeedsStill(s);
  let epStill = '';
  if (epSrc) {
    epStill = await makeStill(epSrc);
    if (epStill) out.episodeThumbnail = epStill;
  }
  if (isFirstEpisode) {
    const coverSrc = seriesCoverNeedsStill(s);
    if (coverSrc) {
      // Same video as the episode's first page? Reuse that still instead of capturing twice.
      const cover = (epStill && coverSrc === firstPageMedia(s.panels)) ? epStill : await makeStill(coverSrc);
      if (cover) out.seriesCoverImage = cover;
    }
  }
  return out;
}
