-- ========= 1. MODIFY 'followers' TABLE =========
-- Add a 'status' column to handle follow requests
ALTER TABLE public.followers
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted'));
-- Update RLS for 'followers'
-- We need to drop the old policies first
DROP POLICY IF EXISTS "All users can view follower relationships." ON public.followers;
DROP POLICY IF EXISTS "Users can manage their own follow relationships." ON public.followers;
-- NEW RLS FOR 'followers':
-- A user can see their own follow requests and accepted followers
CREATE POLICY "Users can see their own follower relationships."
  ON public.followers FOR SELECT
  USING ( auth.uid() = user_id OR auth.uid() = following_id );
-- A user can create a 'pending' follow request
CREATE POLICY "Users can request to follow others."
  ON public.followers FOR INSERT
  WITH CHECK ( auth.uid() = user_id AND status = 'pending' );
-- A user can delete their own follow request, or remove a follower
CREATE POLICY "Users can delete follower relationships."
  ON public.followers FOR DELETE
  USING ( auth.uid() = user_id OR auth.uid() = following_id );
-- The user BEING FOLLOWED is the only one who can 'accept' a request
CREATE POLICY "Users can accept follower requests."
  ON public.followers FOR UPDATE
  USING ( auth.uid() = following_id )
  WITH CHECK ( status = 'accepted' );
-- ========= 2. UPDATE 'wishlists' RLS (The Critical Fix) =========
-- Drop the old 'public' policy so we can add the new 'friends_only' one
DROP POLICY IF EXISTS "Users can view public wishlists." ON public.wishlists;
-- NEW RLS FOR 'wishlists':
-- Policy 1: The owner can always do anything
DROP POLICY IF EXISTS "Users can manage their own wishlists." ON public.wishlists;
CREATE POLICY "Users can manage their own wishlists."
  ON public.wishlists FOR ALL
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );
-- Policy 2: Anyone can see 'public' lists
CREATE POLICY "All authenticated users can see 'public' lists."
  ON public.wishlists FOR SELECT
  USING ( privacy_level = 'public' );
-- Policy 3: (THE NEW LOGIC) Only 'accepted' followers can see 'friends_only' lists
CREATE POLICY "Accepted followers can see 'friends_only' lists."
  ON public.wishlists FOR SELECT
  USING (
    privacy_level = 'friends_only' AND
    EXISTS (
      SELECT 1 FROM public.followers
      WHERE
        followers.user_id = auth.uid() AND
        followers.following_id = public.wishlists.user_id AND
        followers.status = 'accepted'
    )
  );
