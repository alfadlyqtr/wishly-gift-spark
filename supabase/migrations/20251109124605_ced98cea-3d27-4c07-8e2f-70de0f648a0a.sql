-- ========= CREATE ALL REMAINING WISHLY TABLES =========

-- 1. EVENTS TABLE (Pillar 1)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add event_id to wishlists
ALTER TABLE public.wishlists
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
-- 2. SOCIAL & DISCOVERY TABLES (Pillar 2)
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id, reaction_type)
);
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.gift_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.gift_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.gift_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.gift_circle_wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.gift_circles(id) ON DELETE CASCADE,
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, wishlist_id)
);
-- 3. MESSAGING TABLES (Pillar 3)
CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.thread_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(thread_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. AI & AUTOMATION TABLES (Pillar 4)
CREATE TABLE IF NOT EXISTS public.gift_registry_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  event_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  budget_max NUMERIC(10, 2),
  keywords TEXT,
  recommendation_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  prompt TEXT,
  response TEXT,
  function_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 5. POST-GIFT EXPERIENCE TABLES (Pillar 5)
CREATE TABLE IF NOT EXISTS public.memory_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
  item_title TEXT NOT NULL,
  item_image_url TEXT,
  giver_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.thank_you_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_board_id UUID NOT NULL REFERENCES public.memory_board(id) ON DELETE CASCADE,
  thank_you_note TEXT,
  thank_you_video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.giver_stats (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  gifts_given_count INT DEFAULT 0,
  events_participated_in INT DEFAULT 0,
  last_gift_given_at TIMESTAMPTZ
);
-- 6. BRANDS & MARKETPLACE TABLES (Pillar 6)
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.store_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC(10, 2),
  store_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.store_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  count INT DEFAULT 1,
  logged_at DATE DEFAULT CURRENT_DATE
);
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 7. GROWTH & VIRALITY TABLES (Pillar 7)
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviting_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invited_email TEXT,
  invited_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  score INT NOT NULL,
  period TEXT NOT NULL,
  UNIQUE(user_id, metric, period)
);
-- ========= ENABLE RLS ON ALL NEW TABLES =========
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_circle_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_registry_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thank_you_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giver_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
-- ========= CREATE RLS POLICIES =========

-- EVENTS: User-only
CREATE POLICY "Users can manage their own events" ON public.events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- REACTIONS: Public read, user-only write
CREATE POLICY "All users can view reactions" ON public.reactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage their own reactions" ON public.reactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- COMMENTS: Public read, user-only write
CREATE POLICY "All users can view comments" ON public.comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage their own comments" ON public.comments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- GIFT CIRCLES: Member-only access
CREATE POLICY "Members can see/manage their circles" ON public.gift_circles FOR ALL USING (id IN (SELECT circle_id FROM public.gift_circle_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can see/manage circle members" ON public.gift_circle_members FOR ALL USING (circle_id IN (SELECT circle_id FROM public.gift_circle_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can see/manage circle wishlists" ON public.gift_circle_wishlists FOR ALL USING (circle_id IN (SELECT circle_id FROM public.gift_circle_members WHERE user_id = auth.uid()));
-- MESSAGING: Participant-only
CREATE POLICY "Users can view/manage threads they participate in" ON public.threads FOR ALL USING (id IN (SELECT thread_id FROM public.thread_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users can view/manage participants of their threads" ON public.thread_participants FOR ALL USING (thread_id IN (SELECT thread_id FROM public.thread_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users can send/receive messages in their threads" ON public.messages FOR ALL USING (thread_id IN (SELECT thread_id FROM public.thread_participants WHERE user_id = auth.uid())) WITH CHECK (auth.uid() = user_id);
-- AI TABLES: User-only
CREATE POLICY "Users can see their own gift log" ON public.gift_registry_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can see their own recommendations" ON public.ai_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can see their own AI logs" ON public.ai_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- POST-GIFT TABLES: User-only
CREATE POLICY "Users can manage their own memory board" ON public.memory_board FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their thank you cards" ON public.thank_you_cards FOR ALL USING (auth.uid() = (SELECT user_id FROM public.memory_board WHERE id = memory_board_id));
CREATE POLICY "Users can see their own giver stats" ON public.giver_stats FOR SELECT USING (auth.uid() = user_id);
-- STORE TABLES: Public read, owner-write
CREATE POLICY "All users can view stores" ON public.stores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Owners can manage their stores" ON public.stores FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "All users can view store items" ON public.store_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Store owners can manage their items" ON public.store_items FOR ALL USING (auth.uid() = (SELECT owner_id FROM public.stores WHERE id = store_id)) WITH CHECK (auth.uid() = (SELECT owner_id FROM public.stores WHERE id = store_id));
CREATE POLICY "Store owners can see their analytics" ON public.store_analytics FOR SELECT USING (auth.uid() = (SELECT owner_id FROM public.stores WHERE id = store_id));
CREATE POLICY "All users can view campaigns" ON public.campaigns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Store owners can manage their campaigns" ON public.campaigns FOR ALL USING (auth.uid() = (SELECT owner_id FROM public.stores WHERE id = store_id)) WITH CHECK (auth.uid() = (SELECT owner_id FROM public.stores WHERE id = store_id));
-- GROWTH TABLES
CREATE POLICY "Users can manage their own invitations" ON public.invitations FOR ALL USING (auth.uid() = inviting_user_id) WITH CHECK (auth.uid() = inviting_user_id);
CREATE POLICY "All users can view leaderboards" ON public.leaderboards FOR SELECT USING (auth.role() = 'authenticated');
-- ========= CREATE STORAGE BUCKET =========
INSERT INTO storage.buckets (id, name, public) VALUES ('post_gift_media', 'post_gift_media', FALSE) ON CONFLICT (id) DO NOTHING;
-- ========= ENABLE REALTIME =========
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.wishlist_items REPLICA IDENTITY FULL;
ALTER TABLE public.wishlist_reservations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
