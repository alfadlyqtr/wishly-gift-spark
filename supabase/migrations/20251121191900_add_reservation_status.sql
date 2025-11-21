-- Add status tracking to wishlist_reservations so owners can approve or decline claims
ALTER TABLE public.wishlist_reservations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Allow wishlist owners to update/delete reservations on their items (in addition to the reserver)
CREATE POLICY IF NOT EXISTS "Wishlist owners can update reservations"
  ON public.wishlist_reservations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.id = wishlist_reservations.item_id
        AND w.user_id = auth.uid()
    )
    OR auth.uid() = reserved_by_id
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.id = wishlist_reservations.item_id
        AND w.user_id = auth.uid()
    )
    OR auth.uid() = reserved_by_id
  );

CREATE POLICY IF NOT EXISTS "Wishlist owners can delete reservations"
  ON public.wishlist_reservations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.id = wishlist_reservations.item_id
        AND w.user_id = auth.uid()
    )
    OR auth.uid() = reserved_by_id
  );

-- Ensure owners can read reservations on their wishlists (needed for approvals)
DROP POLICY IF EXISTS "Wishlist owners can see non-anonymous reservations." ON public.wishlist_reservations;

CREATE POLICY IF NOT EXISTS "Wishlist owners can view reservations"
  ON public.wishlist_reservations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.id = wishlist_reservations.item_id
        AND w.user_id = auth.uid()
    )
    OR auth.uid() = reserved_by_id
  );
