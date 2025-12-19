-- Add auto-approve settings to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS auto_approve_claims boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approve_unclaims boolean DEFAULT false;
-- Add unclaim request tracking to wishlist_reservations
ALTER TABLE public.wishlist_reservations
  ADD COLUMN IF NOT EXISTS unclaim_requested_at timestamptz;
-- Update the status check constraint to include 'unclaim_requested'
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.wishlist_reservations 
    DROP CONSTRAINT IF EXISTS wishlist_reservations_status_check;
  
  -- Add new constraint with unclaim_requested status
  ALTER TABLE public.wishlist_reservations 
    ADD CONSTRAINT wishlist_reservations_status_check 
    CHECK (status IN ('pending','approved','declined','unclaim_requested'));
END $$;
