-- ═══════════════════════════════════════════════════════════
-- DRiVE Complete System Fixes Migration
-- Fixes: friends system, SPARC FK constraints, missing columns
-- Run this AFTER all existing migrations
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. Add friend_code column to profiles
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS friend_code text UNIQUE;

-- Backfill existing profiles that don't have a friend code
UPDATE profiles
SET friend_code = LPAD(FLOOR(10000000 + RANDOM() * 90000000)::text, 8, '0')
WHERE friend_code IS NULL;

-- ═══════════════════════════════════════════════════════════
-- 2. Create friends table (mutual friendship)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS friends (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'accepted' CHECK (status IN ('accepted', 'pending', 'blocked')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id <> friend_id)
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Users can see friendships they're part of
CREATE POLICY "Users can read own friendships"
  ON friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Authenticated users can insert friendships
CREATE POLICY "Authenticated can add friends"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- Users can delete friendships they're part of (unfriend from either side)
CREATE POLICY "Users can remove own friendships"
  ON friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can update friendships they're part of (e.g. accept pending)
CREATE POLICY "Users can update own friendships"
  ON friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

GRANT ALL ON TABLE friends TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════
-- 3. Add missing columns to user_stories
-- ═══════════════════════════════════════════════════════════

ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS characters jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS page_dialogue jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS audio_mode text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS narrator_voice_id text,
  ADD COLUMN IF NOT EXISTS cover_video text,
  ADD COLUMN IF NOT EXISTS page_audio jsonb DEFAULT '[]';

-- ═══════════════════════════════════════════════════════════
-- 4. Add missing columns to official_stories
-- ═══════════════════════════════════════════════════════════

ALTER TABLE official_stories
  ADD COLUMN IF NOT EXISTS characters jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS page_dialogue jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS narrator_voice_id text;

-- ═══════════════════════════════════════════════════════════
-- 5. Add FK constraints on sparc_responses.user_id → profiles(id)
--    This is needed for PostgREST join syntax to work, and also
--    fixes the PGRST200 error.
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  -- sparc_responses.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sparc_responses_user_id_profiles_fk'
      AND table_name = 'sparc_responses'
  ) THEN
    ALTER TABLE sparc_responses
      ADD CONSTRAINT sparc_responses_user_id_profiles_fk
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- sparc_replies.user_id → profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sparc_replies_user_id_profiles_fk'
      AND table_name = 'sparc_replies'
  ) THEN
    ALTER TABLE sparc_replies
      ADD CONSTRAINT sparc_replies_user_id_profiles_fk
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 6. Ensure sparc_responses has modern column names
--    (The older 20260812000003_sparc.sql migration may have
--    created the table with chapter_index/prompt_type/media_url
--    instead of story_group_id/episode_number/media_urls)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE sparc_responses
  ADD COLUMN IF NOT EXISTS story_group_id text,
  ADD COLUMN IF NOT EXISTS episode_number integer,
  ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════
-- 7. Ensure profiles table has avatar_index
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_index integer DEFAULT 0;

-- ═══════════════════════════════════════════════════════════
-- 8. Enable Realtime for friends table
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE friends;
