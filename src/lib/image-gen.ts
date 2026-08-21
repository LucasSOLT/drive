// ─── Simple AI Image Generation via OpenRouter Image API ───
// Uses the /api/v1/images endpoint with fallback models
// Primary: google/gemini-2.5-flash-image (fast, cost-effective)
// Fallback: google/gemini-3-pro-image (higher quality)

import { supabase } from './supabase.ts';

// Ordered by preference: fast & cheap first, then higher quality
const IMAGE_MODELS = [
  'google/gemini-2.5-flash-image',
  'google/gemini-3-pro-image',
  'google/gemini-3.1-flash-image',
];

export interface GenerationResult {
  imageUrl: string; // data:image/png;base64,...
}

/**
 * Generate an image from a user prompt + optional story notes.
 * Tries multiple models in order if the first fails.
 */
export async function generateImage(
  userPrompt: string,
  storyNotes: string = '',
): Promise<GenerationResult> {
  let prompt = userPrompt;
  if (storyNotes) {
    prompt += `\n\nStory context: ${storyNotes}`;
  }

  let lastError = '';

  for (const model of IMAGE_MODELS) {
    console.log(`[DRiVE] Trying image generation with ${model}...`);

    try {
      const { data, error } = await supabase.functions.invoke('openrouter-proxy', {
        body: {
          endpoint: '/images',
          method: 'POST',
          body: {
            model,
            prompt,
            n: 1,
            resolution: '1K',
            aspect_ratio: '4:3',
          }
        }
      });

      if (error) {
        lastError = error.message || 'Edge function error';
        console.warn(`[DRiVE] ${model} edge error:`, lastError);
        continue;
      }

      if (data?.error) {
        // OpenRouter returned an error object
        const errDetail = typeof data.error === 'object'
          ? (data.error.message || JSON.stringify(data.error))
          : data.error;
        lastError = errDetail;
        console.warn(`[DRiVE] ${model} API error:`, errDetail);
        continue;
      }

      // Try to extract the image from the response
      const imageData = data.data?.[0];
      if (imageData?.b64_json) {
        console.log(`[DRiVE] Image generated successfully with ${model}`);
        return { imageUrl: `data:image/png;base64,${imageData.b64_json}` };
      }
      if (imageData?.url) {
        console.log(`[DRiVE] Image generated successfully with ${model}`);
        return { imageUrl: imageData.url };
      }

      // Some models return images in choices[0].message.images
      const msgImages = data.choices?.[0]?.message?.images;
      if (msgImages?.[0]) {
        console.log(`[DRiVE] Image generated successfully with ${model}`);
        return { imageUrl: msgImages[0] };
      }

      lastError = `No image data in response from ${model}`;
      console.warn(`[DRiVE] ${lastError}`, data);
    } catch (e: any) {
      lastError = e.message || 'Unknown error';
      console.warn(`[DRiVE] ${model} threw:`, lastError);
    }
  }

  throw new Error(`Image generation failed with all models. Last error: ${lastError}`);
}
