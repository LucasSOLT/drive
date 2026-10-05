-- Draft / offline episodes must not be readable by the public.
--
-- Problem: the live database has THREE open SELECT policies on public.official_stories, each with the
-- condition `true`:
--     "Anyone can read official stories"   (anon, authenticated)
--     "Public can view official stories"   (public)
--     "official_select"                    (public)
-- so anyone holding the (public) anon key can read EVERY row, including drafts and offline episodes
-- (their pages, audio and dialogue). The app hides non-live episodes in its screens, but the database
-- itself would still hand them over. Policies are OR-ed together, so ALL three must go.
--
-- Fix: drop the three open policies and keep exactly two SELECT policies:
--   * "Anyone can read live officials"   -> public sees only status = 'live'
--   * "official_select_admin"            -> admins / game masters see everything
-- (INSERT / UPDATE / DELETE admin policies are untouched.)
--
-- Rollback (restores the old behaviour):
--   create policy "official_select" on public.official_stories for select using (true);

begin;

drop policy if exists "Anyone can read live officials" on public.official_stories;
create policy "Anyone can read live officials"
  on public.official_stories for select
  using (status = 'live');

drop policy if exists "official_select_admin" on public.official_stories;
create policy "official_select_admin"
  on public.official_stories for select to authenticated
  using (public.is_admin_or_gm());

drop policy if exists "Anyone can read official stories" on public.official_stories;
drop policy if exists "Public can view official stories" on public.official_stories;
drop policy if exists "official_select" on public.official_stories;

commit;
