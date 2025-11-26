-- Add allow_likes and allow_comments preferences to user_profiles
-- These control whether wishlists can be liked or commented on globally for an owner.

alter table if exists public.user_profiles
  add column if not exists allow_likes boolean not null default true,
  add column if not exists allow_comments boolean not null default true;
