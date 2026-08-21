-- ═══════════════════════════════════════════════════════════
-- DRiVE: SPARC Checkpoint Responses Migration
-- Creates: sparc_responses table with RLS policies
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sparc_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chapter_index integer NOT NULL DEFAULT 0,
  prompt_type text NOT NULL DEFAULT 'reflection', -- 'reflection' | 'poem' | 'haiku' | 'voice'
  content text DEFAULT '',
  media_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sparc_responses ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR SPARC RESPONSES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own SPARC responses') THEN
    CREATE POLICY "Users can manage own SPARC responses" ON public.sparc_responses
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Squad members can read squad SPARC responses') THEN
    CREATE POLICY "Squad members can read squad SPARC responses" ON public.sparc_responses
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = sparc_responses.squad_id AND user_id = auth.uid())
      );
  END IF;
END $$;
