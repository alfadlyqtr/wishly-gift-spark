-- Add suspension fields to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspension_message TEXT,
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
-- Create index for quick lookup of suspended users
CREATE INDEX IF NOT EXISTS idx_user_profiles_suspended ON public.user_profiles(is_suspended) WHERE is_suspended = TRUE;
COMMENT ON COLUMN public.user_profiles.is_suspended IS 'Whether the user account is currently suspended';
COMMENT ON COLUMN public.user_profiles.suspension_message IS 'Admin message explaining why the account was suspended';
COMMENT ON COLUMN public.user_profiles.suspended_until IS 'When the suspension expires (null = indefinite)';
