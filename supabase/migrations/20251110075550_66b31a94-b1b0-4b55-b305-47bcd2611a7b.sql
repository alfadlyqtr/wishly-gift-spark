-- ========================================
-- WISHLY RLS POLICIES: Standard Users vs. Verified Brands
-- ========================================

-- ========= 1. ADD is_brand FLAG TO user_profiles =========
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_brand BOOLEAN DEFAULT FALSE;

-- Create index for brand queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_brand ON public.user_profiles(is_brand) WHERE is_brand = TRUE;

-- ========= 2. UPDATE user_profiles RLS POLICIES =========
-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view all profiles." ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.user_profiles;

-- All authenticated users can view profiles
CREATE POLICY "All authenticated users can view profiles."
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can insert their own profile (as standard user by default)
CREATE POLICY "Users can insert their own profile."
  ON public.user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id AND
    is_brand = FALSE  -- New users default to standard user
  );

-- Users can update their own profile (but cannot change is_brand themselves)
CREATE POLICY "Users can update their own profile."
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from self-promoting to brand status
    is_brand = (SELECT is_brand FROM public.user_profiles WHERE id = auth.uid())
  );

-- Only admins can promote users to brand status (via service role)
CREATE POLICY "Service role can manage brand status."
  ON public.user_profiles FOR UPDATE
  USING (auth.role() = 'service_role');

-- ========= 3. UPDATE stores RLS POLICIES =========
DROP POLICY IF EXISTS "All users can view stores" ON public.stores;
DROP POLICY IF EXISTS "Owners can manage their stores" ON public.stores;

-- All authenticated users can view stores
CREATE POLICY "All authenticated users can view stores."
  ON public.stores FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only verified brands can create stores
CREATE POLICY "Verified brands can create stores."
  ON public.stores FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_brand = TRUE
    )
  );

-- Store owners (who are brands) can update their stores
CREATE POLICY "Store owners can update their stores."
  ON public.stores FOR UPDATE
  USING (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_brand = TRUE
    )
  );

-- Store owners can delete their stores
CREATE POLICY "Store owners can delete their stores."
  ON public.stores FOR DELETE
  USING (auth.uid() = owner_id);

-- ========= 4. UPDATE store_items RLS POLICIES (CRITICAL) =========
DROP POLICY IF EXISTS "All users can view store items" ON public.store_items;
DROP POLICY IF EXISTS "Store owners can manage their items" ON public.store_items;

-- All authenticated users can view store items (catalog browsing)
CREATE POLICY "All authenticated users can view store items."
  ON public.store_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- CRITICAL: Only the brand who owns the store can INSERT items
CREATE POLICY "Brand owners can create items in their stores."
  ON public.store_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_items.store_id
        AND stores.owner_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_brand = TRUE
    )
  );

-- CRITICAL: Only the brand who owns the store can UPDATE items
CREATE POLICY "Brand owners can update items in their stores."
  ON public.store_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_items.store_id
        AND stores.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_items.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- CRITICAL: Only the brand who owns the store can DELETE items
CREATE POLICY "Brand owners can delete items in their stores."
  ON public.store_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = store_items.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- ========= 5. ADD ANONYMOUS FLAG TO wishlist_reservations =========
ALTER TABLE public.wishlist_reservations
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Rename user_id to reserved_by_id for clarity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wishlist_reservations'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.wishlist_reservations
    RENAME COLUMN user_id TO reserved_by_id;
  END IF;
END $$;

-- ========= 6. UPDATE wishlist_reservations RLS POLICIES =========
DROP POLICY IF EXISTS "Users can only see their own reservations." ON public.wishlist_reservations;
DROP POLICY IF EXISTS "Users can create a reservation." ON public.wishlist_reservations;
DROP POLICY IF EXISTS "Users can cancel their own reservation." ON public.wishlist_reservations;

-- Users can see their own reservations
CREATE POLICY "Users can see their own reservations."
  ON public.wishlist_reservations FOR SELECT
  USING (auth.uid() = reserved_by_id);

-- Wishlist owners can see NON-ANONYMOUS reservations on their items
CREATE POLICY "Wishlist owners can see non-anonymous reservations."
  ON public.wishlist_reservations FOR SELECT
  USING (
    is_anonymous = FALSE AND
    EXISTS (
      SELECT 1 FROM public.wishlist_items
      JOIN public.wishlists ON wishlists.id = wishlist_items.wishlist_id
      WHERE wishlist_items.id = wishlist_reservations.item_id
        AND wishlists.user_id = auth.uid()
    )
  );

-- Users can create reservations
CREATE POLICY "Users can create reservations."
  ON public.wishlist_reservations FOR INSERT
  WITH CHECK (auth.uid() = reserved_by_id);

-- Users can update their own reservations (e.g., toggle anonymous)
CREATE POLICY "Users can update their own reservations."
  ON public.wishlist_reservations FOR UPDATE
  USING (auth.uid() = reserved_by_id)
  WITH CHECK (auth.uid() = reserved_by_id);

-- Users can delete their own reservations
CREATE POLICY "Users can delete their own reservations."
  ON public.wishlist_reservations FOR DELETE
  USING (auth.uid() = reserved_by_id);

-- ========= 7. VERIFY wishlists RLS POLICIES =========
-- These should already be correct from previous migration, but let's ensure they're optimal

DROP POLICY IF EXISTS "Users can manage their own wishlists." ON public.wishlists;
DROP POLICY IF EXISTS "All authenticated users can see 'public' lists." ON public.wishlists;
DROP POLICY IF EXISTS "Accepted followers can see 'friends_only' lists." ON public.wishlists;

-- Owners can manage their own wishlists
CREATE POLICY "Users can manage their own wishlists."
  ON public.wishlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public wishlists are visible to all authenticated users
CREATE POLICY "All authenticated users can see public wishlists."
  ON public.wishlists FOR SELECT
  USING (privacy_level = 'public');

-- Friends-only wishlists are visible to accepted followers
CREATE POLICY "Accepted followers can see friends-only wishlists."
  ON public.wishlists FOR SELECT
  USING (
    privacy_level = 'friends_only' AND
    EXISTS (
      SELECT 1 FROM public.followers
      WHERE followers.user_id = auth.uid()
        AND followers.following_id = wishlists.user_id
        AND followers.status = 'accepted'
    )
  );

-- Private wishlists are only visible to owner (covered by first policy)

-- ========= 8. VERIFY wishlist_items RLS POLICIES =========
DROP POLICY IF EXISTS "Users can manage items on their own wishlists." ON public.wishlist_items;
DROP POLICY IF EXISTS "Users can view items on public wishlists." ON public.wishlist_items;

-- Owners can manage items on their wishlists
CREATE POLICY "Users can manage their wishlist items."
  ON public.wishlist_items FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM public.wishlists
      WHERE wishlists.id = wishlist_items.wishlist_id
    )
  );

-- Users can view items on public wishlists
CREATE POLICY "Users can view items on public wishlists."
  ON public.wishlist_items FOR SELECT
  USING (
    (SELECT privacy_level FROM public.wishlists WHERE id = wishlist_items.wishlist_id) = 'public'
  );

-- Users can view items on friends-only wishlists if they're accepted followers
CREATE POLICY "Accepted followers can view items on friends-only wishlists."
  ON public.wishlist_items FOR SELECT
  USING (
    (SELECT privacy_level FROM public.wishlists WHERE id = wishlist_items.wishlist_id) = 'friends_only' AND
    EXISTS (
      SELECT 1 FROM public.followers
      JOIN public.wishlists ON wishlists.user_id = followers.following_id
      WHERE followers.user_id = auth.uid()
        AND wishlists.id = wishlist_items.wishlist_id
        AND followers.status = 'accepted'
    )
  );

-- ========= 9. VERIFY followers RLS POLICIES =========
-- Already correct from previous migration, just documenting
-- Policies allow authenticated users to view relationships, but only manage their own

-- ========= 10. CREATE HELPER VIEW FOR BRANDS =========
CREATE OR REPLACE VIEW public.verified_brands AS
SELECT 
  up.id,
  up.username,
  up.full_name,
  up.avatar_url,
  up.is_brand,
  up.created_at,
  s.id as store_id,
  s.store_name,
  s.is_verified as store_verified,
  s.logo_url as store_logo
FROM public.user_profiles up
LEFT JOIN public.stores s ON s.owner_id = up.id
WHERE up.is_brand = TRUE;

-- Grant access to view
GRANT SELECT ON public.verified_brands TO authenticated;