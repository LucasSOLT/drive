-- ═══════════════════════════════════════════════════════════
-- DRiVE: Fix official_stories permissions and user_stories columns
-- ═══════════════════════════════════════════════════════════

-- 1. Grant table privileges on official_stories to authenticated and anon
GRANT ALL ON TABLE public.official_stories TO authenticated, anon, service_role;

-- 2. Add missing columns to user_stories
ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS bgm_url text,
  ADD COLUMN IF NOT EXISTS bgm_volume float DEFAULT 0.25;

-- 3. Ensure Lucas and admin whitelist have is_admin = true
UPDATE public.profiles
  SET is_admin = true, role = 'admin'
  WHERE id IN (
    SELECT id FROM auth.users
    WHERE email IN ('lucas@soltheory.com', 'steve@soltheory.com', 'gerard@soltheory.com')
  );

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
