-- ═══════════════════════════════════════════════════════════
-- DRiVE: Squads & Squad Members Migration
-- Creates: squads, squad_members tables with RLS policies
-- ═══════════════════════════════════════════════════════════

-- 1. SQUADS TABLE
CREATE TABLE IF NOT EXISTS public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  story_id text,
  name text NOT NULL DEFAULT 'DRiVE Squad',
  invite_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'forming', -- 'forming' | 'active' | 'completed'
  min_size integer NOT NULL DEFAULT 3,
  max_size integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- 2. SQUAD MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'player', -- 'driver' | 'player'
  joined_at timestamptz DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR SQUADS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone authenticated can read forming or joined squads') THEN
    CREATE POLICY "Anyone authenticated can read forming or joined squads" ON public.squads
      FOR SELECT TO authenticated
      USING (
        status = 'forming' OR
        driver_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = squads.id AND user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'DRIVER can update own squad') THEN
    CREATE POLICY "DRIVER can update own squad" ON public.squads
      FOR UPDATE TO authenticated
      USING (driver_id = auth.uid())
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create squads') THEN
    CREATE POLICY "Users can create squads" ON public.squads
      FOR INSERT TO authenticated
      WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

-- 4. RLS POLICIES FOR SQUAD MEMBERS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can read squad member list') THEN
    CREATE POLICY "Members can read squad member list" ON public.squad_members
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.squads WHERE id = squad_members.squad_id AND (driver_id = auth.uid() OR status = 'forming'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can join squads') THEN
    CREATE POLICY "Authenticated users can join squads" ON public.squad_members
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can leave or DRIVER can remove members') THEN
    CREATE POLICY "Members can leave or DRIVER can remove members" ON public.squad_members
      FOR DELETE TO authenticated
      USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.squads WHERE id = squad_members.squad_id AND driver_id = auth.uid())
      );
  END IF;
END $$;
