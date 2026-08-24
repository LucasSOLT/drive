/**
 * Text-to-Speech module using ElevenLabs API.
 * Voice selection is pulled from app settings.
 */

import { getSelectedVoiceId } from './settings.ts';
import { supabase } from './supabase.ts';

let currentAudio: HTMLAudioElement | null = null;
let currentObjectURL: string | null = null;

/** Stop any currently playing TTS audio and clean up resources. */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio = null;
  }
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }
}

/** Returns whether TTS audio is currently playing. */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/** Speak the given text via ElevenLabs API using the user's selected voice. */
export async function speakText(text: string): Promise<void> {
  stopSpeaking();

  const voiceId = getSelectedVoiceId();

  try {
    const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
      body: {
        endpoint: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        body: {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }
      }
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || 'TTS failed');
    }

    // The proxy returns { audio_base64, content_type }
    const binaryStr = atob(data.audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.content_type || 'audio/mpeg' });

    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    currentAudio = audio;
    currentObjectURL = url;

    audio.addEventListener('ended', () => {
      if (currentAudio === audio) {
        stopSpeaking();
      }
    });

    audio.addEventListener('error', () => {
      console.warn('[TTS] Audio playback error.');
      if (currentAudio === audio) {
        stopSpeaking();
      }
    });

    await audio.play();
  } catch (err) {
    console.warn('[TTS] Failed to speak text:', err);
    stopSpeaking();
  }
}

/**
 * Pre-record audio for the given text using ElevenLabs.
 * Returns a base64 data URL (audio/mpeg) that can be stored and played later.
 * Uses the user's selected voice and the given stability setting.
 */
export async function preRecordAudio(text: string, stability = 0.5): Promise<string> {
  const voiceId = getSelectedVoiceId();

  console.log('[TTS Pre-record] Calling ElevenLabs proxy with voice:', voiceId, 'stability:', stability, 'text length:', text.length);

  const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
    body: {
      endpoint: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      body: {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: Number(stability), similarity_boost: 0.75 },
      }
    }
  });

  if (error) {
    console.error('[TTS Pre-record] Edge function error:', error);
    // Try to extract a meaningful message
    const msg = typeof error === 'object' && error.message ? error.message : String(error);
    throw new Error(msg || 'TTS pre-recording failed');
  }

  if (data?.error) {
    console.error('[TTS Pre-record] API error:', data.error);
    throw new Error(data.error);
  }

  if (!data?.audio_base64) {
    console.error('[TTS Pre-record] No audio data in response:', data);
    throw new Error('No audio data returned from ElevenLabs.');
  }

  const contentType = data.content_type || 'audio/mpeg';
  return `data:${contentType};base64,${data.audio_base64}`;
}

/** Play a pre-recorded audio URL (base64 data URL or blob URL). */
export function playAudioUrl(url: string): void {
  stopSpeaking();
  const audio = new Audio(url);
  currentAudio = audio;
  // No object URL to revoke for base64 data URLs
  currentObjectURL = null;

  audio.addEventListener('ended', () => {
    if (currentAudio === audio) {
      stopSpeaking();
    }
  });

  audio.addEventListener('error', () => {
    console.warn('[TTS] Pre-recorded audio playback error.');
    if (currentAudio === audio) {
      stopSpeaking();
    }
  });

  audio.play().catch(err => {
    console.warn('[TTS] Failed to play pre-recorded audio:', err);
    stopSpeaking();
  });
}
