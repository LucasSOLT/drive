// ─── READING TRACKER ENGINE (Engine A - Module 1) ───

export type ReadingLifecycleStatus = 
  | 'episode-1-access' 
  | 'awaiting-squad' 
  | 'active-journey' 
  | 'blocked' 
  | 'completed';

export interface TrackedStory {
  storyId: string;
  storyTitle: string;
  storyCoverImage?: string;
  storyCoverVideo?: string;
  format: 'scroll' | 'book';
  author?: string;
  genre?: string;
  status: ReadingLifecycleStatus;
  currentEpisode: number;
  lastReadAt: number;
  squadRoomCode?: string;
}

const STORAGE_KEY = 'drive_tracked_reading_stories';

export function getTrackedStories(): TrackedStory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stories: TrackedStory[] = JSON.parse(raw);
    return Array.isArray(stories) ? stories.sort((a, b) => b.lastReadAt - a.lastReadAt) : [];
  } catch (e) {
    console.error('Failed to get tracked stories:', e);
    return [];
  }
}

export function getTrackedStory(storyId: string): TrackedStory | undefined {
  const stories = getTrackedStories();
  return stories.find(s => s.storyId === storyId);
}

export function trackStoryReading(story: {
  id: string;
  title: string;
  coverImage?: string;
  coverVideo?: string;
  format: string;
  author?: string;
  genre?: string;
  episodeNumber?: number;
}): TrackedStory {
  const stories = getTrackedStories();
  const existingIdx = stories.findIndex(s => s.storyId === story.id);

  let tracked: TrackedStory;

  if (existingIdx >= 0) {
    // Update existing story tracking
    tracked = {
      ...stories[existingIdx],
      storyTitle: story.title || stories[existingIdx].storyTitle,
      storyCoverImage: story.coverImage || stories[existingIdx].storyCoverImage,
      storyCoverVideo: story.coverVideo || stories[existingIdx].storyCoverVideo,
      format: (story.format === 'book' ? 'book' : 'scroll'),
      author: story.author || stories[existingIdx].author,
      genre: story.genre || stories[existingIdx].genre,
      currentEpisode: story.episodeNumber || stories[existingIdx].currentEpisode || 1,
      lastReadAt: Date.now(),
    };
    stories[existingIdx] = tracked;
  } else {
    // Add new tracked story in "Episode 1 Access" state
    tracked = {
      storyId: story.id,
      storyTitle: story.title,
      storyCoverImage: story.coverImage,
      storyCoverVideo: story.coverVideo,
      format: (story.format === 'book' ? 'book' : 'scroll'),
      author: story.author || 'DRiVE Original',
      genre: story.genre || 'Story',
      status: 'episode-1-access',
      currentEpisode: story.episodeNumber || 1,
      lastReadAt: Date.now(),
    };
    stories.unshift(tracked);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  } catch (e) {
    console.error('Failed to save tracked stories:', e);
  }

  return tracked;
}

export function updateTrackedStoryStatus(
  storyId: string,
  status: ReadingLifecycleStatus,
  squadRoomCode?: string
): void {
  const stories = getTrackedStories();
  const story = stories.find(s => s.storyId === storyId);
  if (story) {
    story.status = status;
    if (squadRoomCode) story.squadRoomCode = squadRoomCode;
    story.lastReadAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
    } catch (e) {
      console.error('Failed to update tracked story status:', e);
    }
  }
}

export function removeTrackedStory(storyId: string): void {
  const stories = getTrackedStories().filter(s => s.storyId !== storyId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  } catch (e) {
    console.error('Failed to remove tracked story:', e);
  }
}
