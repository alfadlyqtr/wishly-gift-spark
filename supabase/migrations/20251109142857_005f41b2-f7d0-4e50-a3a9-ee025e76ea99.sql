-- Enable pg_trgm extension for smart search (fuzzy text matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Create indexes for smart search on key text fields
CREATE INDEX IF NOT EXISTS idx_wishlist_items_title_trgm ON public.wishlist_items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_description_trgm ON public.wishlist_items USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_store_items_title_trgm ON public.store_items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username_trgm ON public.user_profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_trgm ON public.user_profiles USING gin (full_name gin_trgm_ops);