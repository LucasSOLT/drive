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
