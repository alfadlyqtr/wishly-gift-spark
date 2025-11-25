-- Comments on wishlists (Instagram-style), visible to whoever can see the wishlist card
create table if not exists public.wishlist_comments (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz not null default now()
);

alter table public.wishlist_comments enable row level security;

create policy "Anyone can read wishlist_comments"
  on public.wishlist_comments
  for select
  using (true);

create policy "Users can insert own wishlist comments"
  on public.wishlist_comments
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own wishlist comments"
  on public.wishlist_comments
  for delete
  using (auth.uid() = user_id);
