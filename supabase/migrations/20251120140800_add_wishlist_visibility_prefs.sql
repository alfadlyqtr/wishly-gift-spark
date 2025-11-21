alter table public.user_profiles
  add column if not exists allow_followers_view boolean not null default false;

alter table public.user_profiles
  add column if not exists enforce_wishlist_privacy boolean not null default true;
