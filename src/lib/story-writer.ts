// ─── Claude Story Writer ───
// Scriptwriter engine for webtoon panels using OpenRouter + Claude

import { supabase } from './supabase.ts';

const SCRIPT_MODEL = 'google/gemini-2.5-flash'; // Budget model for script generation

export interface ScriptPanel {
  panelNumber: number;
  visualPrompt: string;
  dialogue: {
    character: string;
    text: string;
    type: 'speech' | 'thought' | 'whisper' | 'shout';
  }[];
}

export interface StoryScript {
  title: string;
  genre: string;
  characterDescriptions: string;
  panels: ScriptPanel[];
}

export async function generateStoryScript(
  title: string,
  genre: string,
  synopsis: string,
  characterNotes: string,
  panelCount: number = 5
): Promise<StoryScript> {
  const systemPrompt = `You are an expert Webtoon scriptwriter and visual director.
Given a story concept, genre, and synopsis, generate a panel-by-panel script formatted as strict JSON.

Return MUST be valid JSON with this exact structure:
{
  "title": "Story Title",
  "genre": "Genre",
  "characterDescriptions": "Concise physical description of key characters for image generation",
  "panels": [
    {
      "panelNumber": 1,
      "visualPrompt": "Detailed visual description of panel 1 suitable for AI image generation (setting, lighting, character pose, camera angle, action)",
      "dialogue": [
        {
          "character": "Character Name",
          "text": "Dialogue text",
          "type": "speech"
        }
      ]
    }
  ]
}

DO NOT include markdown code fences or conversational text. Return ONLY raw JSON.`;

  const userPrompt = `Create a ${panelCount}-panel webtoon script.
Title: ${title || 'Untitled'}
Genre: ${genre}
Synopsis: ${synopsis}
Character Info: ${characterNotes || 'Standard anime style main characters'}`;

  try {
    const { data, error } = await supabase.functions.invoke('openrouter-proxy', {
      body: {
        endpoint: '/chat/completions',
        method: 'POST',
        body: {
          model: SCRIPT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
        }
      }
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || 'OpenRouter proxy error');
    }

    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';
    const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.warn('Claude scriptwriter fallback triggered:', err);
    return {
      title: title || 'Untitled Story',
      genre,
      characterDescriptions: characterNotes || 'Anime style characters',
      panels: Array.from({ length: panelCount }, (_, i) => ({
        panelNumber: i + 1,
        visualPrompt: `Anime webtoon panel ${i + 1}: ${synopsis}`,
        dialogue: [{ character: 'Main Character', text: 'Sample speech bubble text...', type: 'speech' as const }]
      }))
    };
  }
}
