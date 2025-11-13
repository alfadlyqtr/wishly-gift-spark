-- Add 'desire' (0..5) and 'brand' columns to wishlist_items if they don't exist
DO $$
BEGIN
  -- desire column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wishlist_items' AND column_name = 'desire'
  ) THEN
    ALTER TABLE public.wishlist_items
      ADD COLUMN desire integer DEFAULT 3;
  END IF;

  -- check constraint for desire
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wishlist_items_desire_check'
  ) THEN
    ALTER TABLE public.wishlist_items
      ADD CONSTRAINT wishlist_items_desire_check CHECK (desire BETWEEN 0 AND 5);
  END IF;

  -- brand column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wishlist_items' AND column_name = 'brand'
  ) THEN
    ALTER TABLE public.wishlist_items
      ADD COLUMN brand text;
  END IF;
END
$$;
