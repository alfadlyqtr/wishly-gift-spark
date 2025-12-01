-- Brand-level product visibility and add-as-item modes
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS products_find_mode TEXT DEFAULT 'per_product' CHECK (products_find_mode IN ('all_off', 'all_on', 'per_product')),
ADD COLUMN IF NOT EXISTS products_add_mode TEXT DEFAULT 'per_product' CHECK (products_add_mode IN ('all_off', 'all_on', 'per_product'));

-- Per-product flags
ALTER TABLE public.brand_products
ADD COLUMN IF NOT EXISTS is_findable BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_add_as_item BOOLEAN DEFAULT TRUE;
