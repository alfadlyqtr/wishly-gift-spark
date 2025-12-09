-- Add is_verified column to brands table for verified badge feature
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Comment for clarity
COMMENT ON COLUMN brands.is_verified IS 'When true, shows verified badge on brand profile. Controlled by admin.';
