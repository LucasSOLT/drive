-- SPARC integrity: stop user_id spoofing, require squad membership to post, cap content size.
-- Reads stay public (unchanged).

-- Responses: must be yourself AND a member of the squad you post to
drop policy if exists "Authenticated can submit SPARC responses" on public.sparc_responses;
create policy "Members can submit SPARC responses" on public.sparc_responses
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.squad_members sm
      where sm.squad_id = sparc_responses.squad_id
        and sm.user_id = auth.uid()
    )
  );

-- Replies: must be yourself
drop policy if exists "Authenticated can add replies" on public.sparc_replies;
create policy "Users can add own replies" on public.sparc_replies
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Reactions: must be yourself
drop policy if exists "Authenticated can add reactions" on public.sparc_reactions;
create policy "Users can add own reactions" on public.sparc_reactions
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Size caps (NOT VALID so any existing rows are left alone; new rows are enforced)
alter table public.sparc_replies drop constraint if exists sparc_replies_content_len;
alter table public.sparc_replies add constraint sparc_replies_content_len
  check (char_length(content) <= 1000) not valid;

alter table public.sparc_responses drop constraint if exists sparc_responses_content_len;
alter table public.sparc_responses add constraint sparc_responses_content_len
  check (char_length(content) <= 10000) not valid;
