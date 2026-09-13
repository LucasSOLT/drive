-- ═══════════════════════════════════════════════════════════
-- DRiVE: Fix Admin RLS for official_stories
-- Allows both admin and game_master roles to manage official stories
-- Also syncs is_admin flag for admin email whitelist
-- ═══════════════════════════════════════════════════════════

-- 1. Add 'role' column to profiles if not present
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- 2. Drop the old restrictive policy and recreate with role support
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access to officials') THEN
    DROP POLICY "Admins full access to officials" ON public.official_stories;
  END IF;
END $$;

CREATE POLICY "Admins full access to officials"
  ON public.official_stories FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (is_admin = true OR role IN ('admin', 'game_master'))
    )
  );

-- 3. Ensure admin emails have is_admin = true so RLS always passes
UPDATE public.profiles
  SET is_admin = true, role = 'admin'
  WHERE id IN (
    SELECT id FROM auth.users
    WHERE email IN ('lucas@soltheory.com', 'steve@soltheory.com', 'gerard@soltheory.com')
  );

-- 4. Drop old created_by column if it exists and has a foreign key constraint
-- (created_by was never added to the migration, so this is a safety net)
ALTER TABLE public.official_stories DROP COLUMN IF EXISTS created_by;
