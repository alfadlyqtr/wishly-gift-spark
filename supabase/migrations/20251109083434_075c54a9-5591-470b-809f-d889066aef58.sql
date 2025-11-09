-- Create the table for public user profiles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- RLS for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles."
  ON public.user_profiles FOR SELECT
  USING ( auth.role() = 'authenticated' );

CREATE POLICY "Users can insert their own profile."
  ON public.user_profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update their own profile."
  ON public.user_profiles FOR UPDATE
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

-- This function automatically creates a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- This trigger fires the function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create wishlists table
CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  privacy_level TEXT DEFAULT 'private' CHECK (privacy_level IN ('public', 'friends_only', 'private')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for wishlists
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own wishlists."
  ON public.wishlists FOR ALL
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can view public wishlists."
  ON public.wishlists FOR SELECT
  USING ( privacy_level = 'public' );

-- Create wishlist_items table
CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  item_url TEXT,
  price NUMERIC(10, 2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reserved', 'received')),
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for wishlist_items
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage items on their own wishlists."
  ON public.wishlist_items FOR ALL
  USING ( auth.uid() = (SELECT user_id FROM public.wishlists WHERE id = wishlist_id) )
  WITH CHECK ( auth.uid() = (SELECT user_id FROM public.wishlists WHERE id = wishlist_id) );

CREATE POLICY "Users can view items on public wishlists."
  ON public.wishlist_items FOR SELECT
  USING ( (SELECT privacy_level FROM public.wishlists WHERE id = wishlist_id) = 'public' );

-- Create wishlist_reservations table (for anonymous claiming)
CREATE TABLE public.wishlist_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.wishlist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(item_id)
);

-- RLS for wishlist_reservations (CRITICAL for anonymity)
ALTER TABLE public.wishlist_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create a reservation."
  ON public.wishlist_reservations FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can only see their own reservations."
  ON public.wishlist_reservations FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can cancel their own reservation."
  ON public.wishlist_reservations FOR DELETE
  USING ( auth.uid() = user_id );

-- Create followers table
CREATE TABLE public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, following_id)
);

-- RLS for followers
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view follower relationships."
  ON public.followers FOR SELECT
  USING ( auth.role() = 'authenticated' );

CREATE POLICY "Users can manage their own follow relationships."
  ON public.followers FOR ALL
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

-- Create activities table (for the feed)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can see all activities."
  ON public.activities FOR SELECT
  USING ( auth.role() = 'authenticated' );

-- Create Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', TRUE),
  ('wishlist_images', 'wishlist_images', TRUE);

-- Policies for 'avatars' bucket
CREATE POLICY "Users can view all public avatars."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Authenticated users can upload their own avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Policies for 'wishlist_images' bucket
CREATE POLICY "Users can view all public wishlist images."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'wishlist_images' );

CREATE POLICY "Authenticated users can upload wishlist images."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'wishlist_images' AND auth.role() = 'authenticated' );

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlist_reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;