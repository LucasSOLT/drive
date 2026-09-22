import type { Story, Genre } from '../types.ts';

export const genres: Genre[] = [
  'Fantasy', 'Sci-Fi', 'Romance', 'Horror', 
  'Comedy', 'Drama', 'Mystery', 'Slice of Life'
];

// All public stories are now sourced exclusively from Supabase (status = 'live').
// No hardcoded stories — every story must go through the admin "Go Live" flow.
export const stories: Story[] = [];

import { getUserStoryById } from '../state.ts';
import { fetchLiveOfficialStories } from '../lib/db.ts';
import { isVideoMedia } from '../lib/media.ts';

let liveOfficialStories: Story[] = [];

// Pre-fetch live official stories in the background
fetchLiveOfficialStories()
  .then(res => {
    liveOfficialStories = res;
  })
  .catch(console.error);

export async function refreshLiveStories(): Promise<Story[]> {
  try {
    liveOfficialStories = await fetchLiveOfficialStories();
    return liveOfficialStories;
  } catch (err) {
    console.warn('[Stories] Failed to refresh live stories:', err);
    return liveOfficialStories;
  }
}

export function getStoryById(id: string): Story | undefined {
  // 1. Check live official stories from Supabase
  const liveFound = liveOfficialStories.find(s => s.id === id);
  if (liveFound) return liveFound;

  // 2. Fallback to static stories
  const staticFound = stories.find(s => s.id === id);
  if (staticFound) return staticFound;

  // 3. Fallback to user stories in state
  const userStory = getUserStoryById(id);
  if (userStory) {
    const pages = userStory.live_pages || userStory.pages || [];
    const pageVideos: Record<number, string> = {};
    pages.forEach((p: any, idx: number) => {
      if (p && isVideoMedia(p.image)) {
        pageVideos[idx] = p.image;
      }
    });

    const rawCoverVideo = userStory.coverVideo || undefined;
    const rawCoverImage = userStory.coverImage || '';
    const firstPageImage = pages[0]?.image || '';

    const coverVideo = (rawCoverVideo && isVideoMedia(rawCoverVideo))
      ? rawCoverVideo
      : isVideoMedia(rawCoverImage)
        ? rawCoverImage
        : isVideoMedia(firstPageImage)
          ? firstPageImage
          : undefined;

    const coverImage = (!isVideoMedia(rawCoverImage) && rawCoverImage)
      || (!isVideoMedia(firstPageImage) && firstPageImage)
      || '';

    return {
      id: userStory.id,
      title: userStory.title,
      author: userStory.author_name || 'DRiVE Author',
      genre: userStory.genre,
      format: userStory.format,
      synopsis: userStory.synopsis || '',
      coverImage,
      coverVideo,
      readCount: userStory.readCount || 0,
      isFeatured: userStory.isFeatured || false,
      isEditorPick: userStory.isEditorsPick || false,
      panels: pages.map((p: any) => p.image).filter(Boolean),
      pageAudio: userStory.page_audio || {},
      characters: userStory.characters || [],
      pageDialogue: userStory.page_dialogue || {},
    };
  }

  // 4. Fallback to registered stories (e.g. from explore or admin)
  const regFound = registeredStories.find(s => s.id === id);
  if (regFound) return regFound;

  return undefined;
}

const registeredStories: Story[] = [];

export function registerStories(list: Story[]): void {
  list.forEach(s => {
    const idx = registeredStories.findIndex(e => e.id === s.id);
    if (idx >= 0) {
      registeredStories[idx] = s;
    } else {
      registeredStories.push(s);
    }
  });
}

export function registerStory(s: Story): void {
  const idx = registeredStories.findIndex(e => e.id === s.id);
  if (idx >= 0) {
    registeredStories[idx] = s;
  } else {
    registeredStories.push(s);
  }
}

export function getStoriesByGenre(genre: Genre): Story[] {
  return stories.filter(s => s.genre === genre);
}

export function getFeaturedStories(): Story[] {
  return stories.filter(s => s.isFeatured && s.title && s.title.trim().length > 0);
}

export function getEditorPicks(): Story[] {
  return stories.filter(s => s.isEditorPick && s.title && s.title.trim().length > 0);
}
