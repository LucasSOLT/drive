-- ═══════════════════════════════════════════════════════════
-- DRiVE: Admin & Story Publishing Workflow Migration
-- Adds admin role, rejection reasons, ratings, versioning & audit logs
-- ═══════════════════════════════════════════════════════════

-- 1. ADD ADMIN FLAG TO PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2. ADD PUBLISHING & REVIEW FIELDS TO USER_STORIES
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS content_rating text DEFAULT 'All Ages';
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS is_editors_pick boolean DEFAULT false;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS live_pages jsonb DEFAULT NULL;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS read_count integer DEFAULT 0;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 3. RLS POLICIES FOR ADMINS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can CRUD all stories') THEN
    CREATE POLICY "Admins can CRUD all stories" ON public.user_stories
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update all profiles') THEN
    CREATE POLICY "Admins can update all profiles" ON public.profiles
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;
