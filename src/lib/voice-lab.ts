/**
 * Voice Lab — Cached Voice Audition Engine & Character Voice Resolver.
 *
 * Provides two capabilities:
 * 1. **Cached Voice Auditions**: Generates and caches audition clips so
 *    repeated clicks on "Audition" don't re-call ElevenLabs (saving API credits).
 *    Cache is per-session (in-memory) with optional localStorage persistence.
 *
 * 2. **Character Voice Resolver**: Single-source-of-truth function that resolves
 *    which ElevenLabs voice ID to use for any dialogue line, respecting the
 *    priority chain: line.voiceId > character.voiceId > narrator.voiceId > default.
 */

import { supabase } from './supabase.ts';
import { stopSpeaking, readProxyError } from './tts.ts';
import type { StoryCharacter } from '../types.ts';

const DEFAULT_NARRATOR_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// ─── Audition Cache ───
// Key: voiceId, Value: object URL for the audition audio blob
const auditionCache = new Map<string, string>();

// iPhone rule: sound can only start from an <audio> element that was started during the tap.
// The audition clip arrives after a network wait, so the tap handler calls primeAuditionAudio()
// first (plays a 44-byte silent clip), and the real clip later reuses that unlocked element.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
let auditionEl: HTMLAudioElement | null = null;

/** Call synchronously at the very start of an Audition tap, before any await. */
export function primeAuditionAudio(): void {
  if (!auditionEl) auditionEl = new Audio();
  const a = auditionEl;
  try {
    a.src = SILENT_WAV;
    a.play().then(() => { if (a.src === SILENT_WAV) a.pause(); }).catch(() => {});
  } catch { /* ignore */ }
}

function getAuditionEl(src: string): HTMLAudioElement {
  if (!auditionEl) auditionEl = new Audio();
  auditionEl.pause();
  auditionEl.src = src;
  return auditionEl;
}

// Customizable audition lines per character name slot
const AUDITION_TEMPLATES = [
  (name: string) => `Hi, I'm ${name}. Ready to bring your story to life.`,
  (name: string) => `The name's ${name}. Let's make some magic together.`,
  (name: string) => `${name} here. Want to hear more? Just say the word.`,
];

function getAuditionText(name: string, index = 0): string {
  return AUDITION_TEMPLATES[index % AUDITION_TEMPLATES.length](name);
}

/**
 * Audition a voice — plays a short sample clip.
 *
 * On first call for a given voiceId, synthesizes via ElevenLabs and caches
 * the resulting audio blob URL. Subsequent calls for the same voiceId
 * play from cache instantly (zero API cost, zero latency).
 *
 * @param voiceId      - ElevenLabs voice ID to audition
 * @param characterName - Used to personalize the sample text
 * @param forceRefresh - If true, bypasses cache and re-synthesizes
 * @returns The HTMLAudioElement that's playing (for stop control)
 */
export async function auditionVoice(
  voiceId: string,
  characterName = 'your character',
  forceRefresh = false
): Promise<HTMLAudioElement | null> {
  stopSpeaking();

  // Check cache first
  if (!forceRefresh && auditionCache.has(voiceId)) {
    const cachedUrl = auditionCache.get(voiceId)!;
    const audio = getAuditionEl(cachedUrl);
    await startPlayback(audio);
    return audio;
  }

  // Synthesize a fresh audition clip
  const sampleText = getAuditionText(characterName);

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

  const proxyErr = await readProxyError(data, error);
  if (proxyErr || !data?.audio_base64) {
    console.warn('[VoiceLab] Audition synthesis failed:', proxyErr);
    throw new Error(proxyErr || 'No audio came back from the voice service.');
  }

  // Decode base64 → blob → object URL
  const binaryStr = atob(data.audio_base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: data.content_type || 'audio/mpeg' });
  const objectUrl = URL.createObjectURL(blob);

  // Cache it
  auditionCache.set(voiceId, objectUrl);

  // Play
  const audio = getAuditionEl(objectUrl);
  await startPlayback(audio);
  return audio;
}

/** Play, turning a blocked/failed play() into a readable error. */
async function startPlayback(audio: HTMLAudioElement): Promise<void> {
  try {
    await audio.play();
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      throw new Error('Your phone blocked the sound. Turn off silent mode and tap Audition again.');
    }
    throw new Error('The audition clip could not be played on this device.');
  }
}

/**
 * Clear the audition cache for a specific voice or all voices.
 * Useful when switching voices on a character — the old cache entry
 * for the previous voice isn't needed anymore.
 */
export function clearAuditionCache(voiceId?: string): void {
  if (voiceId) {
    const url = auditionCache.get(voiceId);
    if (url) {
      URL.revokeObjectURL(url);
      auditionCache.delete(voiceId);
    }
  } else {
    auditionCache.forEach(url => URL.revokeObjectURL(url));
    auditionCache.clear();
  }
}

// ─── Character Voice Resolver ───

export interface VoiceResolution {
  voiceId: string;
  source: 'line-override' | 'character' | 'narrator' | 'default';
  characterName: string;
}

/**
 * Resolve the voice ID for a dialogue line.
 *
 * Priority chain (highest to lowest):
 * 1. `line.voiceId`         — per-line override (rare, for one-off voice changes)
 * 2. `character.voiceId`    — the character's assigned voice from the cast roster
 * 3. `narratorVoiceId`      — the story's narrator voice (used for narrator lines)
 * 4. `DEFAULT_NARRATOR_VOICE_ID` — hardcoded fallback (Rachel)
 *
 * @param line            - The dialogue line being resolved
 * @param characters      - The story's character roster
 * @param narratorVoiceId - The narrator's voice ID for this story
 */
export function resolveVoiceForLine(
  line: { characterId: string; characterName: string; voiceId?: string },
  characters: StoryCharacter[],
  narratorVoiceId: string = DEFAULT_NARRATOR_VOICE_ID
): VoiceResolution {
  // 1. Per-line voice override
  if (line.voiceId) {
    return {
      voiceId: line.voiceId,
      source: 'line-override',
      characterName: line.characterName,
    };
  }

  // 2. Character voice (if not narrator)
  if (line.characterId !== 'narrator') {
    const char = characters.find(c => c.id === line.characterId);
    if (char?.voiceId) {
      return {
        voiceId: char.voiceId,
        source: 'character',
        characterName: char.name,
      };
    }
  }

  // 3. Narrator voice
  if (narratorVoiceId) {
    return {
      voiceId: narratorVoiceId,
      source: 'narrator',
      characterName: '🎙️ Narrator',
    };
  }

  // 4. Default fallback
  return {
    voiceId: DEFAULT_NARRATOR_VOICE_ID,
    source: 'default',
    characterName: '🎙️ Narrator',
  };
}

/**
 * Resolve voices for ALL dialogue lines on a page at once.
 * Returns a parallel array of VoiceResolution objects.
 * Useful for pre-flight display: showing which voice each line will use
 * before the user commits to pre-recording.
 */
export function resolvePageVoices(
  dialogueLines: { characterId: string; characterName: string; voiceId?: string }[],
  characters: StoryCharacter[],
  narratorVoiceId: string = DEFAULT_NARRATOR_VOICE_ID
): VoiceResolution[] {
  return dialogueLines.map(line => resolveVoiceForLine(line, characters, narratorVoiceId));
}
