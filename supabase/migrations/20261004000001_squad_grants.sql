-- Squad system was unusable: RLS policies existed, but the `authenticated` / `anon` roles had NO
-- table privileges on squads, squad_members, squad_sessions and sparc_responses, so every query
-- failed with "permission denied for table ..." (shown in the app as "Failed to initialize squad").

GRANT SELECT, INSERT, UPDATE ON public.squads         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.squad_members  TO authenticated;
GRANT DELETE                 ON public.squad_members  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.squad_sessions TO authenticated;
GRANT SELECT, INSERT         ON public.sparc_responses TO authenticated;

-- Logged-out visitors opening an invite link need to be able to look the squad up
GRANT SELECT ON public.squads          TO anon;
GRANT SELECT ON public.squad_members   TO anon;
GRANT SELECT ON public.squad_sessions  TO anon;
GRANT SELECT ON public.sparc_responses TO anon;

-- Leaving a squad: users may remove their own membership row (previously no DELETE policy existed,
-- so leaveSquad() would silently delete nothing)
DROP POLICY IF EXISTS "Members can leave squads" ON public.squad_members;
CREATE POLICY "Members can leave squads" ON public.squad_members
  FOR DELETE USING (auth.uid() = user_id);

-- One membership row per user per squad (joinSquadByCode relied on this but it did not exist)
DELETE FROM public.squad_members a
  USING public.squad_members b
  WHERE a.squad_id = b.squad_id AND a.user_id = b.user_id AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS squad_members_squad_user_uniq
  ON public.squad_members (squad_id, user_id);
