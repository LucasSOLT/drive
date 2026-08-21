import { supabase } from './supabase.ts';

export interface LlamaGenGenerationResult {
  generationId: string;
  status: 'pending' | 'completed' | 'failed';
  images?: string[];
  error?: string;
}

// Map aspect ratio shorthand to the pixel sizes LlamaGen expects
const SIZE_MAP: Record<string, string> = {
  '9:16': '576x1024',
  '1:1': '1024x1024',
  '4:3': '1024x768',
  '3:4': '768x1024',
  '16:9': '1024x576',
  '2:3': '512x768',
  '1:2': '512x1024',
};

/**
 * Trigger webtoon panel generation using LlamaGen API via Edge Function.
 * 
 * API expects: { prompt, preset, size }
 * - prompt: text description of the comic content
 * - preset: visual style identifier (e.g. "animeStyle")
 * - size: resolution string like "576x1024"
 */
export async function generateWebtoonPanel(options: {
  prompt: string;
  characterRefUrls?: string[];
  aspectRatio?: '9:16' | '1:1' | '4:3' | '3:4' | '16:9' | '2:3' | '1:2';
  preset?: string;
}): Promise<string> {
  const { prompt, characterRefUrls = [], aspectRatio = '9:16', preset = 'animeStyle' } = options;

  // Build the full prompt — include character reference URLs inline if provided
  let fullPrompt = prompt;
  if (characterRefUrls.length > 0) {
    fullPrompt += `\n\nCharacter reference images: ${characterRefUrls.join(', ')}`;
  }

  const size = SIZE_MAP[aspectRatio] || '576x1024';

  const { data, error } = await supabase.functions.invoke('llamagen-proxy', {
    body: {
      endpoint: '/v1/comics/generations',
      method: 'POST',
      body: {
        prompt: fullPrompt,
        preset,
        size,
      }
    }
  });

  if (error) {
    console.error('LlamaGen proxy invocation error:', error);
    throw new Error(error.message || 'Failed to reach LlamaGen proxy');
  }

  if (data?.error) {
    console.error('LlamaGen API error:', data.error);
    throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }

  // Check if results are available immediately (sync response)
  const immediateImage = extractImageUrl(data);
  if (immediateImage) return immediateImage;

  // If async with generationId, poll
  const generationId = data.generationId || data.id;
  if (!generationId) {
    console.error('Unexpected LlamaGen response:', data);
    throw new Error('No generation ID or image URL returned from LlamaGen');
  }

  return await pollGenerationResult(generationId);
}

/**
 * Extract the first image URL from a LlamaGen response, checking all known field locations.
 */
function extractImageUrl(data: any): string | null {
  // Direct image fields
  if (data.images?.length > 0) return data.images[0];
  if (data.url) return data.url;
  if (data.imageUrl) return data.imageUrl;
  if (data.image_url) return data.image_url;

  // LlamaGen comic structure: comics[].panels[].imageUrl
  if (data.comics?.length > 0) {
    const firstPage = data.comics[0];
    if (firstPage.panels?.length > 0) {
      return firstPage.panels[0].imageUrl || firstPage.panels[0].image_url;
    }
    // Maybe the comic itself has an imageUrl
    if (firstPage.imageUrl) return firstPage.imageUrl;
  }

  // comicData might be a JSON string
  if (data.comicData) {
    try {
      const parsed = typeof data.comicData === 'string' ? JSON.parse(data.comicData) : data.comicData;
      if (parsed.panels?.length > 0) {
        return parsed.panels[0].imageUrl || parsed.panels[0].image_url;
      }
    } catch { /* ignore parse errors */ }
  }

  return null;
}

/**
 * Poll for completed generation.
 * LlamaGen uses status: "LOADING" → "PROCESSED" (success) or "FAILED"
 */
async function pollGenerationResult(generationId: string, maxAttempts = 40): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const { data, error } = await supabase.functions.invoke('llamagen-proxy', {
      body: {
        endpoint: `/v1/comics/generations/${generationId}`,
        method: 'GET'
      }
    });

    if (error) {
      console.warn(`Poll attempt ${i + 1} error:`, error.message);
      continue;
    }

    const status = (data.status || '').toUpperCase();
    console.log(`LlamaGen generation ${generationId}: status=${status} (attempt ${i + 1}/${maxAttempts})`);

    // Check for completion — LlamaGen uses "PROCESSED" or "COMPLETED"
    if (status === 'PROCESSED' || status === 'COMPLETED' || status === 'DONE') {
      const imageUrl = extractImageUrl(data);
      if (imageUrl) return imageUrl;
      
      // Log the full response so we can debug if structure changes
      console.warn('Generation completed but could not find image URL. Full response:', JSON.stringify(data).substring(0, 1000));
      throw new Error('Generation completed but no image URL found in response.');
    }

    // Check for failure
    if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
      throw new Error(data.error || data.message || `Panel generation ${status.toLowerCase()}`);
    }

    // Any other status (LOADING, PENDING, QUEUED, etc.) — keep polling
  }

  throw new Error('Generation timed out after ~2 minutes. The image may still be processing — try again in a moment.');
}
