-- Create brand_products table
CREATE TABLE IF NOT EXISTS public.brand_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  product_url TEXT, -- External link to brand's store
  category TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_brand_product UNIQUE(brand_id, name)
);

-- Enable RLS
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view active products from public brands
CREATE POLICY "View active products from public brands"
  ON public.brand_products FOR SELECT
  USING (
    status = 'active' AND
    EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND is_public = TRUE)
  );

-- Brand owners can view all their products
CREATE POLICY "Brand owners can view all their products"
  ON public.brand_products FOR SELECT
  USING (
    brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid())
  );

-- Brand owners can insert products
CREATE POLICY "Brand owners can insert products"
  ON public.brand_products FOR INSERT
  WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Brand owners can update their products
CREATE POLICY "Brand owners can update their products"
  ON public.brand_products FOR UPDATE
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Brand owners can delete their products
CREATE POLICY "Brand owners can delete their products"
  ON public.brand_products FOR DELETE
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_products_brand_id ON public.brand_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_status ON public.brand_products(status);
CREATE INDEX IF NOT EXISTS idx_brand_products_category ON public.brand_products(category);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_brand_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_brand_products_updated_at
  BEFORE UPDATE ON public.brand_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_brand_products_updated_at();

-- Enable realtime
ALTER TABLE public.brand_products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_products;
