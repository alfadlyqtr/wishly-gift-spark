-- Create user_push_devices table for OneSignal device registration
-- This matches the architecture described by the friend's working setup

CREATE TABLE IF NOT EXISTS public.user_push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  onesignal_device_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, onesignal_device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_push_devices_user_id ON public.user_push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_devices_enabled ON public.user_push_devices(user_id, enabled) WHERE enabled = TRUE;

ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON public.user_push_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all devices"
  ON public.user_push_devices FOR ALL
  USING (auth.role() = 'service_role');
