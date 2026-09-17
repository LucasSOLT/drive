-- Add page focal positions column to official_stories and user_stories
-- Stores per-page image alignment: { pageIndex: 'top' | 'center' | 'bottom' }

ALTER TABLE official_stories
  ADD COLUMN IF NOT EXISTS page_focal_positions jsonb DEFAULT '{}'::jsonb;

ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS page_focal_positions jsonb DEFAULT '{}'::jsonb;
