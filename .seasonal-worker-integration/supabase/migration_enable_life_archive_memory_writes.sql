-- Phase 4: allow verified owners to create and delete only memories belonging
-- to their own pet and selected Soul Trace submission. Editing is intentionally
-- deferred; no UPDATE policy is granted.

drop policy if exists "Owners can create their archive memories"
  on public.life_archive_memories;
create policy "Owners can create their archive memories"
on public.life_archive_memories for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
      from public.soul_trace_submissions submissions
     where submissions.submission_id = life_archive_memories.submission_id
       and submissions.pet_id = life_archive_memories.pet_id
       and submissions.owner_user_id = auth.uid()
  )
);

drop policy if exists "Owners can delete their archive memories"
  on public.life_archive_memories;
create policy "Owners can delete their archive memories"
on public.life_archive_memories for delete to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1
      from public.soul_trace_submissions submissions
     where submissions.submission_id = life_archive_memories.submission_id
       and submissions.pet_id = life_archive_memories.pet_id
       and submissions.owner_user_id = auth.uid()
  )
);

comment on table public.life_archive_memories is
  'New owner-written memories. Text is stored exactly as entered and is never automatically translated.';
