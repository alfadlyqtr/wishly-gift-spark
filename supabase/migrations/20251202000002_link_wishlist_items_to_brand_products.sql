-- Link wishlist_items to brand_products for analytics tracking
-- This allows brands to see when their products are added to wishlists

-- 1. Add brand_product_id column to wishlist_items
ALTER TABLE public.wishlist_items 
ADD COLUMN IF NOT EXISTS brand_product_id UUID REFERENCES public.brand_products(id) ON DELETE SET NULL;

-- 2. Add index for performance
CREATE INDEX IF NOT EXISTS idx_wishlist_items_brand_product_id 
ON public.wishlist_items(brand_product_id);

-- 3. Add comment
COMMENT ON COLUMN public.wishlist_items.brand_product_id IS 'Links wishlist item to a brand product for analytics tracking';

-- Note: Existing wishlist items will have NULL brand_product_id
-- New items added from Explore will populate this field
