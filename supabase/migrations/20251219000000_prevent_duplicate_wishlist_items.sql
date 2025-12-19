-- Prevent users from adding the same product / URL twice to the same wishlist
-- Option A:
-- 1) Brand product-backed items: unique (wishlist_id, brand_product_id) where brand_product_id is not null
-- 2) URL-backed items: unique (wishlist_id, coalesce(url, item_url)) where coalesce(url, item_url) is not null

-- 0) Cleanup existing duplicates so unique indexes can be created
-- Keep the row with the smallest UUID (deterministic) per duplicate group.

-- Dedupe brand product-backed items
DELETE FROM public.wishlist_items wi
USING public.wishlist_items wi_keep
WHERE wi.brand_product_id IS NOT NULL
  AND wi_keep.brand_product_id IS NOT NULL
  AND wi.wishlist_id = wi_keep.wishlist_id
  AND wi.brand_product_id = wi_keep.brand_product_id
  AND wi.id > wi_keep.id;

-- Dedupe URL-backed items (canonical URL = coalesce(url, item_url))
DELETE FROM public.wishlist_items wi
USING public.wishlist_items wi_keep
WHERE COALESCE(wi.url, wi.item_url) IS NOT NULL
  AND COALESCE(wi_keep.url, wi_keep.item_url) IS NOT NULL
  AND wi.wishlist_id = wi_keep.wishlist_id
  AND COALESCE(wi.url, wi.item_url) = COALESCE(wi_keep.url, wi_keep.item_url)
  AND wi.id > wi_keep.id;

-- 1) Enforce uniqueness for brand products per wishlist
CREATE UNIQUE INDEX IF NOT EXISTS ux_wishlist_items_wishlist_brand_product
  ON public.wishlist_items (wishlist_id, brand_product_id)
  WHERE brand_product_id IS NOT NULL;

-- 2) Enforce uniqueness for URLs per wishlist
CREATE UNIQUE INDEX IF NOT EXISTS ux_wishlist_items_wishlist_canonical_url
  ON public.wishlist_items (wishlist_id, (COALESCE(url, item_url)))
  WHERE COALESCE(url, item_url) IS NOT NULL;
