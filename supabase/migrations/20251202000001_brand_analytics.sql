-- Brand Analytics Tables
-- Track product views, wishlist adds, and user engagement for brand dashboard

-- 1. Product Views Tracking
CREATE TABLE IF NOT EXISTS public.brand_product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.brand_products(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT, -- 'explore', 'wishlist', 'direct', etc.
  
  -- Indexes for performance
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_product_views_product_id ON public.brand_product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_brand_product_views_viewed_at ON public.brand_product_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_brand_product_views_viewer_id ON public.brand_product_views(viewer_id);

-- 2. Wishlist Adds Tracking (link to existing wishlist_items)
-- We'll use the existing wishlist_items table but add a view to track brand products

-- 3. Enable RLS
ALTER TABLE public.brand_product_views ENABLE ROW LEVEL SECURITY;

-- Brand owners can see their own product views
CREATE POLICY "Brand owners can view their product analytics"
  ON public.brand_product_views
  FOR SELECT
  USING (
    product_id IN (
      SELECT bp.id 
      FROM public.brand_products bp
      JOIN public.brands b ON b.id = bp.brand_id
      WHERE b.user_id = auth.uid()
    )
  );

-- Anyone can insert views (for tracking)
CREATE POLICY "Anyone can track product views"
  ON public.brand_product_views
  FOR INSERT
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.brand_product_views IS 'Tracks when users view brand products in Explore or elsewhere';
COMMENT ON COLUMN public.brand_product_views.source IS 'Where the view came from: explore, wishlist, direct, etc.';
