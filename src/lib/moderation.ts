// ─── Content Moderation via OpenRouter API (with regex fallback) ───

import { supabase } from './supabase.ts';

// Regex fallback: common slurs and offensive patterns
const OFFENSIVE_PATTERNS = [
  // Slurs (abbreviated patterns to catch variations)
  /\bn[i1!][g9]{1,2}[e3a@]?[r]/gi,
  /\bf[a@][g9]{1,2}[o0]?t?s?\b/gi,
  /\br[e3]t[a@]rd/gi,
  /\bk[i1][k]+[e3]/gi,
  /\bch[i1]nk/gi,
  /\bsp[i1]c[ks]?\b/gi,
  /\btr[a@]nn/gi,
  /\bcunt/gi,
  /\bfuck\s*(you|off|ing)/gi,
  /\bshit\s*(head|face|bag)/gi,
  /\bkill\s*(your|my|him|her|them)self/gi,
  /\bdie\s+(bitch|f[a@]g|loser)/gi,
  // Hate speech patterns
  /\b(go\s+)?back\s+to\s+(your|the)\s+(country|jungle)/gi,
  /\bwhite\s*power\b/gi,
  /\bheil\s*hitler\b/gi,
  /\bgas\s*the\s*(jews|blacks)/gi,
  /\b(all|every)\s+(blacks?|jews?|muslims?|gays?)\s+(should|must|need\s+to)\s+(die|burn)/gi,
];

function regexCheck(text: string): boolean {
  return OFFENSIVE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Moderate content using OpenRouter API with regex fallback.
 * Returns { safe: boolean, reason?: string }
 */
export async function moderateContent(text: string): Promise<{ safe: boolean; reason?: string }> {
  // Quick regex pre-check (instant, no API call needed)
  if (regexCheck(text)) {
    return { safe: false, reason: 'Your comment contains offensive material' };
  }

  // Try OpenRouter API moderation via proxy
  try {
    const { data, error } = await supabase.functions.invoke('openrouter-proxy', {
      body: {
        endpoint: '/chat/completions',
        method: 'POST',
        body: {
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            {
              role: 'system',
              content: `You are a content moderation assistant. Analyze the following user comment and determine if it contains any of the following: slurs, hate speech, explicit offensive language, threats of violence, or discriminatory language.

Respond with ONLY a JSON object in this exact format:
{"safe": true} if the comment is acceptable
{"safe": false} if the comment contains offensive material

Do not include any other text in your response.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          max_tokens: 30,
          temperature: 0,
        }
      }
    });

    if (error || data?.error) {
      // API error — fall back to regex-only (already passed above)
      console.warn('OpenRouter proxy error:', data?.error || error?.message);
      return { safe: true };
    }

    const content = data.choices?.[0]?.message?.content?.trim() || '';

    try {
      const result = JSON.parse(content);
      if (result.safe === false) {
        return { safe: false, reason: 'Your comment contains offensive material' };
      }
      return { safe: true };
    } catch {
      // Couldn't parse AI response — fall back to safe
      console.warn('Could not parse moderation response:', content);
      return { safe: true };
    }
  } catch (err) {
    // Network error — fall back to regex-only
    console.warn('Moderation API unreachable:', err);
    return { safe: true };
  }
}
