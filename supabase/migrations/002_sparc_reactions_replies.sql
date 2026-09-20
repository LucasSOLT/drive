-- =================================================
-- SPARC Reactions & Replies
-- =================================================

-- 1. Reactions table (emoji reactions on SPARC posts)
CREATE TABLE IF NOT EXISTS sparc_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid REFERENCES sparc_responses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,  -- one of: fire, lightbulb, mindblown, heart
  created_at timestamptz DEFAULT now(),
  UNIQUE(response_id, user_id, emoji)  -- one reaction per emoji per user per post
);

ALTER TABLE sparc_reactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_reactions' AND policyname = 'Anyone can read reactions') THEN
    CREATE POLICY "Anyone can read reactions" ON sparc_reactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_reactions' AND policyname = 'Authenticated can add reactions') THEN
    CREATE POLICY "Authenticated can add reactions" ON sparc_reactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_reactions' AND policyname = 'Users can remove own reactions') THEN
    CREATE POLICY "Users can remove own reactions" ON sparc_reactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sparc_reactions_response ON sparc_reactions(response_id);

GRANT ALL ON TABLE sparc_reactions TO anon, authenticated, service_role;

-- 2. Replies table (threaded replies under SPARC posts)
CREATE TABLE IF NOT EXISTS sparc_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid REFERENCES sparc_responses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sparc_replies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_replies' AND policyname = 'Anyone can read replies') THEN
    CREATE POLICY "Anyone can read replies" ON sparc_replies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sparc_replies' AND policyname = 'Authenticated can add replies') THEN
    CREATE POLICY "Authenticated can add replies" ON sparc_replies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sparc_replies_response ON sparc_replies(response_id);

GRANT ALL ON TABLE sparc_replies TO anon, authenticated, service_role;
