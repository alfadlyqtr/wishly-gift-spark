-- Add admin_master_control field to user_profiles
-- When TRUE, admin settings override user settings and user cannot change them
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS admin_master_control BOOLEAN DEFAULT FALSE;
-- Add admin override fields for each setting
-- These store what the admin wants when master control is ON
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS admin_override_settings JSONB DEFAULT NULL;
-- Comment explaining the field
COMMENT ON COLUMN user_profiles.admin_master_control IS 'When TRUE, admin settings override user settings';
COMMENT ON COLUMN user_profiles.admin_override_settings IS 'JSON object storing admin override values for user settings';
