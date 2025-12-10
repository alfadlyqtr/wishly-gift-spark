-- Add last_active_at column to user_profiles for real-time presence tracking
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient querying of online users
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active_at 
ON user_profiles(last_active_at DESC NULLS LAST);

-- Allow users to update their own last_active_at
CREATE POLICY "Users can update own last_active_at"
ON user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
