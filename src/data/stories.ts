import type { Story, Genre } from '../types.ts';

export const genres: Genre[] = [
  'Fantasy', 'Sci-Fi', 'Romance', 'Horror', 
  'Comedy', 'Drama', 'Mystery', 'Slice of Life'
];

export const stories: Story[] = [
  {
    id: 'hoodies-2-suits',
    title: 'Hoodies 2 Suits',
    author: 'DRiVE Studios',
    genre: 'Drama',
    format: 'book',
    synopsis: 'From the block to the boardroom — a story about growth, ambition, and never forgetting where you came from.',
    isFeatured: true,
    isEditorPick: true,
    readCount: 4200,
    coverImage: '',
    coverVideo: '/videos/hoodies-2-suits.mp4',
    panels: ['/videos/workshop-h2s.mp4'],
    pageVideos: { 0: '/videos/workshop-h2s.mp4' },
    pageScripts: { 0: 'Josie (00:01): "Can you actually get that thing to work?"\n\nMark (00:03): "I just need a little more time with it."' },
  },
  {
    id: 'placeholder-1',
    title: '',
    author: '',
    genre: 'Fantasy',
    format: 'scroll',
    synopsis: '',
    isFeatured: true,
    isEditorPick: true,
    readCount: 0,
    coverImage: '',
    panels: []
  },
  {
    id: 'placeholder-2',
    title: '',
    author: '',
    genre: 'Sci-Fi',
    format: 'comic',
    synopsis: '',
    isFeatured: true,
    isEditorPick: false,
    readCount: 0,
    coverImage: '',
    panels: []
  },
  {
    id: 'placeholder-3',
    title: '',
    author: '',
    genre: 'Romance',
    format: 'book',
    synopsis: '',
    isFeatured: false,
    isEditorPick: true,
    readCount: 0,
    coverImage: '',
    panels: []
  },
  {
    id: 'placeholder-4',
    title: '',
    author: '',
    genre: 'Horror',
    format: 'scroll',
    synopsis: '',
    isFeatured: false,
    isEditorPick: false,
    readCount: 0,
    coverImage: '',
    panels: []
  },
  {
    id: 'placeholder-5',
    title: '',
    author: '',
    genre: 'Comedy',
    format: 'comic',
    synopsis: '',
    isFeatured: false,
    isEditorPick: true,
    readCount: 0,
    coverImage: '',
    panels: []
  },
  {
    id: 'placeholder-6',
    title: '',
    author: '',
    genre: 'Drama',
    format: 'scroll',
    synopsis: '',
    isFeatured: true,
    isEditorPick: false,
    readCount: 0,
    coverImage: '',
    panels: []
  }
];

import { getUserStoryById } from '../state.ts';
import { fetchLiveOfficialStories } from '../lib/db.ts';

let liveOfficialStories: Story[] = [];

// Pre-fetch live official stories in the background
fetchLiveOfficialStories()
  .then(res => {
    liveOfficialStories = res;
  })
  .catch(console.error);

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
    return {
      id: userStory.id,
      title: userStory.title,
      author: userStory.author_name || 'DRiVE Author',
      genre: userStory.genre,
      format: userStory.format,
      synopsis: userStory.synopsis || '',
      coverImage: pages[0]?.image || '',
      readCount: userStory.readCount || 0,
      isFeatured: userStory.isFeatured || false,
      isEditorPick: userStory.isEditorsPick || false,
      panels: pages.map((p: any) => p.image).filter(Boolean),
      pageAudio: userStory.page_audio || {},
    };
  }

  return undefined;
}

export function getStoriesByGenre(genre: Genre): Story[] {
  return stories.filter(s => s.genre === genre);
}

export function getFeaturedStories(): Story[] {
  return stories.filter(s => s.isFeatured);
}

export function getEditorPicks(): Story[] {
  return stories.filter(s => s.isEditorPick);
}
