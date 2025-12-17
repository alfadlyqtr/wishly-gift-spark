-- Add-on: Gift received + thank you posts (no changes to existing claim flow)

-- 1) Mark an item as received/gifted (add-on state)
CREATE TABLE IF NOT EXISTS public.gift_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.wishlist_items(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.wishlist_reservations(id) ON DELETE SET NULL,
  recipient_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  gifter_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  gifted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(item_id)
);

ALTER TABLE public.gift_receipts ENABLE ROW LEVEL SECURITY;

-- Recipient can manage their receipts
CREATE POLICY "Recipients can manage their gift receipts"
  ON public.gift_receipts
  FOR ALL
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

-- Gifter can view receipts related to them
CREATE POLICY "Gifters can view gift receipts"
  ON public.gift_receipts
  FOR SELECT
  USING (auth.uid() = gifter_user_id);


-- 2) Thank you post
CREATE TABLE IF NOT EXISTS public.thank_you_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.wishlist_items(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.wishlist_reservations(id) ON DELETE SET NULL,
  receipt_id UUID REFERENCES public.gift_receipts(id) ON DELETE SET NULL,
  recipient_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  gifter_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'only_gifter', 'private')),

  image_url TEXT,
  message TEXT,
  ai_tone TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(item_id)
);

ALTER TABLE public.thank_you_posts ENABLE ROW LEVEL SECURITY;

-- Recipient can manage their thank you posts
CREATE POLICY "Recipients can manage their thank you posts"
  ON public.thank_you_posts
  FOR ALL
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

-- Gifter can view posts that are shared with them
CREATE POLICY "Gifters can view shared thank you posts"
  ON public.thank_you_posts
  FOR SELECT
  USING (
    auth.uid() = gifter_user_id
    AND visibility IN ('public', 'only_gifter')
    AND status = 'published'
  );

-- Public can view published posts when the wishlist is public
CREATE POLICY "Public can view published thank you posts on public wishlists"
  ON public.thank_you_posts
  FOR SELECT
  USING (
    status = 'published'
    AND visibility = 'public'
    AND (
      SELECT w.privacy_level
      FROM public.wishlist_items wi
      JOIN public.wishlists w ON w.id = wi.wishlist_id
      WHERE wi.id = item_id
    ) = 'public'
  );

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_thank_you_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thank_you_posts_set_updated_at ON public.thank_you_posts;
CREATE TRIGGER thank_you_posts_set_updated_at
  BEFORE UPDATE ON public.thank_you_posts
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_thank_you_posts_updated_at();
