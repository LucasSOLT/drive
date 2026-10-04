-- Draft / offline episodes must not be readable by the public.
--
-- Problem: the live database has a SELECT policy "official_select" on public.official_stories whose
-- condition is simply `true`, so anyone holding the (public) anon key can read EVERY row, including
-- drafts and offline episodes (their pages, audio and dialogue). The app already hides non-live
-- episodes in its screens, but the database itself would still hand them over.
--
-- Fix: drop that open policy. What remains is already correct:
--   * "Anyone can read live officials"      -> public sees only status = 'live'
--   * "Admins full access to officials"     -> admins / game masters see and edit everything
--
-- NOT APPLIED AUTOMATICALLY. Review, then run once in the Supabase SQL editor.
-- Rollback (restores the old behaviour):
--   create policy "official_select" on public.official_stories for select using (true);

begin;

-- Safety net: make sure the two policies we rely on exist before removing the open one.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'official_stories' and policyname = 'Anyone can read live officials') then
    create policy "Anyone can read live officials"
      on public.official_stories for select
      using (status = 'live');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'official_stories' and policyname = 'official_select_admin') then
    create policy "official_select_admin"
      on public.official_stories for select to authenticated
      using (public.is_admin_or_gm());
  end if;
end $$;

drop policy if exists "official_select" on public.official_stories;

commit;
