-- ═══════════════════════════════════════════════════════════
-- DRiVE: Add audio_mode column for dual audio experience
-- 'make_audio' = multi-character AI voice TTS (default)
-- 'simple_upload' = direct audio file upload per page
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.official_stories
  ADD COLUMN IF NOT EXISTS audio_mode text DEFAULT 'make_audio';

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS audio_mode text DEFAULT 'make_audio';
