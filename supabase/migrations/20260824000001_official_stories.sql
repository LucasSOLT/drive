-- ═══════════════════════════════════════════════════════════
-- DRiVE: Official Stories Table + Admin Dashboard Fixes
-- Creates: official_stories table
-- Updates: user_stories (add cover_image), profiles grants
-- ═══════════════════════════════════════════════════════════

-- 1. OFFICIAL STORIES TABLE (DRiVE Originals)
CREATE TABLE IF NOT EXISTS public.official_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled',
  author text NOT NULL DEFAULT 'DRiVE Studios',
  genre text NOT NULL DEFAULT 'Fantasy',
  format text NOT NULL DEFAULT 'book',
  synopsis text DEFAULT '',
  cover_image text DEFAULT '',
  cover_video text DEFAULT '',
  status text DEFAULT 'draft',
  is_featured boolean DEFAULT false,
  is_editor_pick boolean DEFAULT false,
  content_rating text DEFAULT 'All Ages',
  sort_order integer DEFAULT 0,
  panels jsonb DEFAULT '[]'::jsonb,
  page_videos jsonb DEFAULT '{}'::jsonb,
  page_scripts jsonb DEFAULT '{}'::jsonb,
  page_audio jsonb DEFAULT '{}'::jsonb,
  read_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.official_stories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read live officials') THEN
    CREATE POLICY "Anyone can read live officials"
      ON public.official_stories FOR SELECT
      USING (status = 'live');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access to officials') THEN
    CREATE POLICY "Admins full access to officials"
      ON public.official_stories FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

GRANT SELECT ON public.official_stories TO anon, authenticated;
GRANT ALL ON public.official_stories TO authenticated;

-- 2. ADD COVER IMAGE COLUMN TO USER_STORIES
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS cover_image text DEFAULT '';

-- 3. ADD SORT ORDER TO USER_STORIES (for featured ordering)
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 4. ADD POPULARITY SCORE TO USER_STORIES
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS popularity_score integer DEFAULT 0;

-- 5. FIX: Ensure is_admin column is readable
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 6. Ensure users can read their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile') THEN
    CREATE POLICY "Users can read own profile"
      ON public.profiles FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

-- 7. Ensure users can update their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
