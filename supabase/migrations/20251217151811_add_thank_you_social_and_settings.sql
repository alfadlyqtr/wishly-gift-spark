-- Add thank you visibility setting + comments

-- 1) Profile setting to allow thank-you posts in friend activity
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS allow_thank_you_posts BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) Comments on thank-you posts
CREATE TABLE IF NOT EXISTS public.thank_you_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.thank_you_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.thank_you_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read thank_you_comments"
  ON public.thank_you_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own thank_you_comments"
  ON public.thank_you_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own thank_you_comments"
  ON public.thank_you_comments
  FOR DELETE
  USING (auth.uid() = user_id);;
