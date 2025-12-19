-- Create support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON public.support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at DESC);
-- RLS Policies
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
-- Allow users to insert their own support messages
CREATE POLICY "Users can create support messages" ON public.support_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);
-- Allow users to read their own support messages (for cooldown check)
CREATE POLICY "Users can read own support messages" ON public.support_messages
FOR SELECT
USING (
  auth.uid() = user_id
);
-- Allow admin to read all support messages
CREATE POLICY "Admins can read all support messages" ON public.support_messages
FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);
-- Allow admin to update support message status
CREATE POLICY "Admins can update support messages" ON public.support_messages
FOR UPDATE
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);
-- Allow admin to delete support messages
CREATE POLICY "Admins can delete support messages" ON public.support_messages
FOR DELETE
USING (
  auth.jwt() ->> 'email' = 'admin@tmw.qa'
);
-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger to auto-update updated_at
CREATE TRIGGER handle_support_messages_updated_at
  BEFORE UPDATE ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
