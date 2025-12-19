-- ========= STEP 1: CREATE PROPER ROLE SYSTEM (SECURITY CRITICAL) =========
-- Roles MUST be in a separate table to prevent privilege escalation

CREATE TYPE public.app_role AS ENUM ('user', 'brand');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
-- RLS policies for user_roles
CREATE POLICY "All users can view all roles"
  ON public.user_roles FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');
-- ========= STEP 2: CREATE 'gift_ratings' TABLE (Pillar 5) =========

CREATE TABLE public.gift_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.wishlist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(item_id, user_id)
);
ALTER TABLE public.gift_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own gift ratings"
  ON public.gift_ratings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- ========= STEP 3: CREATE 'gift_exchanges' TABLES (Pillar 7) =========
-- Create tables first, then add RLS policies

CREATE TABLE public.gift_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_date DATE,
  spend_limit NUMERIC(10, 2),
  created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE public.gift_exchange_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES public.gift_exchanges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  assigned_giftee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(exchange_id, user_id)
);
-- Now enable RLS and add policies
ALTER TABLE public.gift_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_exchange_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can see gift exchanges they are in"
  ON public.gift_exchanges FOR SELECT
  USING (id IN (SELECT exchange_id FROM public.gift_exchange_participants WHERE user_id = auth.uid()));
CREATE POLICY "Creator can manage the gift exchange"
  ON public.gift_exchanges FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Participants can see other participants in their exchange"
  ON public.gift_exchange_participants FOR SELECT
  USING (exchange_id IN (SELECT exchange_id FROM public.gift_exchange_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their own participation"
  ON public.gift_exchange_participants FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
