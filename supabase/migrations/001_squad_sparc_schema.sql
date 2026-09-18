-- ═══════════════════════════════════════════════════════════
-- DRiVE Squad Sessions & SPARC Checkpoints Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- 0. Create base squad tables (if they don't exist yet)

CREATE TABLE IF NOT EXISTS squads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL,
  story_id text DEFAULT '',
  name text NOT NULL DEFAULT 'Unnamed Squad',
  invite_code text UNIQUE NOT NULL,
  status text DEFAULT 'forming' CHECK (status IN ('forming', 'in-progress', 'completed')),
  min_size integer DEFAULT 3,
  max_size integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squads' AND policyname = 'Anyone can read squads') THEN
    CREATE POLICY "Anyone can read squads" ON squads FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squads' AND policyname = 'Authenticated can create squads') THEN
    CREATE POLICY "Authenticated can create squads" ON squads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squads' AND policyname = 'Authenticated can update squads') THEN
    CREATE POLICY "Authenticated can update squads" ON squads FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS squad_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid REFERENCES squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'player' CHECK (role IN ('driver', 'player')),
  joined_at timestamptz DEFAULT now()
);

ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squad_members' AND policyname = 'Anyone can read squad members') THEN
    CREATE POLICY "Anyone can read squad members" ON squad_members FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squad_members' AND policyname = 'Authenticated can join squads') THEN
    CREATE POLICY "Authenticated can join squads" ON squad_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squad_members' AND policyname = 'Authenticated can update membership') THEN
    CREATE POLICY "Authenticated can update membership" ON squad_members FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  story_id text DEFAULT '',
  story_title text DEFAULT '',
  story_cover_image text DEFAULT '',
  timezone_offset integer DEFAULT 0,
  availability text DEFAULT 'anytime',
  status text DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matchmaking_queue' AND policyname = 'Anyone can read matchmaking queue') THEN
    CREATE POLICY "Anyone can read matchmaking queue" ON matchmaking_queue FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matchmaking_queue' AND policyname = 'Authenticated can join matchmaking') THEN
    CREATE POLICY "Authenticated can join matchmaking" ON matchmaking_queue FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matchmaking_queue' AND policyname = 'Authenticated can update matchmaking') THEN
    CREATE POLICY "Authenticated can update matchmaking" ON matchmaking_queue FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 1. Add squad gate & SPARC fields to official_stories
-- ═══════════════════════════════════════════════════════════

ALTER TABLE official_stories
  ADD COLUMN IF NOT EXISTS solo_episode_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sparc_prompt jsonb DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════
-- 2. Add ready state and SPARC tracking to squad_members
-- ═══════════════════════════════════════════════════════════

ALTER TABLE squad_members
  ADD COLUMN IF NOT EXISTS is_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sparc_completed_episodes integer[] DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════
-- 3. Create squad_sessions table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS squad_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid REFERENCES squads(id) ON DELETE CASCADE,
  story_group_id text NOT NULL,
  current_episode_number integer DEFAULT 2,
  episode_started_at timestamptz DEFAULT now(),
  status text DEFAULT 'reading' CHECK (status IN ('reading', 'sparc', 'advancing', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE squad_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squad_sessions' AND policyname = 'Anyone can read squad sessions') THEN
    CREATE POLICY "Anyone can read squad sessions" ON squad_sessions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squad_sessions' AND policyname = 'Authenticated can create squad sessions') THEN
    CREATE POLICY "Authenticated can create squad sessions" ON squad_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'squad_sessions' AND policyname = 'Authenticated can update squad sessions') THEN
    CREATE POLICY "Authenticated can update squad sessions" ON squad_sessions FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 4. Create sparc_responses table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sparc_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id uuid REFERENCES squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  story_group_id text NOT NULL,
  episode_number integer NOT NULL,
  content text NOT NULL,
  media_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sparc_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_responses' AND policyname = 'Anyone can read SPARC responses') THEN
    CREATE POLICY "Anyone can read SPARC responses" ON sparc_responses FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_responses' AND policyname = 'Authenticated can submit SPARC responses') THEN
    CREATE POLICY "Authenticated can submit SPARC responses" ON sparc_responses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 5. Create indexes for performance
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_squad_sessions_squad_id ON squad_sessions(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_sessions_status ON squad_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sparc_responses_squad_episode ON sparc_responses(squad_id, story_group_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_squad_members_ready ON squad_members(squad_id, is_ready);
CREATE INDEX IF NOT EXISTS idx_squads_invite_code ON squads(invite_code);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON squad_members(squad_id);
