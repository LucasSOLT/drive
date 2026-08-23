export type StoryFormat = 'scroll' | 'book' | 'comic';

export type Genre = 'Fantasy' | 'Sci-Fi' | 'Romance' | 'Horror' | 'Comedy' | 'Drama' | 'Mystery' | 'Slice of Life' | 'Action' | 'Adventure' | 'Thriller' | 'Historical' | 'Superhero' | 'Sports' | 'Psychological' | 'Supernatural' | 'Mecha' | 'Musical' | 'Custom';

export type ContentRating = 'All Ages' | 'PG-13' | 'Mature';

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
