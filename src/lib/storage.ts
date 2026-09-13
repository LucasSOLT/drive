import { supabase } from './supabase.ts';

export const MEDIA_BUCKET = 'media';

export interface UploadResult {
  url: string;
  isRemote: boolean;
  error?: any;
}

/**
 * Compresses an image file in the browser before upload to minimize storage and bandwidth.
 */
async function compressImageToBlob(file: File, maxWidth = 1440, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    // If not an image or SVG/GIF, return original file as blob
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            quality
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Fallback to local base64 data URL if remote upload fails or bucket is unavailable.
 */
async function fallbackLocalDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a media file (image or video) directly to Supabase Storage 'media' bucket.
 * Automatically compresses images, streams video binaries, and falls back to local data URLs if needed.
 */
export async function uploadMedia(file: File, folder = 'stories'): Promise<UploadResult> {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  const isVideo = file.type.startsWith('video/');
  const ext = file.name ? file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg') : (isVideo ? 'mp4' : 'jpg');
  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;

  try {
    let payload: Blob = file;
    let contentType = file.type;

    if (!isVideo) {
      payload = await compressImageToBlob(file);
      contentType = payload.type || 'image/jpeg';
    }

    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(fileName, payload, {
        cacheControl: '31536000', // 1 year CDN cache
        upsert: true,
        contentType: contentType || (isVideo ? 'video/mp4' : 'image/jpeg'),
      });

    if (!error && data?.path) {
      const { data: pubData } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(data.path);

      if (pubData?.publicUrl) {
        console.log('[Storage] Upload succeeded:', pubData.publicUrl);
        return { url: pubData.publicUrl, isRemote: true };
      }
    }

    if (error) {
      console.warn('[Storage] Remote upload failed, switching to local fallback:', error.message);
    }
  } catch (err: any) {
    console.warn('[Storage] Exception during upload, switching to local fallback:', err?.message || err);
  }

  // Graceful fallback to local dataUrl so user is never blocked
  const localUrl = await fallbackLocalDataUrl(file);
  return { url: localUrl, isRemote: false };
}

/**
 * Uploads synthesized audio (base64 data URL or Blob) to Supabase Storage and returns the public CDN URL.
 * Falls back to the original data URL if upload fails.
 */
export async function uploadAudioData(
  dataOrBlob: Blob | string,
  storyId: string,
  lineId: string
): Promise<string> {
  try {
    let blob: Blob;
    if (typeof dataOrBlob === 'string') {
      // Convert base64 data URL to Blob
      if (dataOrBlob.startsWith('data:')) {
        const [header, b64] = dataOrBlob.split(',');
        const mime = header.match(/data:([^;]+)/)?.[1] || 'audio/mpeg';
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        // Already a URL, return as-is
        return dataOrBlob;
      }
    } else {
      blob = dataOrBlob;
    }

    const fileName = `audio/${storyId}_${lineId}_${Date.now()}.mp3`;
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(fileName, blob, {
        cacheControl: '31536000',
        upsert: true,
        contentType: blob.type || 'audio/mpeg',
      });

    if (!error && data?.path) {
      const { data: pubData } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(data.path);
      if (pubData?.publicUrl) {
        console.log('[Storage] Audio upload succeeded:', pubData.publicUrl);
        return pubData.publicUrl;
      }
    }

    if (error) {
      console.warn('[Storage] Audio upload failed, keeping local URL:', error.message);
    }
  } catch (err: any) {
    console.warn('[Storage] Audio upload exception:', err?.message || err);
  }

  // Return original data if it was a string, otherwise empty
  return typeof dataOrBlob === 'string' ? dataOrBlob : '';
}
