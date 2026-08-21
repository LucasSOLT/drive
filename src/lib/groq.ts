// ═══════════════════════════════════════════════
// GROQ AI — Text Clean Up Helper
// Uses Groq's fast LLM to clean up messy voice transcriptions
// ═══════════════════════════════════════════════

import { supabase } from './supabase.ts';

const GROQ_MODEL = 'llama-3.1-8b-instant'; // Cheapest & fastest

export async function cleanUpText(rawText: string): Promise<string> {
  if (!rawText.trim()) {
    throw new Error('No text to clean up.');
  }

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      endpoint: '/chat/completions',
      method: 'POST',
      body: {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a helpful text editor. The user will give you raw, messy voice-transcribed text. Your job is to:
1. Fix grammar and punctuation
2. Remove filler words (um, uh, like, you know)
3. Organize the content into clean bullet points or short paragraphs
4. Keep the original meaning and tone
5. Keep it concise — don't add new content

Return ONLY the cleaned up text. No explanations, no preamble.`,
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }
    }
  });

  if (error || data?.error) {
    throw new Error(data?.error?.message || data?.error || error?.message || 'Groq proxy error');
  }

  return data.choices?.[0]?.message?.content?.trim() || rawText;
}
