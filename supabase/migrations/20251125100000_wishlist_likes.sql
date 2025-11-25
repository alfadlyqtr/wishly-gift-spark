-- Create wishlist_likes table for per-user likes on wishlists
create table if not exists public.wishlist_likes (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (wishlist_id, user_id)
);

alter table public.wishlist_likes enable row level security;

create policy "Anyone can read wishlist_likes"
  on public.wishlist_likes
  for select
  using (true);

create policy "Users can insert own wishlist likes"
  on public.wishlist_likes
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own wishlist likes"
  on public.wishlist_likes
  for delete
  using (auth.uid() = user_id);
