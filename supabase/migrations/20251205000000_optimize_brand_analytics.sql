-- ========================================
-- OPTIMIZE BRAND ANALYTICS RPC FUNCTION
-- ========================================
-- This migration creates/replaces the brand_dashboard_analytics function
-- with an optimized version that uses proper indexing and efficient aggregation.

-- 1. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_wishlist_items_brand_product_id 
  ON public.wishlist_items(brand_product_id) 
  WHERE brand_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_id 
  ON public.brand_products(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_product_views_product_created 
  ON public.brand_product_views(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_product_likes_product_id 
  ON public.brand_product_likes(product_id) 
  WHERE product_id IS NOT NULL;

-- 2. Create or replace the optimized analytics function
CREATE OR REPLACE FUNCTION public.brand_dashboard_analytics(brand_uuid UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  adds_count BIGINT,
  wishlist_ids UUID[],
  views_count BIGINT,
  viewer_ids UUID[],
  likes_count BIGINT,
  liker_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH brand_products_cte AS (
    -- Get all products for this brand (single scan)
    SELECT bp.id, bp.name
    FROM brand_products bp
    WHERE bp.brand_id = brand_uuid
  ),
  wishlist_adds AS (
    -- Aggregate wishlist adds per product
    SELECT 
      wi.brand_product_id,
      COUNT(*)::BIGINT AS adds_count,
      ARRAY_AGG(DISTINCT wi.wishlist_id) FILTER (WHERE wi.wishlist_id IS NOT NULL) AS wishlist_ids
    FROM wishlist_items wi
    WHERE wi.brand_product_id IN (SELECT id FROM brand_products_cte)
    GROUP BY wi.brand_product_id
  ),
  product_views AS (
    -- Aggregate views per product
    SELECT 
      bpv.product_id,
      COUNT(*)::BIGINT AS views_count,
      ARRAY_AGG(DISTINCT bpv.viewer_id) FILTER (WHERE bpv.viewer_id IS NOT NULL) AS viewer_ids
    FROM brand_product_views bpv
    WHERE bpv.product_id IN (SELECT id FROM brand_products_cte)
    GROUP BY bpv.product_id
  ),
  product_likes AS (
    -- Aggregate likes per product
    SELECT 
      bpl.product_id,
      COUNT(*)::BIGINT AS likes_count,
      ARRAY_AGG(DISTINCT bpl.user_id) FILTER (WHERE bpl.user_id IS NOT NULL) AS liker_ids
    FROM brand_product_likes bpl
    WHERE bpl.product_id IN (SELECT id FROM brand_products_cte)
    GROUP BY bpl.product_id
  )
  SELECT 
    bp.id AS product_id,
    bp.name AS product_name,
    COALESCE(wa.adds_count, 0) AS adds_count,
    COALESCE(wa.wishlist_ids, ARRAY[]::UUID[]) AS wishlist_ids,
    COALESCE(pv.views_count, 0) AS views_count,
    COALESCE(pv.viewer_ids, ARRAY[]::UUID[]) AS viewer_ids,
    COALESCE(pl.likes_count, 0) AS likes_count,
    COALESCE(pl.liker_ids, ARRAY[]::UUID[]) AS liker_ids
  FROM brand_products_cte bp
  LEFT JOIN wishlist_adds wa ON wa.brand_product_id = bp.id
  LEFT JOIN product_views pv ON pv.product_id = bp.id
  LEFT JOIN product_likes pl ON pl.product_id = bp.id;
END;
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.brand_dashboard_analytics(UUID) TO authenticated;

-- 4. Add comment for documentation
COMMENT ON FUNCTION public.brand_dashboard_analytics IS 
  'Optimized aggregation function for brand dashboard analytics. 
   Uses CTEs and proper indexing to avoid N+1 queries.
   Returns per-product metrics: wishlist adds, views, and likes with user IDs.';

-- 5. Create a simpler summary function for notifications page (lighter query)
CREATE OR REPLACE FUNCTION public.brand_analytics_summary(brand_uuid UUID)
RETURNS TABLE (
  total_wishlist_adds BIGINT,
  total_views BIGINT,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH brand_product_ids AS (
    SELECT id FROM brand_products WHERE brand_id = brand_uuid
  ),
  stats AS (
    SELECT 
      (SELECT COUNT(*) FROM wishlist_items WHERE brand_product_id IN (SELECT id FROM brand_product_ids)) AS adds,
      (SELECT COUNT(*) FROM brand_product_views WHERE product_id IN (SELECT id FROM brand_product_ids)) AS views,
      (
        SELECT COUNT(DISTINCT user_id) FROM (
          SELECT viewer_id AS user_id FROM brand_product_views WHERE product_id IN (SELECT id FROM brand_product_ids) AND viewer_id IS NOT NULL
          UNION
          SELECT user_id FROM brand_product_likes WHERE product_id IN (SELECT id FROM brand_product_ids) AND user_id IS NOT NULL
        ) combined_users
      ) AS unique_users
  )
  SELECT 
    stats.adds::BIGINT,
    stats.views::BIGINT,
    stats.unique_users::BIGINT
  FROM stats;
END;
$$;

-- 6. Grant execute permission
GRANT EXECUTE ON FUNCTION public.brand_analytics_summary(UUID) TO authenticated;

COMMENT ON FUNCTION public.brand_analytics_summary IS 
  'Lightweight summary function for brand notifications page.
   Returns only aggregate totals without per-product breakdown.';
