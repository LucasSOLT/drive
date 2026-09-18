-- ═══════════════════════════════════════════════════════════
-- DRiVE Content Slot Overrides Migration
-- Allows admins to assign or remove stories from specific tiles
-- (Featured, Best-Selling, Explore) across ALL devices.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.content_slot_overrides (
  slot_key text PRIMARY KEY,      -- e.g. 'home-featured_0', 'home-bestselling_1', 'explore-grid_2'
  story_id text,                  -- UUID or story ID; NULL means explicitly empty / removed
  updated_at timestamptz DEFAULT now()
);

-- Ensure permissions are granted to PostgREST roles
GRANT ALL ON TABLE public.content_slot_overrides TO anon, authenticated, service_role;

ALTER TABLE public.content_slot_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_slot_overrides' AND policyname = 'Anyone can read slot overrides') THEN
    CREATE POLICY "Anyone can read slot overrides" ON public.content_slot_overrides FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_slot_overrides' AND policyname = 'Anyone can modify slot overrides') THEN
    CREATE POLICY "Anyone can modify slot overrides" ON public.content_slot_overrides FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_slot_overrides_key ON public.content_slot_overrides(slot_key);
