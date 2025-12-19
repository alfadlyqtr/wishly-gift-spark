-- Message reactions table: one reaction per user per message
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),

  constraint message_reactions_message_user_unique unique (message_id, user_id)
);
-- Basic RLS: users can see reactions on any message they can see,
-- and can only insert/update/delete their own reaction rows.
alter table public.message_reactions enable row level security;
create policy "Select reactions for visible messages" on public.message_reactions
  for select
  using (
    exists (
      select 1
      from public.messages m
      join public.thread_participants tp on tp.thread_id = m.thread_id
      where m.id = message_reactions.message_id
        and tp.user_id = auth.uid()
    )
  );
create policy "Insert own reactions" on public.message_reactions
  for insert
  with check (user_id = auth.uid());
create policy "Update own reactions" on public.message_reactions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Delete own reactions" on public.message_reactions
  for delete
  using (user_id = auth.uid());
