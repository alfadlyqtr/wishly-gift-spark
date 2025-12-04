-- Add new brand-level settings for product card features
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS allow_questions BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_likes BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_store_link BOOLEAN DEFAULT TRUE;
