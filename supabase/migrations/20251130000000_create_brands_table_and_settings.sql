
-- ========================================
-- BRANDS TABLE & ENHANCED SETTINGS
-- ========================================

-- 1. CREATE BRANDS TABLE (separate from stores for better organization)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  brand_name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  
  -- Business Details
  brand_website TEXT,
  brand_category TEXT,
  brand_country TEXT,
  manager_name TEXT,
  
  -- Contact Info
  email TEXT,
  phone TEXT,
  address TEXT,
  
  -- Social Media
  instagram TEXT,
  twitter TEXT,
  facebook TEXT,
  linkedin TEXT,
  tiktok TEXT,
  youtube TEXT,
  
  -- Settings & Preferences
  is_public BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  allow_messages BOOLEAN DEFAULT TRUE,
  allow_product_requests BOOLEAN DEFAULT TRUE,
  auto_approve_followers BOOLEAN DEFAULT FALSE,
  
  -- Business Settings
  business_hours JSONB, -- {monday: {open: "09:00", close: "17:00"}, ...}
  shipping_countries TEXT[],
  return_policy TEXT,
  
  -- Notifications
  notify_new_follower BOOLEAN DEFAULT TRUE,
  notify_product_mention BOOLEAN DEFAULT TRUE,
  notify_review BOOLEAN DEFAULT TRUE,
  
  -- Analytics Preferences
  show_analytics_publicly BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE BRAND_FOLLOWERS TABLE (separate from user followers)
CREATE TABLE IF NOT EXISTS public.brand_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_type TEXT NOT NULL CHECK (follower_type IN ('user', 'brand')), -- user or brand
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, follower_id)
);

-- 3. CREATE BRAND_FOLLOWING TABLE (brands following users/other brands)
CREATE TABLE IF NOT EXISTS public.brand_following (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_type TEXT NOT NULL CHECK (following_type IN ('user', 'brand')), -- user or brand
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, following_id)
);

-- 4. CREATE BRAND_SETTINGS_HISTORY (audit trail)
CREATE TABLE IF NOT EXISTS public.brand_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ENABLE RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_following ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_settings_history ENABLE ROW LEVEL SECURITY;

-- 6. CREATE RLS POLICIES FOR BRANDS
-- Public brands visible to all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brands'
      AND policyname = 'Public brands visible to all authenticated users'
  ) THEN
    EXECUTE 'CREATE POLICY "Public brands visible to all authenticated users" ON public.brands FOR SELECT USING (is_public = TRUE AND auth.role() = ''authenticated'')';
  END IF;
END
$$;

-- Brand owners can view their own brand
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brands'
      AND policyname = 'Brand owners can view their own brand'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can view their own brand" ON public.brands FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END
$$;

-- Brand owners can insert their brand
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brands'
      AND policyname = 'Users can create their brand profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can create their brand profile" ON public.brands FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END
$$;

-- Brand owners can update their brand
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brands'
      AND policyname = 'Brand owners can update their brand'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can update their brand" ON public.brands FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END
$$;

-- Brand owners can delete their brand
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brands'
      AND policyname = 'Brand owners can delete their brand'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can delete their brand" ON public.brands FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END
$$;

-- 7. CREATE RLS POLICIES FOR BRAND_FOLLOWERS
-- Anyone can view accepted followers of public brands
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_followers'
      AND policyname = 'View accepted followers of public brands'
  ) THEN
    EXECUTE 'CREATE POLICY "View accepted followers of public brands" ON public.brand_followers FOR SELECT USING (status = ''accepted'' AND EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND is_public = TRUE))';
  END IF;
END
$$;

-- Brand owners can view all their followers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_followers'
      AND policyname = 'Brand owners can view all their followers'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can view all their followers" ON public.brand_followers FOR SELECT USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))';
  END IF;
END
$$;

-- Users can view their own follow status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_followers'
      AND policyname = 'Users can view their own follow status'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own follow status" ON public.brand_followers FOR SELECT USING (follower_id = auth.uid())';
  END IF;
END
$$;

-- Users can follow brands
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_followers'
      AND policyname = 'Users can follow brands'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can follow brands" ON public.brand_followers FOR INSERT WITH CHECK (follower_id = auth.uid())';
  END IF;
END
$$;

-- Users can unfollow brands
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_followers'
      AND policyname = 'Users can unfollow brands'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can unfollow brands" ON public.brand_followers FOR DELETE USING (follower_id = auth.uid())';
  END IF;
END
$$;

-- Brand owners can manage followers (accept/block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_followers'
      AND policyname = 'Brand owners can manage their followers'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can manage their followers" ON public.brand_followers FOR UPDATE USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))';
  END IF;
END
$$;

-- 8. CREATE RLS POLICIES FOR BRAND_FOLLOWING
-- Anyone can view accepted following of public brands
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_following'
      AND policyname = 'View accepted following of public brands'
  ) THEN
    EXECUTE 'CREATE POLICY "View accepted following of public brands" ON public.brand_following FOR SELECT USING (status = ''accepted'' AND EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND is_public = TRUE))';
  END IF;
END
$$;

-- Brand owners can view all their following
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_following'
      AND policyname = 'Brand owners can view all their following'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can view all their following" ON public.brand_following FOR SELECT USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))';
  END IF;
END
$$;

-- Users can view if a brand is following them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_following'
      AND policyname = 'Users can view brands following them'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view brands following them" ON public.brand_following FOR SELECT USING (following_id = auth.uid())';
  END IF;
END
$$;

-- Brands can follow users/other brands
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_following'
      AND policyname = 'Brands can follow users/brands'
  ) THEN
    EXECUTE 'CREATE POLICY "Brands can follow users/brands" ON public.brand_following FOR INSERT WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))';
  END IF;
END
$$;

-- Brands can unfollow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_following'
      AND policyname = 'Brands can unfollow'
  ) THEN
    EXECUTE 'CREATE POLICY "Brands can unfollow" ON public.brand_following FOR DELETE USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))';
  END IF;
END
$$;

-- 9. CREATE RLS POLICIES FOR BRAND_SETTINGS_HISTORY
-- Brand owners can view their settings history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_settings_history'
      AND policyname = 'Brand owners can view their settings history'
  ) THEN
    EXECUTE 'CREATE POLICY "Brand owners can view their settings history" ON public.brand_settings_history FOR SELECT USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))';
  END IF;
END
$$;

-- 10. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON public.brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_is_public ON public.brands(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_brands_category ON public.brands(brand_category);
CREATE INDEX IF NOT EXISTS idx_brands_country ON public.brands(brand_country);
CREATE INDEX IF NOT EXISTS idx_brand_followers_brand_id ON public.brand_followers(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_followers_follower_id ON public.brand_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_brand_following_brand_id ON public.brand_following(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_following_following_id ON public.brand_following(following_id);

-- 11. CREATE FUNCTION TO UPDATE updated_at
CREATE OR REPLACE FUNCTION public.update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. CREATE TRIGGER FOR updated_at
DROP TRIGGER IF EXISTS update_brands_updated_at_trigger ON public.brands;
CREATE TRIGGER update_brands_updated_at_trigger
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_brands_updated_at();

-- 13. CREATE FUNCTION TO LOG SETTINGS CHANGES
CREATE OR REPLACE FUNCTION public.log_brand_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log significant setting changes
  IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
    INSERT INTO public.brand_settings_history (brand_id, changed_by, setting_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'is_public', OLD.is_public::TEXT, NEW.is_public::TEXT);
  END IF;
  
  IF OLD.allow_messages IS DISTINCT FROM NEW.allow_messages THEN
    INSERT INTO public.brand_settings_history (brand_id, changed_by, setting_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'allow_messages', OLD.allow_messages::TEXT, NEW.allow_messages::TEXT);
  END IF;
  
  IF OLD.auto_approve_followers IS DISTINCT FROM NEW.auto_approve_followers THEN
    INSERT INTO public.brand_settings_history (brand_id, changed_by, setting_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'auto_approve_followers', OLD.auto_approve_followers::TEXT, NEW.auto_approve_followers::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. CREATE TRIGGER FOR SETTINGS LOGGING
DROP TRIGGER IF EXISTS log_brand_settings_change_trigger ON public.brands;
CREATE TRIGGER log_brand_settings_change_trigger
  AFTER UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.log_brand_settings_change();

-- 15. ENABLE REALTIME FOR BRAND FOLLOWERS
ALTER TABLE public.brand_followers REPLICA IDENTITY FULL;
ALTER TABLE public.brand_following REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'brand_followers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_followers';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'brand_following'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_following';
  END IF;
END
$$;
