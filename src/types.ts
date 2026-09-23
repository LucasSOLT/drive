export type StoryFormat = 'scroll' | 'book';

export type Genre = 'Fantasy' | 'Sci-Fi' | 'Romance' | 'Horror' | 'Comedy' | 'Drama' | 'Mystery' | 'Slice of Life' | 'Action' | 'Adventure' | 'Thriller' | 'Historical' | 'Superhero' | 'Sports' | 'Psychological' | 'Supernatural' | 'Mecha' | 'Musical' | 'Custom';

export type ContentRating = 'All Ages' | 'PG-13' | 'Mature';

export type StoryAudioMode = 'make_audio' | 'simple_upload';

export interface StoryCharacter {
  id: string;
  name: string;
  voiceId: string;
  color?: string;
}

export interface DialogueLine {
  id: string;
  characterId: string;
  characterName: string;
  text: string;
  audioUrl?: string | null;
}

export interface Story {
  id: string;
  title: string;
  author: string;
  genre: Genre;
  format: StoryFormat;
  synopsis: string;
  coverImage: string;
  readCount: number;
  isFeatured: boolean;
  isEditorPick: boolean;
  sortOrder?: number;
  panels: string[];
  pageVideos?: Record<number, string>;   // index → video URL for pages that are videos
  pageScripts?: Record<number, string>;  // index → dialogue script text for pages
  pageAudio?: Record<number, string>;    // index → pre-rendered audio URL (ElevenLabs)
  coverVideo?: string;                   // video URL for hover-to-play cover
  contentRating?: ContentRating;
  isOfficial?: boolean;
  officialStatus?: 'draft' | 'live';
  storyGroupId?: string;                 // Groups episodes of the same story together
  episodeNumber?: number;                // 1-based episode number within the story group
  characters?: StoryCharacter[];
  pageDialogue?: Record<number, DialogueLine[]>;
  audioMode?: StoryAudioMode;
  narratorVoiceId?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  pageFocalPositions?: Record<number, string>;  // index → 'top' | 'center' | 'bottom'
  // ─── Squad Gate & SPARC Checkpoint ───
  soloEpisodeCount?: 1 | 2 | 3;         // Episodes playable solo before squad gate (default 1)
  sparcPrompt?: {                        // SPARC checkpoint config for this episode
    text: string;                        // The challenge/question/prompt text
    mediaUrls?: string[];                // Attached images or videos
  };
  themeColor?: string;                   // Custom background / atmosphere color (e.g. #000000, #141424)
}

export interface UserStory {
  id: string;
  user_id?: string;
  author_name?: string;
  title: string;
  genre: Genre;
  format: StoryFormat;
  synopsis: string;
  status: 'draft' | 'under-review' | 'published' | 'denied';
  createdAt: string;
  pages?: { image: string | null; text: string }[];
  coverImage?: string;
  coverVideo?: string;
  live_pages?: { image: string | null; text: string }[];
  page_audio?: Record<number, string>;   // pre-rendered audio URLs
  rejectionReason?: string;
  contentRating?: ContentRating;
  isFeatured?: boolean;
  isEditorsPick?: boolean;
  readCount?: number;
  sortOrder?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  likeCount?: number;
  popularityScore?: number;
  characters?: StoryCharacter[];
  page_dialogue?: Record<number, DialogueLine[]>;
  audioMode?: StoryAudioMode;
  narratorVoiceId?: string;
  bgmUrl?: string;
  bgmVolume?: number;
  pageFocalPositions?: Record<number, string>;  // index → 'top' | 'center' | 'bottom'
  themeColor?: string;
}

export type UserPlan = 'free' | 'starter' | 'creator';

export interface UserSubscription {
  plan: UserPlan;
  tokensRemaining: number;   // For starter/pack users
  creditsBalance: number;    // Tracks AI generation credits
  selectedTier: string;      // 'single' | 'monthly' | 'pack' | etc.
  purchasedAt: string;       // ISO date
  expiresAt?: string;        // For creator subscription
}

// ─── Squad Episode Progression ───

/** Tracks a squad's progress through a story group's episodes */
export interface SquadSession {
  id: string;
  squadId: string;
  storyGroupId: string;
  currentEpisodeNumber: number;
  episodeStartedAt: string;         // ISO timestamp — 48h timer starts here
  status: 'reading' | 'sparc' | 'advancing' | 'completed';
}

/** A single SPARC response posted by a squad member */
export interface SparcPost {
  id: string;
  squadId: string;
  storyGroupId: string;
  episodeNumber: number;
  userId: string;
  username: string;
  avatarIndex: number;
  content: string;                  // Rich text (HTML from contenteditable)
  mediaUrls: string[];             // Attached photos, videos, hyperlinks
  createdAt: string;
}

export interface SquadMemberState {
  userId: string;
  username: string;
  avatarIndex: number;
  role: 'driver' | 'player';
  isReady: boolean;
}

export interface SquadDetail {
  id: string;
  driverId: string;
  storyId: string;
  storyTitle?: string;
  storyCoverImage?: string;
  name: string;
  inviteCode: string;
  status: 'forming' | 'in-progress' | 'completed';
  minSize: number;
  maxSize: number;
  members: SquadMemberState[];
}

