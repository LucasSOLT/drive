-- Add fields for Series Info screen
ALTER TABLE public.official_stories ADD COLUMN IF NOT EXISTS series_cover_image text;
ALTER TABLE public.official_stories ADD COLUMN IF NOT EXISTS episode_thumbnail text;
ALTER TABLE public.official_stories ADD COLUMN IF NOT EXISTS episode_title text;

ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS series_cover_image text;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS episode_thumbnail text;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS episode_title text;
