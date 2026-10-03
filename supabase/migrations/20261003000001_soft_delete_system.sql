-- ═══════════════════════════════════════════════════════════════════════
-- SAFE DELETION SYSTEM (soft delete + Deleted tab + 30-day cleanup)
--
-- Rules:
--  • Trash buttons never erase rows. They stamp deleted_at / user_deleted_at /
--    admin_deleted_at, and every list hides stamped rows.
--  • Users can NEVER hard-delete their stories (DELETE policy removed).
--  • Once a user story is submitted for review, was_submitted = true forever.
--    Those stories are never erased (not by admins, not by the cleanup job).
--  • Only admins can set/clear admin_deleted_at.
--  • A daily job permanently erases anything deleted 30+ days ago
--    (except submitted user stories).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Columns ─────────────────────────────────────────────────────────────
ALTER TABLE public.official_stories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.official_stories ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS user_deleted_at  timestamptz;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.user_stories ADD COLUMN IF NOT EXISTS was_submitted boolean NOT NULL DEFAULT false;

UPDATE public.user_stories SET was_submitted = true
  WHERE status IS NOT NULL AND status <> 'draft' AND was_submitted = false;

CREATE INDEX IF NOT EXISTS idx_official_stories_deleted_at ON public.official_stories (deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_stories_user_deleted_at ON public.user_stories (user_deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_stories_admin_deleted_at ON public.user_stories (admin_deleted_at);

-- 2. Guard trigger on user_stories ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_user_story_deletion_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.was_submitted := COALESCE(NEW.was_submitted, false) OR COALESCE(NEW.status, 'draft') <> 'draft';
    IF NOT public.is_admin_or_gm() THEN
      NEW.admin_deleted_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: once submitted, always submitted
  NEW.was_submitted := COALESCE(OLD.was_submitted, false)
                    OR COALESCE(NEW.was_submitted, false)
                    OR COALESCE(NEW.status, 'draft') <> 'draft';

  -- Only admins may change the admin deletion stamp
  IF NOT public.is_admin_or_gm() THEN
    NEW.admin_deleted_at := OLD.admin_deleted_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_story_deletion_fields ON public.user_stories;
CREATE TRIGGER trg_guard_user_story_deletion_fields
  BEFORE INSERT OR UPDATE ON public.user_stories
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_story_deletion_fields();

-- 3. Users can no longer hard-delete their own stories ───────────────────
DROP POLICY IF EXISTS "stories_delete_own" ON public.user_stories;
DROP POLICY IF EXISTS "Users can CRUD own stories" ON public.user_stories;
-- (stories_select_own / stories_insert / stories_update_own remain.)
-- (Admin policies stories_*_admin remain; admins may still DELETE — the app
--  only does so from the Deleted tab's "Delete Forever" button.)

-- 4. Removed stories are never public ─────────────────────────────────────
DROP POLICY IF EXISTS "stories_select_published" ON public.user_stories;
CREATE POLICY "stories_select_published" ON public.user_stories
  FOR SELECT TO public
  USING (status = 'published' AND user_deleted_at IS NULL AND admin_deleted_at IS NULL);

-- 5. Daily 30-day cleanup (04:00 UTC) ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_deleted_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.official_stories
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days';

  DELETE FROM public.user_stories
    WHERE was_submitted = false
      AND COALESCE(admin_deleted_at, user_deleted_at) IS NOT NULL
      AND COALESCE(admin_deleted_at, user_deleted_at) < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.purge_deleted_stories() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('purge-deleted-stories', '0 4 * * *', 'SELECT public.purge_deleted_stories();');
