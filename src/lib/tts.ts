/**
 * Text-to-Speech module using ElevenLabs API.
 * Voice selection is pulled from app settings.
 */

import { getSelectedVoiceId } from './settings.ts';
import { supabase } from './supabase.ts';

/** Split dialogue text into sentences with their terminal punctuation for mood-aware TTS. */
export function splitDialogueIntoSentences(text: string): { text: string; punctuation: string }[] {
  // Match sentences ending with punctuation groups like .!?… or end-of-string
  const regex = /([^.!?…]+[.!?…]+|[^.!?…]+$)/g;
  const matches = text.match(regex);
  if (!matches || matches.length === 0) return [{ text: text.trim(), punctuation: '.' }];
  return matches
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => {
      const lastChar = s.slice(-1);
      const punctuation = ['!', '?', '…'].includes(lastChar) ? lastChar
        : s.endsWith('...') ? '…'
        : '.';
      return { text: s, punctuation };
    });
}

/** Get ElevenLabs voice_settings tailored to the sentence's terminal punctuation. */
export function getPunctuationVoiceSettings(punctuation: string): { stability: number; similarity_boost: number; style: number } {
  switch (punctuation) {
    case '!':
      return { stability: 0.32, similarity_boost: 0.70, style: 0.25 };
    case '?':
      return { stability: 0.45, similarity_boost: 0.75, style: 0.08 };
    case '…':
      return { stability: 0.55, similarity_boost: 0.75, style: 0.05 };
    case '.':
    default:
      return { stability: 0.65, similarity_boost: 0.75, style: 0.0 };
  }
}

let currentAlignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
} | null = null;

export function getCurrentAlignment() { return currentAlignment; }

let onWordHighlight: ((charIndex: number) => void) | null = null;
export function setWordHighlightCallback(cb: ((charIndex: number) => void) | null) {
  onWordHighlight = cb;
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectURL: string | null = null;

function speakWithBrowserTTS(text: string): void {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        onWordHighlight?.(event.charIndex);
      }
    };
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('[TTS] Web Speech API failed:', e);
  }
}

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
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  currentAlignment = null;
}

/** Returns whether TTS audio is currently playing. */
export function isSpeaking(): boolean {
  const isAudioSpeaking = currentAudio !== null && !currentAudio.paused;
  const isSynthSpeaking = 'speechSynthesis' in window && window.speechSynthesis.speaking;
  return isAudioSpeaking || isSynthSpeaking;
}

/** Speak the given text via ElevenLabs API using the user's selected voice. */
export async function speakText(text: string): Promise<void> {
  stopSpeaking();
  if (!text || !text.trim()) return;

  const voiceId = getSelectedVoiceId();

  try {
    const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
      body: {
        endpoint: `/v1/text-to-speech/${voiceId}/with-timestamps`,
        method: 'POST',
        body: {
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }
      }
    });

    if (error || data?.error || !data?.audio_base64) {
      const errMsg = data?.error || data?.detail?.message || error?.message || 'TTS failed';
      console.warn('[TTS] ElevenLabs failed (' + errMsg + '), falling back to browser Web Speech API...');
      speakWithBrowserTTS(text);
      return;
    }

    currentAlignment = data.alignment || null;

    // The proxy returns { audio_base64, content_type }
    const binaryStr = atob(data.audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.content_type || 'audio/mpeg' });

    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    currentAudio = audio;
    currentObjectURL = url;

    audio.addEventListener('timeupdate', () => {
      if (currentAudio === audio && currentAlignment) {
        const time = audio.currentTime;
        const starts = currentAlignment.character_start_times_seconds;
        const ends = currentAlignment.character_end_times_seconds;
        let activeCharIndex = -1;
        for (let i = 0; i < starts.length; i++) {
          if (time >= starts[i] && time <= ends[i]) {
            activeCharIndex = i;
            break;
          }
        }
        if (activeCharIndex >= 0) {
          onWordHighlight?.(activeCharIndex);
        }
      }
    });

    audio.addEventListener('ended', () => {
      if (currentAudio === audio) {
        stopSpeaking();
      }
    });

    audio.addEventListener('error', () => {
      console.warn('[TTS] Audio playback error, falling back to browser TTS');
      if (currentAudio === audio) {
        stopSpeaking();
      }
      speakWithBrowserTTS(text);
    });

    await audio.play();
  } catch (err) {
    console.warn('[TTS] Failed to speak text via ElevenLabs, falling back to browser TTS:', err);
    speakWithBrowserTTS(text);
  }
}

/**
 * Pre-record audio for the given text using ElevenLabs.
 * Returns a base64 data URL (audio/mpeg or audio/wav) that can be stored and played later.
 * Supports sentence-level punctuation-aware pacing: sentences ending with ! are energetic,
 * ? are inquisitive, . are calm/steady.
 */
export async function preRecordAudio(text: string, stability = 0.5, customVoiceId?: string): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error('No text provided to record.');
  }

  const voiceId = customVoiceId || getSelectedVoiceId();
  const sentences = splitDialogueIntoSentences(text);

  // Check if all sentences share the same punctuation mood
  const moods = new Set(sentences.map(s => s.punctuation));
  const isUniformMood = moods.size <= 1;

  if (isUniformMood) {
    // Single mood — synthesize in one call with that mood's settings
    const settings = getPunctuationVoiceSettings(sentences[0].punctuation);
    console.log('[TTS Pre-record] Single mood synthesis, voice:', voiceId, 'punctuation:', sentences[0].punctuation, 'settings:', settings);
    return await synthesizeSingleSegment(text, voiceId, settings);
  }

  // Multiple moods — synthesize each sentence individually and concatenate
  console.log('[TTS Pre-record] Multi-mood synthesis:', sentences.length, 'sentences, voice:', voiceId);
  const segmentDataUrls: string[] = [];
  for (const sentence of sentences) {
    const settings = getPunctuationVoiceSettings(sentence.punctuation);
    console.log('[TTS Pre-record]   Sentence:', sentence.text.substring(0, 40), '| mood:', sentence.punctuation, '| settings:', settings);
    const dataUrl = await synthesizeSingleSegment(sentence.text, voiceId, settings);
    segmentDataUrls.push(dataUrl);
  }

  return await concatenateAudioSegments(segmentDataUrls);
}

/** Internal: synthesize a single text segment with specific voice settings. */
async function synthesizeSingleSegment(
  text: string,
  voiceId: string,
  settings: { stability: number; similarity_boost: number; style: number }
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
    body: {
      endpoint: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      body: {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style,
          use_speaker_boost: true,
        },
      }
    }
  });

  if (error) {
    console.error('[TTS] Segment synthesis error:', error);
    let msg = error.message;
    try {
      if ('context' in error && (error as any).context) {
        const body = await (error as any).context.json();
        msg = body?.error || body?.detail?.message || body?.detail || JSON.stringify(body);
      }
    } catch {}
    throw new Error(msg || 'TTS synthesis failed');
  }

  if (data?.error) {
    const msg = typeof data.error === 'string' ? data.error : (data.error.message || data.error.detail?.message || JSON.stringify(data.error));
    throw new Error(msg);
  }

  if (data?.detail) {
    const msg = typeof data.detail === 'string' ? data.detail : (data.detail.message || JSON.stringify(data.detail));
    throw new Error(msg);
  }

  if (!data?.audio_base64) {
    throw new Error('No audio data returned from ElevenLabs.');
  }

  const contentType = data.content_type || 'audio/mpeg';
  return `data:${contentType};base64,${data.audio_base64}`;
}

/**
 * Concatenate multiple base64 audio data URLs into a single audio Blob.
 * Inserts a brief silence between segments for natural inter-sentence pacing.
 * Falls back to returning the first audio if AudioContext is unavailable.
 */
async function concatenateAudioSegments(dataUrls: string[], pauseMs = 120): Promise<string> {
  if (dataUrls.length === 0) throw new Error('No audio segments to concatenate');
  if (dataUrls.length === 1) return dataUrls[0];

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return dataUrls[0];
    const ctx = new AudioCtx();

    // Decode all segments
    const buffers: AudioBuffer[] = [];
    for (const dataUrl of dataUrls) {
      const b64 = dataUrl.split(',')[1];
      const binaryStr = atob(b64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
      buffers.push(decoded);
    }

    // Calculate total length with pauses
    const sampleRate = buffers[0].sampleRate;
    const pauseSamples = Math.floor((pauseMs / 1000) * sampleRate);
    let totalSamples = 0;
    for (let i = 0; i < buffers.length; i++) {
      totalSamples += buffers[i].length;
      if (i < buffers.length - 1) totalSamples += pauseSamples;
    }

    const channels = buffers[0].numberOfChannels;
    const combined = ctx.createBuffer(channels, totalSamples, sampleRate);

    for (let ch = 0; ch < channels; ch++) {
      const output = combined.getChannelData(ch);
      let offset = 0;
      for (let i = 0; i < buffers.length; i++) {
        const chData = buffers[i].numberOfChannels > ch
          ? buffers[i].getChannelData(ch)
          : buffers[i].getChannelData(0);
        output.set(chData, offset);
        offset += buffers[i].length;
        if (i < buffers.length - 1) {
          // Silence gap already zero-initialized
          offset += pauseSamples;
        }
      }
    }

    // Encode to WAV
    const wavBlob = audioBufferToWav(combined);
    const reader = new FileReader();
    return new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(wavBlob);
    });
  } catch (err) {
    console.warn('[TTS] Audio concatenation failed, returning first segment:', err);
    return dataUrls[0];
  }
}

/** Encode an AudioBuffer to a WAV Blob. */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave and write samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Extract audio track from an uploaded media file (audio or video).
 * If the file is a video (MP4, MOV, WebM, etc.), it decodes the audio track using
 * AudioContext and encodes it as a clean WAV Blob, completely stripping the video.
 */
export async function extractAudioFromMediaFile(file: File): Promise<{ blob: Blob; fileName: string; isVideo: boolean }> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
  if (!isVideo) {
    return { blob: file, fileName: file.name, isVideo: false };
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return { blob: file, fileName: file.name, isVideo: true };
    }

    const ctx = new AudioCtx();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWav(audioBuffer);

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const cleanFileName = `${baseName}.wav`;

    return { blob: wavBlob, fileName: cleanFileName, isVideo: true };
  } catch (err) {
    console.warn('[TTS] Failed to extract audio track from video, falling back to original:', err);
    return { blob: file, fileName: file.name, isVideo: true };
  }
}

/** Get the currently active Audio element, if any. */
export function getCurrentAudio(): HTMLAudioElement | null {
  return currentAudio;
}

/** Seek the currently active audio to a specific timestamp in seconds. */
export function seekAudio(timeSeconds: number): void {
  if (currentAudio && !isNaN(timeSeconds)) {
    currentAudio.currentTime = Math.max(0, Math.min(timeSeconds, currentAudio.duration || timeSeconds));
  }
}

/** Format seconds into MM:SS display string (e.g. 0:12 or 1:45). */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/** Play a pre-recorded audio URL (base64 data URL or blob URL) with optional time updates. */
export function playAudioUrl(
  url: string,
  onEnded?: () => void,
  onTimeUpdate?: (currentTime: number, duration: number) => void
): HTMLAudioElement {
  stopSpeaking();
  const audio = new Audio(url);
  currentAudio = audio;
  // No object URL to revoke for base64 data URLs
  currentObjectURL = null;

  audio.addEventListener('timeupdate', () => {
    if (currentAudio === audio) {
      onTimeUpdate?.(audio.currentTime, audio.duration || 0);
      if (currentAlignment) {
        const time = audio.currentTime;
        const starts = currentAlignment.character_start_times_seconds;
        const ends = currentAlignment.character_end_times_seconds;
        let activeCharIndex = -1;
        for (let i = 0; i < starts.length; i++) {
          if (time >= starts[i] && time <= ends[i]) {
            activeCharIndex = i;
            break;
          }
        }
        if (activeCharIndex >= 0) {
          onWordHighlight?.(activeCharIndex);
        }
      }
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (currentAudio === audio) {
      onTimeUpdate?.(audio.currentTime, audio.duration || 0);
    }
  });

  audio.addEventListener('ended', () => {
    if (currentAudio === audio) {
      stopSpeaking();
      onEnded?.();
    }
  });

  audio.addEventListener('error', () => {
    console.warn('[TTS] Pre-recorded audio playback error.');
    if (currentAudio === audio) {
      stopSpeaking();
      onEnded?.();
    }
  });

  audio.play().catch(err => {
    console.warn('[TTS] Failed to play pre-recorded audio:', err);
    stopSpeaking();
  });

  return audio;
}

/**
 * Play a short audition snippet for a voice so creators can hear it before assigning.
 */
export async function previewVoice(voiceId: string, sampleText = 'Hi, I\'m ready to bring your characters to life.'): Promise<void> {
  stopSpeaking();
  try {
    const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
      body: {
        endpoint: `/v1/text-to-speech/${voiceId}`,
        method: 'POST',
        body: {
          text: sampleText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }
      }
    });
    if (error || data?.error || !data?.audio_base64) {
      console.warn('[TTS] Voice preview failed, using browser TTS');
      return;
    }
    const binaryStr = atob(data.audio_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.content_type || 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentObjectURL = url;
    audio.addEventListener('ended', () => { if (currentAudio === audio) stopSpeaking(); });
    await audio.play();
  } catch (err) {
    console.warn('[TTS] Voice preview error:', err);
  }
}

/**
 * Play an array of audio URLs sequentially. Returns a controller to stop playback.
 * Calls onLineChange(index) before each line starts playing.
 */
export function playAudioSequence(
  urls: (string | null | undefined)[],
  onLineChange?: (index: number) => void,
  onEnded?: () => void
): { stop: () => void } {
  let stopped = false;
  let idx = 0;

  const playNext = () => {
    if (stopped || idx >= urls.length) {
      stopSpeaking();
      if (!stopped) onEnded?.();
      return;
    }
    const url = urls[idx];
    if (!url) {
      idx++;
      playNext();
      return;
    }
    onLineChange?.(idx);
    stopSpeaking();
    const audio = new Audio(url);
    currentAudio = audio;
    currentObjectURL = null;

    audio.addEventListener('ended', () => {
      if (stopped) return;
      idx++;
      playNext();
    });

    audio.addEventListener('error', () => {
      console.warn('[TTS] Sequence playback error on line', idx);
      if (stopped) return;
      idx++;
      playNext();
    });

    audio.play().catch(() => {
      if (stopped) return;
      idx++;
      playNext();
    });
  };

  playNext();

  return {
    stop: () => {
      stopped = true;
      stopSpeaking();
    }
  };
}
