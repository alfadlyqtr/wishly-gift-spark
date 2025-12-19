-- Update existing private wishlists to public for better UX
UPDATE wishlists 
SET privacy_level = 'public' 
WHERE privacy_level = 'private';
-- Change default privacy level to 'public' instead of 'private'
ALTER TABLE wishlists 
ALTER COLUMN privacy_level SET DEFAULT 'public';
