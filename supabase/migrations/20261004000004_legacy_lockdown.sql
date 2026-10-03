-- Lock down unused legacy tables and strip dangerous table privileges the API never needs.

-- Legacy tables (empty, unused by the app) were writable by anyone, including anon.
drop policy if exists "Public insert stories" on public.stories;
drop policy if exists "Public update stories" on public.stories;
drop policy if exists "Public insert interactions" on public.story_interactions;
drop policy if exists "Public update interactions" on public.story_interactions;

-- TRUNCATE bypasses RLS; TRIGGER/REFERENCES let a role attach triggers or FKs.
-- PostgREST never needs them, so remove them from the API roles on every public table.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

-- Future tables created in public should not inherit those privileges either.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
