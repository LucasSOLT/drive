-- =======================================================
-- DRiVE: Add theme_color column to official_stories & user_stories
-- Allows authors to customize background / atmosphere color
-- =======================================================

ALTER TABLE public.official_stories
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#141424';

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#141424';
