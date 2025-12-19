-- Add url column to wishlist_items table
-- This allows storing product URLs for wishlist items

ALTER TABLE wishlist_items 
ADD COLUMN IF NOT EXISTS url TEXT;
-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wishlist_items_url ON wishlist_items(url);
-- Add comment
COMMENT ON COLUMN wishlist_items.url IS 'Product URL link for the wishlist item';
