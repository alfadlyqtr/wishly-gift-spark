-- Track one-time event reminder pushes per follower
CREATE TABLE IF NOT EXISTS public.wishlist_event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wishlist_id, follower_id, event_date)
);

ALTER TABLE public.wishlist_event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all event reminders"
  ON public.wishlist_event_reminders FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Owners can view reminders for their wishlists"
  ON public.wishlist_event_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishlists w
      WHERE w.id = wishlist_event_reminders.wishlist_id
        AND w.user_id = auth.uid()
    )
  );
