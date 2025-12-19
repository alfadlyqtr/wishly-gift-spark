-- Add whatsapp and store_locations columns to brands table
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS store_locations TEXT[];
-- Remove return_policy column if it exists
ALTER TABLE brands 
DROP COLUMN IF EXISTS return_policy;
-- Add comment
COMMENT ON COLUMN brands.whatsapp IS 'WhatsApp phone number for the brand';
COMMENT ON COLUMN brands.store_locations IS 'Array of Google Maps links for physical store locations';
