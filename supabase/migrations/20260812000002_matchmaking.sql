-- ═══════════════════════════════════════════════════════════
-- DRiVE: Matchmaking & LFG Queue Migration
-- Creates: matchmaking_queue table with RLS policies
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  story_id text,
  bio text DEFAULT '',
  timezone text DEFAULT 'UTC',
  availability text DEFAULT '',
  status text NOT NULL DEFAULT 'searching', -- 'searching' | 'matched'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR MATCHMAKING QUEUE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view searching queue') THEN
    CREATE POLICY "Authenticated users can view searching queue" ON public.matchmaking_queue
      FOR SELECT TO authenticated
      USING (status = 'searching' OR user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own queue entry') THEN
    CREATE POLICY "Users can manage own queue entry" ON public.matchmaking_queue
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
