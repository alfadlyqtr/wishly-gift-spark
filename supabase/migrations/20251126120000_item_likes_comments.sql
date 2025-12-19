-- Create item_likes table for per-item likes
create table if not exists public.item_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.wishlist_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, item_id)
);
-- Create item_comments table for per-item comments
create table if not exists public.item_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.wishlist_items(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
-- Enable RLS
alter table public.item_likes enable row level security;
alter table public.item_comments enable row level security;
-- RLS policies for item_likes
create policy "Users can view item likes on public wishlists"
  on public.item_likes for select
  using (
    exists (
      select 1 from public.wishlist_items wi
      join public.wishlists w on wi.wishlist_id = w.id
      join public.user_profiles up on w.user_id = up.id
      where wi.id = item_likes.item_id
        and (up.allow_wishlist_sharing = true or w.user_id = auth.uid())
    )
  );
create policy "Users can like items on public wishlists"
  on public.item_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wishlist_items wi
      join public.wishlists w on wi.wishlist_id = w.id
      join public.user_profiles up on w.user_id = up.id
      where wi.id = item_id
        and up.allow_wishlist_sharing = true
        and up.allow_likes = true
    )
  );
create policy "Users can unlike their own item likes"
  on public.item_likes for delete
  using (auth.uid() = user_id);
-- RLS policies for item_comments
create policy "Users can view item comments on public wishlists"
  on public.item_comments for select
  using (
    exists (
      select 1 from public.wishlist_items wi
      join public.wishlists w on wi.wishlist_id = w.id
      join public.user_profiles up on w.user_id = up.id
      where wi.id = item_comments.item_id
        and (up.allow_wishlist_sharing = true or w.user_id = auth.uid())
    )
  );
create policy "Users can comment on items on public wishlists"
  on public.item_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wishlist_items wi
      join public.wishlists w on wi.wishlist_id = w.id
      join public.user_profiles up on w.user_id = up.id
      where wi.id = item_id
        and up.allow_wishlist_sharing = true
        and up.allow_comments = true
    )
  );
create policy "Users can delete their own item comments"
  on public.item_comments for delete
  using (auth.uid() = user_id);
-- Create indexes for performance
create index if not exists idx_item_likes_item_id on public.item_likes(item_id);
create index if not exists idx_item_likes_user_id on public.item_likes(user_id);
create index if not exists idx_item_comments_item_id on public.item_comments(item_id);
create index if not exists idx_item_comments_user_id on public.item_comments(user_id);
