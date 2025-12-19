-- Add last_active_at field for real-time presence tracking
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NULL;
-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active_at ON user_profiles(last_active_at);
-- Allow users to update their own last_active_at
CREATE POLICY "Users can update own last_active_at" ON user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
