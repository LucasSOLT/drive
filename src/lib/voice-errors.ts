/** Plain-language messages for ElevenLabs / voice proxy errors (no browser or Supabase imports, so it is unit-testable). */
/** Turn an ElevenLabs error payload into one clear sentence. */
export function friendlyVoiceError(raw: any): string {
  const obj = typeof raw === 'object' && raw ? raw : null;
  const code = String(obj?.code || obj?.status || '');
  const text = typeof raw === 'string' ? raw : (obj?.message || JSON.stringify(raw));
  if (code.includes('quota') || /quota|credits? remaining|exceeds your quota/i.test(text)) {
    return 'The ElevenLabs voice account is out of credits. Top up the ElevenLabs plan (or raise its usage limit), then try again.';
  }
  if (/invalid[_ ]api[_ ]key|unauthorized|401/i.test(text + code)) {
    return 'The ElevenLabs API key was rejected. Check the ELEVENLABS_API_KEY secret in Supabase.';
  }
  if (/voice[_ ]not[_ ]found|voice_id/i.test(text + code)) {
    return 'That voice is not available on the ElevenLabs account. Pick a different voice.';
  }
  return text || 'Voice service error';
}
