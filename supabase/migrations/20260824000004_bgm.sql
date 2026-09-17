-- =======================================================
-- DRiVE: Add background music (BGM) columns
-- =======================================================

ALTER TABLE public.official_stories
  ADD COLUMN IF NOT EXISTS bgm_url text,
  ADD COLUMN IF NOT EXISTS bgm_volume float DEFAULT 0.25;

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS bgm_url text,
  ADD COLUMN IF NOT EXISTS bgm_volume float DEFAULT 0.25;
