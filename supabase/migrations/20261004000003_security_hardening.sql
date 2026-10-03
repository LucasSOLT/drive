-- Security hardening: close three privilege-escalation holes.
-- Admin/GM flows are unaffected (they keep their own policies / bypass the guard).

-- 1) official_stories: any authenticated user could insert official stories.
--    Admin/GM inserts remain allowed via "official_insert_admin".
drop policy if exists "Allow authenticated insert" on public.official_stories;

-- 2) user_stories: users could self-publish via stories_update_own (admin_deleted_at was already guarded by trg_guard_user_story_deletion_fields).
--    RLS can't compare OLD vs NEW, so use a trigger. Only enforced for end users
--    (authenticated/anon); admins/GMs and service-role/migrations pass through.
create or replace function public.guard_user_story_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.is_admin_or_gm() then
    if new.status = 'published' and old.status is distinct from 'published' then
      raise exception 'Only an admin can publish a story' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_user_story_update on public.user_stories;
create trigger trg_guard_user_story_update
  before update on public.user_stories
  for each row execute function public.guard_user_story_update();

-- 3) Squads: any authenticated user could update ANY squad / member / session row,
--    or insert members as someone else.

-- squads
drop policy if exists "Authenticated can create squads" on public.squads;
create policy "Users can create own squads" on public.squads
  for insert to authenticated
  with check (auth.uid() = driver_id);

drop policy if exists "Authenticated can update squads" on public.squads;
create policy "Members can update their squad" on public.squads
  for update to authenticated
  using (
    driver_id = auth.uid()
    or exists (select 1 from public.squad_members sm where sm.squad_id = squads.id and sm.user_id = auth.uid())
  )
  with check (
    driver_id = auth.uid()
    or exists (select 1 from public.squad_members sm where sm.squad_id = squads.id and sm.user_id = auth.uid())
  );

-- squad_members: join as yourself (as 'player', or 'driver' of a squad you drive);
-- a squad's driver may add others (matchmaking). Update only your own row.
drop policy if exists "Authenticated can join squads" on public.squad_members;
create policy "Users can join squads as themselves" on public.squad_members
  for insert to authenticated
  with check (
    exists (select 1 from public.squads s where s.id = squad_members.squad_id and s.driver_id = auth.uid())
    or (auth.uid() = user_id and role = 'player')
  );

drop policy if exists "Authenticated can update membership" on public.squad_members;
create policy "Users can update own membership" on public.squad_members
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- squad_sessions: only members of the squad can create/update its session
drop policy if exists "Authenticated can create squad sessions" on public.squad_sessions;
create policy "Members can create squad sessions" on public.squad_sessions
  for insert to authenticated
  with check (exists (select 1 from public.squad_members sm where sm.squad_id = squad_sessions.squad_id and sm.user_id = auth.uid()));

drop policy if exists "Authenticated can update squad sessions" on public.squad_sessions;
create policy "Members can update squad sessions" on public.squad_sessions
  for update to authenticated
  using (exists (select 1 from public.squad_members sm where sm.squad_id = squad_sessions.squad_id and sm.user_id = auth.uid()))
  with check (exists (select 1 from public.squad_members sm where sm.squad_id = squad_sessions.squad_id and sm.user_id = auth.uid()));
