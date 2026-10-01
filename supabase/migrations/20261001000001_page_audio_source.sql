-- Add per-page audio source selector for video pages
ALTER TABLE public.official_stories ADD COLUMN IF NOT EXISTS page_audio_source jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS page_audio_source jsonb DEFAULT '{}'::jsonb;
